"""Save SoilGrids 2.0 topsoil estimates for the places listed in greendata/env.js
-> greendata/data/soil.json (soil changes over decades, so this only needs to run when places change).

The SoilGrids REST API is a free beta service that is often slow or busy, so each place is retried
patiently and places already saved are kept. Values are converted to: pH, organic carbon (g/kg),
clay/sand/silt (%), nitrogen (g/kg), for the 0-5 cm layer.
Run: python scripts/update_soil.py
"""
import json
import pathlib
import re
import time
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV_JS = ROOT / "greendata" / "env.js"
OUT = ROOT / "greendata" / "data" / "soil.json"
PROPS = ["phh2o", "soc", "clay", "sand", "silt", "nitrogen"]


def places():
    src = ENV_JS.read_text(encoding="utf-8")
    block = re.search(r"var PLACES = \[(.*?)\];", src, re.S).group(1)
    return [(m[0], float(m[1]), float(m[2])) for m in
            re.findall(r"id: '([a-z]+)'.*?lat: (-?[\d.]+), lon: (-?[\d.]+)", block)]


def query(lat, lon):
    q = "&".join("property=" + p for p in PROPS)
    url = (f"https://rest.isric.org/soilgrids/v2.0/properties/query?lon={lon}&lat={lat}&{q}"
           "&depth=0-5cm&value=mean")
    req = urllib.request.Request(url, headers={"User-Agent": "greendata-soil"})
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.loads(r.read().decode("utf-8"))
    out = {}
    for layer in d["properties"]["layers"]:
        v = layer["depths"][0]["values"]["mean"]
        out[layer["name"]] = None if v is None else round(v / layer["unit_measure"]["d_factor"], 2)
    return out


def main():
    data = json.loads(OUT.read_text()) if OUT.exists() else {"places": {}}
    data["source"] = "SoilGrids 2.0 (ISRIC), 0-5 cm, 250 m, CC BY 4.0"
    # the exact point can fall on a town, a lake, rock or ice (no soil): try nearby points, about 3-6 km away
    offsets = [(0, 0), (0.03, 0), (-0.03, 0), (0, 0.03), (0, -0.03), (0.05, 0.05), (-0.05, -0.05), (0.05, -0.05), (-0.05, 0.05)]
    for pid, lat, lon in places():
        old = data["places"].get(pid)
        if old and old.get("phh2o") is not None:
            continue
        found = None
        for dy, dx in offsets:
            res = None
            for k in range(4):
                try:
                    res = query(round(lat + dy, 4), round(lon + dx, 4))
                    break
                except Exception as e:
                    print(pid, "retry", k + 1, e, flush=True)
                    time.sleep(20 * (k + 1))
            time.sleep(13)  # SoilGrids asks for at most 5 requests per minute
            if res and res.get("phh2o") is not None:
                found = dict(res, lat=round(lat + dy, 4), lon=round(lon + dx, 4))
                break
        if found:
            data["places"][pid] = found
        print(pid, found, flush=True)
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
