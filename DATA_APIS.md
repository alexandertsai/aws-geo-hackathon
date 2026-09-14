# Data APIs used in this pipeline

## Overpass API
Free query API for OpenStreetMap (OSM) data. Takes a custom query language (Overpass QL) describing a bounding box and tags, and returns matching map elements (nodes, ways, relations) as JSON, including geometry and tags.

Used here (`collect_osm_full.py`) to pull, for the Orchard corridor bounding box:
- Building footprints and heights (`building`, `height`, `building:levels`)
- Building massing parts (`building:part`) for podiums/towers
- Pedestrian paths (`footway`, `path`, `pedestrian`, `steps`, `corridor`, `living_street`)
- Accessibility features (elevators, kerbs, tactile paving, ramps)
- Site furniture (walls/fences, trees, benches, entrances)

No API key required. Public instances used: `overpass-api.de`, `overpass.kumi.systems`, `maps.mail.ru`.

## OpenStreetMap (the underlying data source)
A free, editable, crowdsourced map of the world. All data returned by Overpass ultimately comes from OSM's database, tagged with key-value pairs (e.g. `building=yes`, `ramp=yes`, `covered=yes`). Includes Singapore's LTA covered-linkway dataset, imported into OSM under Singapore's Open Data License.

## OpenFreeMap (map tiles)
Free vector tile hosting service for map basemaps, used only in the browser (`make_maplibre.py`), not queried in Python. Provides the "liberty" style used as the daylight basemap that buildings/paths are drawn on top of.