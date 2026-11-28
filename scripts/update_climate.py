"""Build CMIP6 climate projections for Peruvian cities -> greendata/data/climate.json

Source: Open-Meteo Climate API (CMIP6 HighResMIP models, bias corrected, 1950-2050).
The API weights long daily requests heavily, so this script works incrementally:
each run downloads a limited number of 10-year chunks, aggregates them to annual
values and saves progress. Re-running continues where it stopped; once every city
is complete the script does nothing.

Run: python scripts/update_climate.py
"""
import json
import math
import pathlib
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone

OUT = pathlib.Path(__file__).resolve().parent.parent / "greendata" / "data" / "climate.json"
API = "https://climate-api.open-meteo.com/v1/climate"
MODELS = ["EC_Earth3P_HR", "MRI_AGCM3_2_S"]
VARIABLES = ["temperature_2m_mean", "precipitation_sum"]
FIRST_YEAR, LAST_YEAR = 1960, 2049
BASELINE = [1981, 2010]
CITIES = [
    {"name": "Lima", "lat": -12.046, "lon": -77.043},
    {"name": "Piura", "lat": -5.194, "lon": -80.632},
    {"name": "Iquitos", "lat": -3.749, "lon": -73.253},
    {"name": "Cusco", "lat": -13.532, "lon": -71.967},
    {"name": "Arequipa", "lat": -16.409, "lon": -71.537},
    {"name": "Puno", "lat": -15.840, "lon": -70.022},
    {"name": "Huaraz", "lat": -9.527, "lon": -77.528},
    {"name": "Pucallpa", "lat": -8.379, "lon": -74.554},
]
# Open-Meteo counts one call per 14 days (and per 10 variables) of requested data.
CALL_BUDGET_PER_RUN = 4700      # stays under the 5,000 calls/hour limit
CALLS_PER_MINUTE = 550          # stays under the 600 calls/minute limit


def chunk_calls(y0, y1):
    days = (date(y1, 12, 31) - date(y0, 1, 1)).days + 1
    return math.ceil(days / 14) * math.ceil(len(VARIABLES) / 10)


def fetch(city, model, y0, y1):
    q = (f"{API}?latitude={city['lat']}&longitude={city['lon']}&start_date={y0}-01-01&end_date={y1}-12-31"
         f"&models={model}&daily={','.join(VARIABLES)}&timezone=America%2FLima")
    req = urllib.request.Request(q, headers={"User-Agent": "greendata-climate-builder"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def annualize(daily):
    """Annual mean temperature (°C) and total precipitation (mm), only for complete years."""
    out = {}
    temps, rains = {}, {}
    for t, temp, rain in zip(daily["time"], daily["temperature_2m_mean"], daily["precipitation_sum"]):
        y = t[:4]
        if temp is not None:
            temps.setdefault(y, []).append(temp)
        if rain is not None:
            rains.setdefault(y, []).append(rain)
    for y in temps:
        if len(temps[y]) >= 360 and len(rains.get(y, [])) >= 360:
            out[y] = [round(sum(temps[y]) / len(temps[y]), 2), round(sum(rains[y]), 1)]
    return out


def load():
    if OUT.exists():
        return json.loads(OUT.read_text(encoding="utf-8"))
    return {}


def main():
    data = load()
    data.update({
        "source": "Open-Meteo Climate API, CMIP6 HighResMIP models (bias corrected); "
                  "high-emissions pathway close to RCP8.5",
        "models": MODELS,
        "baseline": BASELINE,
        "first_year": FIRST_YEAR,
        "last_year": LAST_YEAR,
    })
    cities = data.setdefault("cities", {})
    used, minute_used, minute_start = 0, 0, time.monotonic()
    stop = False
    for city in CITIES:
        c = cities.setdefault(city["name"], {"lat": city["lat"], "lon": city["lon"], "years": {}})
        for model in MODELS:
            years = c["years"].setdefault(model, {})
            for y0 in range(FIRST_YEAR, LAST_YEAR + 1, 10):
                y1 = min(y0 + 9, LAST_YEAR)
                if all(str(y) in years for y in range(y0, y1 + 1)):
                    continue
                cost = chunk_calls(y0, y1)
                if used + cost > CALL_BUDGET_PER_RUN:
                    stop = True
                    break
                if minute_used + cost > CALLS_PER_MINUTE:
                    wait = 61 - (time.monotonic() - minute_start)
                    if wait > 0:
                        time.sleep(wait)
                    minute_used, minute_start = 0, time.monotonic()
                try:
                    res = fetch(city, model, y0, y1)
                except (urllib.error.URLError, OSError) as e:
                    # rate limit or a dropped connection: keep what we have and continue next run
                    print(f"{city['name']} {model} {y0}-{y1}: {getattr(e, 'code', e)}, stopping this run")
                    stop = True
                    break
                years.update(annualize(res["daily"]))
                used += cost
                minute_used += cost
                print(f"{city['name']} {model} {y0}-{y1}: ok ({used} calls used)")
            if stop:
                break
        if stop:
            break
    complete = [n for n, c in cities.items()
                if all(len(c["years"].get(m, {})) >= LAST_YEAR - FIRST_YEAR + 1 for m in MODELS)]
    data["complete_cities"] = [c["name"] for c in CITIES if c["name"] in complete]
    if used:
        data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"complete: {data['complete_cities']} · calls used this run: {used}")


if __name__ == "__main__":
    main()
