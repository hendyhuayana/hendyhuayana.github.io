"""Download NOAA CPC El Niño indices and write greendata/data/enso.json.

- ONI (Oceanic Niño Index, 3-month running mean of Niño 3.4 anomalies)
- Weekly OISST anomalies for Niño 1+2 (coast of Peru/Ecuador) and Niño 3.4

Run: python scripts/update_enso.py
"""
import json
import pathlib
import urllib.request
from datetime import datetime, timezone

ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
WEEKLY_URL = "https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for"
OUT = pathlib.Path(__file__).resolve().parent.parent / "greendata" / "data" / "enso.json"
SEASON_CENTER = {"DJF": 1, "JFM": 2, "FMA": 3, "MAM": 4, "AMJ": 5, "MJJ": 6,
                 "JJA": 7, "JAS": 8, "ASO": 9, "SON": 10, "OND": 11, "NDJ": 12}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "greendata-enso-updater"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def parse_oni(text):
    rows = []
    for line in text.splitlines()[1:]:
        p = line.split()
        if len(p) != 4 or p[0] not in SEASON_CENTER:
            continue
        rows.append([p[0], int(p[1]), SEASON_CENTER[p[0]], float(p[3])])
    return rows


def parse_weekly(text):
    rows = []
    for line in text.splitlines():
        s = line.strip()
        if len(s) < 10 or not s[:2].isdigit():
            continue
        date = datetime.strptime(s[:9], "%d%b%Y").strftime("%Y-%m-%d")
        rest = line[line.index(s[:9]) + 9:]
        # fixed-width: 4 regions x (SST 9 chars incl. spaces + SSTA 4 chars)
        vals = [rest[i:i + 13] for i in range(0, 52, 13)]
        ssta = [float(v[-4:]) for v in vals]
        rows.append([date, ssta[0], ssta[2]])
    return rows


def main():
    oni = parse_oni(get(ONI_URL))
    weekly = parse_weekly(get(WEEKLY_URL))
    if len(oni) < 800 or len(weekly) < 2000:
        raise SystemExit("Unexpected file format from NOAA CPC, not updating")
    data = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "NOAA Climate Prediction Center (CPC): ONI and weekly OISST v2.1 Niño indices",
        "oni": {"fields": ["season", "year", "center_month", "anomaly_c"], "rows": oni},
        "weekly": {"fields": ["week_center", "nino12_anom_c", "nino34_anom_c"], "rows": weekly},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"ONI: {oni[-1]}  weekly: {weekly[-1]}  -> {OUT}")


if __name__ == "__main__":
    main()
