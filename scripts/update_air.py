"""Download air quality (CAMS) and the 7-day weather outlook for the cities on the map,
and write greendata/data/air.json, so visitors read one small file instead of calling
Open-Meteo from every phone (which can hit its free rate limit).

The city list is read from greendata/app.js (var CITIES), so there is a single source.
Run: python scripts/update_air.py
"""
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "greendata" / "app.js"
OUT = ROOT / "greendata" / "data" / "air.json"
TZ = "America/Lima"


def cities():
    src = APP.read_text(encoding="utf-8")
    block = re.search(r"var CITIES = \[(.*?)\];", src, re.S).group(1)
    return [(float(a), float(b)) for a, b in re.findall(r"lat: (-?[\d.]+), lon: (-?[\d.]+)", block)]


def get(url, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "greendata-air-updater"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(10 * (k + 1))


def main():
    pts = cities()
    lat = ",".join(str(a) for a, _ in pts)
    lon = ",".join(str(b) for _, b in pts)
    q = urllib.parse.quote(TZ)
    air = get("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=%s&longitude=%s"
              "&hourly=pm2_5,pm10&past_days=1&forecast_days=2&timezone=%s" % (lat, lon, q))
    wx = get("https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s"
             "&daily=precipitation_sum,precipitation_probability_max,uv_index_max,temperature_2m_max,temperature_2m_min"
             "&forecast_days=7&timezone=%s" % (lat, lon, q))
    air = air if isinstance(air, list) else [air]
    wx = wx if isinstance(wx, list) else [wx]
    if len(air) != len(pts) or len(wx) != len(pts):
        raise SystemExit("unexpected number of locations")
    keep_air = [{"hourly": a["hourly"]} for a in air]
    keep_wx = [{"daily": w["daily"]} for w in wx]
    data = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Open-Meteo: Copernicus CAMS air quality and weather forecast (CC BY 4.0)",
        "air": keep_air,
        "wx": keep_wx,
    }
    OUT.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, len(pts), "cities")


if __name__ == "__main__":
    main()
