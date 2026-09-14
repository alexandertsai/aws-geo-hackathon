"""Turn raw Overpass elements into a routable pedestrian graph plus map layers.

Usage: python pipeline/build_graph.py [area]
Reads  data/<area>_osm.json and data/aac_centres.json
Writes web/data/<area>.json with:
  nodes   [[lng, lat], ...]
  edges   [[a, b, length_m, flags, way_id], ...]   flags is a bitmask (see FLAG_*)
  ways    {way_id: {highway, name, covered, steps, ramp, ...}} for display
  buildings  GeoJSON FeatureCollection with height
  aacs    AACs inside the bbox (with a 1 km margin)
  bbox    [west, south, east, north]
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import polars as pl

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from fetch_osm import AREAS  # noqa: E402

PED = {"footway", "path", "pedestrian", "steps", "corridor", "living_street", "cycleway", "track"}
ROAD = {
    "residential", "service", "unclassified", "tertiary", "tertiary_link",
    "secondary", "secondary_link", "primary", "primary_link",
}

FLAG_COVERED = 1      # sheltered from rain (covered=yes, tunnel, building passage, indoor)
FLAG_STEPS = 2        # highway=steps
FLAG_RAMP = 4         # steps with a ramp alongside (ramp=yes / ramp:wheelchair=yes)
FLAG_CROSSING = 8     # road crossing
FLAG_ROAD = 16        # walking along a carriageway with no separate footway mapped
FLAG_BRIDGE = 32      # overhead bridge / elevated link
FLAG_NO_WHEELCHAIR = 64
FLAG_ELEVATOR = 128


def haversine(a, b) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def way_flags(t: dict) -> int:
    hw = t.get("highway")
    f = 0
    if (
        t.get("covered") in ("yes", "arcade", "colonnade")
        or t.get("tunnel") in ("yes", "building_passage")
        or t.get("indoor") == "yes"
        or hw == "corridor"
        or t.get("shelter") == "yes"
    ):
        f |= FLAG_COVERED
    if hw == "steps":
        f |= FLAG_STEPS
        if t.get("ramp") == "yes" or t.get("ramp:wheelchair") in ("yes", "separate") or t.get("wheelchair") == "yes":
            f |= FLAG_RAMP
    if hw == "elevator":
        f |= FLAG_ELEVATOR | FLAG_COVERED
    if t.get("footway") == "crossing" or hw == "crossing":
        f |= FLAG_CROSSING
    if hw in ROAD:
        f |= FLAG_ROAD
    if t.get("bridge") == "yes":
        f |= FLAG_BRIDGE
    if t.get("wheelchair") == "no":
        f |= FLAG_NO_WHEELCHAIR
    return f


def is_walkable(t: dict) -> bool:
    hw = t.get("highway")
    if hw not in PED and hw not in ROAD:
        return False
    if t.get("foot") == "no" or t.get("access") in ("private", "no") and t.get("foot") != "yes":
        return False
    if hw == "service" and t.get("service") in ("parking_aisle", "driveway") and t.get("foot") != "yes":
        return False
    if t.get("area") == "yes":
        return False
    return True


def build(area: str) -> None:
    els = json.loads((ROOT / "data" / f"{area}_osm.json").read_text())
    s, w, n, e = AREAS[area]

    node_index: dict[int, int] = {}
    nodes: list[list[float]] = []
    edges: list[list] = []
    ways: dict[int, dict] = {}
    buildings = []

    def nid(osm_id: int, lon: float, lat: float) -> int:
        if osm_id not in node_index:
            node_index[osm_id] = len(nodes)
            nodes.append([round(lon, 7), round(lat, 7)])
        return node_index[osm_id]

    for el in els:
        if el["type"] != "way":
            continue
        t = el.get("tags", {})
        if "building" in t:
            ring = [[p["lon"], p["lat"]] for p in el["geometry"]]
            if len(ring) < 4:
                continue
            levels = t.get("building:levels")
            height = t.get("height")
            try:
                h = float(str(height).split()[0]) if height else (float(levels) * 3.2 if levels else 6.0)
            except ValueError:
                h = 6.0
            buildings.append({
                "type": "Feature",
                "properties": {"h": round(h, 1), "name": t.get("name") or t.get("addr:housenumber")},
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            })
            continue
        if not is_walkable(t):
            continue
        f = way_flags(t)
        ways[el["id"]] = {
            "hw": t.get("highway"),
            "name": t.get("name"),
            "flags": f,
            "step_count": t.get("step_count"),
            "handrail": t.get("handrail"),
            "lit": t.get("lit"),
            "surface": t.get("surface"),
            "width": t.get("width"),
            "incline": t.get("incline"),
        }
        pts = el["geometry"]
        ids = el["nodes"]
        for i in range(len(pts) - 1):
            a = nid(ids[i], pts[i]["lon"], pts[i]["lat"])
            b = nid(ids[i + 1], pts[i + 1]["lon"], pts[i + 1]["lat"])
            if a == b:
                continue
            L = haversine(nodes[a], nodes[b])
            edges.append([a, b, round(L, 1), f, el["id"]])

    # elevators are nodes shared between levels; mark them so the router can treat them as step-free
    for el in els:
        if el["type"] == "node" and el.get("tags", {}).get("highway") == "elevator" and el["id"] in node_index:
            i = node_index[el["id"]]
            for ed in edges:
                if ed[0] == i or ed[1] == i:
                    ed[3] |= FLAG_ELEVATOR

    # largest connected component only, so every snap lands on a routable node
    adj = defaultdict(list)
    for a, b, *_ in edges:
        adj[a].append(b)
        adj[b].append(a)
    seen = [-1] * len(nodes)
    comp_sizes = []
    for start in range(len(nodes)):
        if seen[start] != -1 or start not in adj:
            continue
        c = len(comp_sizes)
        stack = [start]
        seen[start] = c
        size = 0
        while stack:
            u = stack.pop()
            size += 1
            for v in adj[u]:
                if seen[v] == -1:
                    seen[v] = c
                    stack.append(v)
        comp_sizes.append(size)
    main_c = max(range(len(comp_sizes)), key=lambda i: comp_sizes[i])
    keep = [i for i in range(len(nodes)) if seen[i] == main_c]
    remap = {old: new for new, old in enumerate(keep)}
    nodes = [nodes[i] for i in keep]
    edges = [[remap[a], remap[b], L, f, wid] for a, b, L, f, wid in edges if a in remap and b in remap]
    used_ways = {ed[4] for ed in edges}
    ways = {k: v for k, v in ways.items() if k in used_ways}

    aacs = [
        a for a in json.loads((ROOT / "data" / "aac_centres.json").read_text())
        if s - 0.009 <= a["lat"] <= n + 0.009 and w - 0.009 <= a["lng"] <= e + 0.009
    ]
    for a in aacs:
        a.pop("catchment_postal_codes", None)

    out = {
        "area": area,
        "bbox": [w, s, e, n],
        "nodes": nodes,
        "edges": edges,
        "ways": {str(k): v for k, v in ways.items()},
        "buildings": {"type": "FeatureCollection", "features": buildings},
        "aacs": aacs,
    }
    out_path = ROOT / "web" / "data" / f"{area}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, separators=(",", ":")))

    df = pl.DataFrame({"len": [ed[2] for ed in edges], "flags": [ed[3] for ed in edges]})
    summary = df.select(
        pl.col("len").sum().alias("total_m"),
        pl.col("len").filter(pl.col("flags") & FLAG_COVERED > 0).sum().alias("covered_m"),
        pl.col("len").filter(pl.col("flags") & FLAG_STEPS > 0).sum().alias("steps_m"),
        pl.col("len").filter((pl.col("flags") & FLAG_STEPS > 0) & (pl.col("flags") & FLAG_RAMP > 0)).sum().alias("steps_with_ramp_m"),
        pl.col("len").filter(pl.col("flags") & FLAG_ROAD > 0).sum().alias("on_road_m"),
    )
    print(f"{area}: {len(nodes)} nodes, {len(edges)} edges, {len(ways)} ways, {len(buildings)} buildings, {len(aacs)} AACs")
    print(f"dropped {len(comp_sizes) - 1} small components; largest has {comp_sizes[main_c]} nodes")
    print(summary)
    print(f"-> {out_path.relative_to(ROOT)} ({out_path.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "toa_payoh")
