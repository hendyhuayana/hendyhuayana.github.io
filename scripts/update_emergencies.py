"""Save active El Niño-related emergencies in Peru and neighbouring countries
-> greendata/data/emergencies.json

Sources (open):
- GDACS (UN / European Commission): flood (FL), drought (DR) and tropical cyclone (TC) alerts.
- ReliefWeb (UN OCHA): ongoing disasters of type flood, flash flood, landslide/mudslide, drought,
  severe local storm or "El Niño" in the listed countries.
Only real records are written; if a source fails, its list is left empty and noted in "errors".
Run: python scripts/update_emergencies.py
"""
import json
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

OUT = pathlib.Path(__file__).resolve().parent.parent / "greendata" / "data" / "emergencies.json"
COUNTRIES = {"Peru": "PER", "Ecuador": "ECU", "Colombia": "COL", "Bolivia": "BOL", "Chile": "CHL"}
# a box around the region, for events that carry coordinates
BOX = (-56.0, -92.0, 13.0, -60.0)  # south, west, north, east
RW_TYPES = {"Flood", "Flash Flood", "Land Slide", "Mud Slide", "Drought", "Severe Local Storm", "Cold Wave", "Tropical Cyclone", "Storm Surge"}


def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "greendata-emergencies", "Accept": "application/json",
                                                          **({"Content-Type": "application/json"} if data else {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def in_box(lat, lon):
    s, w, n, e = BOX
    return lat is not None and lon is not None and s <= lat <= n and w <= lon <= e


def gdacs():
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=60)
    q = urllib.parse.urlencode({"eventlist": "FL;DR;TC", "fromDate": start.isoformat(), "toDate": end.isoformat(), "alertlevel": "Green;Orange;Red"})
    d = get("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?" + q)
    out = []
    for f in d.get("features", []):
        p = f.get("properties", {})
        geo = f.get("geometry") or {}
        c = geo.get("coordinates") if geo.get("type") == "Point" else None
        lon, lat = (c[0], c[1]) if c else (None, None)
        country = p.get("country") or ""
        iso = p.get("iso3") or ""
        if not (iso in COUNTRIES.values() or any(k in country for k in COUNTRIES) or in_box(lat, lon)):
            continue
        out.append({
            "source": "GDACS", "type": {"FL": "flood", "DR": "drought", "TC": "cyclone"}.get(p.get("eventtype"), p.get("eventtype")),
            "title": p.get("name") or p.get("description") or "",
            "country": country, "lat": lat, "lon": lon,
            "level": (p.get("alertlevel") or "").lower(),
            "from": (p.get("fromdate") or "")[:10], "to": (p.get("todate") or "")[:10],
            "url": (p.get("url") or {}).get("report") if isinstance(p.get("url"), dict) else p.get("url"),
        })
    return out


def reliefweb():
    body = {
        "fields": {"include": ["name", "status", "date.event", "type.name", "country.name", "primary_country.location", "url_alias"]},
        "filter": {"operator": "AND", "conditions": [
            {"field": "country.name", "value": list(COUNTRIES), "operator": "OR"},
            {"field": "status", "value": ["ongoing", "alert"], "operator": "OR"},
        ]},
        "sort": ["date.event:desc"], "limit": 60,
    }
    d = get("https://api.reliefweb.int/v1/disasters?appname=hendy-greendata", json.dumps(body).encode())
    out = []
    for item in d.get("data", []):
        f = item.get("fields", {})
        types = [t.get("name") for t in f.get("type", [])]
        name = f.get("name", "")
        if not (RW_TYPES.intersection(types) or "Ni" in name and "o" in name and "El Ni" in name):
            continue
        loc = (f.get("primary_country") or {}).get("location") or {}
        out.append({
            "source": "ReliefWeb", "type": next((t for t in types if t in RW_TYPES), types[0] if types else ""),
            "title": name, "country": ", ".join(c.get("name", "") for c in f.get("country", [])),
            "lat": loc.get("lat"), "lon": loc.get("lon"), "level": f.get("status", ""),
            "from": ((f.get("date") or {}).get("event") or "")[:10], "to": "",
            "url": f.get("url_alias") or "",
        })
    return out


def main():
    data = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "events": [], "errors": []}
    for name, fn in (("GDACS", gdacs), ("ReliefWeb", reliefweb)):
        try:
            data["events"] += fn()
        except Exception as e:  # keep going with the other source
            data["errors"].append(f"{name}: {e}")
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(data["events"]), "events", data["errors"])


if __name__ == "__main__":
    main()
