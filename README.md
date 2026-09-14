This project is a part of the AWS SLA hackathon, with the objective being for Singapore students to create solutions using Onemap data and AWS integration. Our challenge statement is: how can we shape Singapore to a be a more aged-friendly place? 


Let's build a map that routes elderly to active aging centres for specific workshops they want to attend (https://www.aic.sg/Care-Services/Active-Ageing-Centres). We should make sure these routes have shelters and are step-free (have ramps).
Otherwise, we should propose to SLA for routes that don't exist (shelter/no step free routes)
I like the design of https://undercover.gov.sg/ use it for inspiration

---

## Prototype (v0, 8 Sep 2026)

Working name in the UI: "Get there under cover". Pilot area: Toa Payoh.

What it does
- Resident flow: type your block (OneMap search), pick a workshop, see Active Ageing Centres ranked by the quality of the walk. Each centre shows two routes: the shortest walk, and a sheltered, step-free walk. Segments are coloured covered / open-air / stairs / stairs-with-ramp.
- Gap proposals: every open-air stretch and every unavoidable stair flight on the chosen route becomes a draft proposal (metres of covered linkway, ramp run length from OSM step counts). Copy as GeoJSON for SLA / LTA.
- Planner flow: every centre scored by how much of the walking network within 400 m is covered and how many stair flights lack a ramp.

Run it
```
.venv/bin/python pipeline/fetch_aac.py            # 257 AACs from AIC -> data/aac_centres.json/.csv
.venv/bin/python pipeline/fetch_osm.py toa_payoh  # Overpass -> data/toa_payoh_osm.json
.venv/bin/python pipeline/build_graph.py toa_payoh  # -> web/data/toa_payoh.json (graph + buildings + AACs)
cd web && ../.venv/bin/python -m http.server 8777  # open http://localhost:8777
```
Add a new estate by adding a bbox to `AREAS` in `pipeline/fetch_osm.py` and changing `AREA` in `web/index.html`.

Data sources and what we learned
- Active Ageing Centres: AIC has no open dataset, but its "Find an AAC" map calls `POST https://www.aic.sg/api/map-items` with category id `fd638c1c-5e23-410f-89f3-70a1c0c32183`. Returns all 257 centres with lat/lng, address, hours, contact and the catchment postal codes each centre serves. OneMap search and OSM know nothing about AACs.
- Walking network and accessibility: OpenStreetMap via Overpass (the `maps.mail.ru` mirror answers; `overpass-api.de` often rate-limits). In the Toa Payoh box: 1,180 pedestrian ways, 221 tagged `covered=yes` (the LTA covered-linkway import), 93 stair ways of which 11 have `ramp=yes`, 1,131 buildings (681 with storey counts). Void decks are mostly not mapped, so covered percentages are a lower bound.
- OneMap: search by street or block works without a token; postal-code search, routing and thematic layers need a token (`window.ONEMAP_TOKEN` in `web/config.js`, see `web/config.example.js`). OneMap routing is walk/drive/pt/cycle only and cannot avoid stairs or prefer shelter, which is why routing runs on our own graph.
- Workshop listings per centre are illustrative placeholders. AIC does not publish programme data per centre; next step is to ask AIC or scrape centre websites.

Routing model (`web/index.html`)
- Dijkstra over OSM edges. Cost per metre: x1 covered, x2.4 open-air at the default shelter weight, x1.6 walking on a carriageway, +25 m per road crossing, stairs are forbidden in step-free mode (x8 otherwise), stairs with a ramp or lift x1.3.
- Walking speed 0.8 m/s for time estimates.

Suggested AWS shape
- S3 + CloudFront for `web/`, Lambda (Python) for the pipeline on a schedule, one graph JSON per estate in S3. Bedrock could turn each GeoJSON proposal into a written submission for SLA.


## Simplified elderly experience (13 Sep 2026)

The opening screen separates “I'm an elderly person” from “I'm a planner”. The elderly journey asks for a location, offers three nearby centres, and shows one suggested walk. It uses large controls, keyboard focus states, short labels, optional read-aloud, and a mobile layout with the map above the controls. The example walk works with the bundled data; address search uses OneMap, and “Use my location” requests browser location permission.

The walking preview highlights the route on the existing 3D map and lets people inspect sheltered, open-air, and ramp segments. It is explicitly a preview, not live turn-by-turn guidance. Google Maps directions and Street View open through public Maps URLs without a new API key. Google computes its own route and may include stairs or less shelter; this is explained before leaving. Speech uses the browser's available voices.

Elderly routing rejects starts outside the pilot, distant graph connections, stairs without mapped ramps/lifts, and wheelchair-inaccessible edges. It does not fall back to a stair route. Accessibility tags and routes still need on-site validation; the interface does not claim verified accessibility. The elderly journey includes large activity buttons between the starting point and centre choice. Activity filtering uses the original illustrative programme listings, clearly labelled as samples with a reminder to call the centre to confirm. The elderly map uses colourful 3D buildings, green parks, and blue water; the planner retains its original map palette. The planner view retains network scores, route comparisons, and GeoJSON proposals.

The new experience is in `web/senior.js` and `web/senior.css`, using the existing graph and planner code in `web/index.html`. Run the same local preview command above.


### Embedded Street View

“Preview my walk” now opens interactive Google Street View in the app. Previous/Next selects each mapped route segment; “Show map” switches back to the 3D map. Centre details also offer an embedded view. Street View requests outdoor imagery within 50 m of each segment start; this may be a nearby street rather than the exact walking path. Missing imagery is handled by Google's viewer, with the map switch always available. This is not live navigation or a guarantee of imagery coverage.

The local `web/config.js` holds `window.GOOGLE_MAPS_EMBED_KEY` and remains ignored by Git. The dedicated key `sheltered-steps-local-embed` belongs to the existing Google Cloud project `telegram-to-do-469910`, permits only Maps Embed API, and is restricted to `http://localhost:8777/*` and `http://127.0.0.1:8777/*`. A future deployment needs its own allowed origin. No key is stored in the example configuration.
