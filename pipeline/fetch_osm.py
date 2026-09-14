"""Pull the walking network and buildings for a pilot area from OpenStreetMap via Overpass.

Usage: python pipeline/fetch_osm.py [area]   (area defaults to toa_payoh)
Output: data/<area>_osm.json (raw Overpass elements with geometry).
"""
import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent

# south, west, north, east
AREAS = {
    "toa_payoh": (1.3260, 103.8380, 1.3450, 103.8620),
    "ang_mo_kio": (1.3620, 103.8300, 1.3830, 103.8600),
    "bedok": (1.3170, 103.9200, 1.3370, 103.9500),
}

MIRRORS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

WALKABLE = (
    "footway|path|pedestrian|steps|corridor|living_street|residential|service|"
    "cycleway|track|unclassified|tertiary|tertiary_link|secondary|secondary_link|"
    "primary|primary_link"
)


def query(bbox: tuple[float, float, float, float]) -> str:
    b = ",".join(f"{v:.5f}" for v in bbox)
    return f"""[out:json][timeout:180];
(
  way["highway"~"^({WALKABLE})$"]({b});
  node["highway"="elevator"]({b});
  node["kerb"]({b});
  node["barrier"]({b});
  node["entrance"]({b});
  way["building"]({b});
);
out body geom;"""


def run(q: str) -> dict:
    last = None
    for m in MIRRORS:
        try:
            t0 = time.time()
            r = requests.post(m, data={"data": q}, timeout=240)
            print(f"{m} -> {r.status_code} in {time.time() - t0:.1f}s")
            if r.status_code == 200:
                return r.json()
            last = RuntimeError(f"{m} returned {r.status_code}")
        except requests.RequestException as e:
            print(f"{m} failed: {e}")
            last = e
    raise last


def main() -> None:
    area = sys.argv[1] if len(sys.argv) > 1 else "toa_payoh"
    bbox = AREAS[area]
    data = run(query(bbox))
    out = ROOT / "data" / f"{area}_osm.json"
    out.write_text(json.dumps(data["elements"]))
    n_way = sum(1 for e in data["elements"] if e["type"] == "way")
    print(f"{len(data['elements'])} elements ({n_way} ways) -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
