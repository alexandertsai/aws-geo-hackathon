"""Refresh the Toa Payoh ATM and community-centre snapshot from OpenStreetMap."""
import json
import re
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
QUERY = '''[out:json][timeout:40];
(nwr["amenity"~"^(atm|community_centre)$"](1.326,103.838,1.345,103.862);
nwr["amenity"="bank"]["atm"="yes"](1.326,103.838,1.345,103.862););
out center tags;'''


def main():
    for endpoint in ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter']:
        try:
            response = requests.post(endpoint, data={'data': QUERY}, timeout=50)
            response.raise_for_status()
            elements = response.json()['elements']
            break
        except (requests.RequestException, ValueError, KeyError):
            continue
    else:
        raise SystemExit('Nearby data unavailable; existing snapshot preserved.')
    places = []
    for element in elements:
        tags = element.get('tags', {})
        centre = element.get('center', element)
        if 'lat' not in centre or 'lon' not in centre:
            continue
        kind = 'community' if tags.get('amenity') == 'community_centre' else 'atm'
        name = tags.get('name') or tags.get('brand') or tags.get('operator') or ('ATM' if kind == 'atm' else 'Community centre')
        if kind == 'community' and not re.search(r'community (club|cent[er]+)|\bCC\b', name, re.I):
            continue
        address = ' '.join(filter(None, [tags.get('addr:housenumber'), tags.get('addr:street')]))
        if kind == 'community' and address and any(p['kind'] == kind and p['address'] == address for p in places):
            continue
        if kind == 'atm' and 'atm' not in name.lower():
            name += ' ATM'
        places.append({'id': f"{element['type']}/{element['id']}", 'kind': kind, 'name': name,
                       'lat': centre['lat'], 'lng': centre['lon'],
                       'address': address,
                       'hours': tags.get('opening_hours', ''), 'access': tags.get('access', '')})
    result = {'source': 'OpenStreetMap contributors', 'sourceURL': 'https://www.openstreetmap.org/copyright',
              'updated': datetime.now(timezone.utc).date().isoformat(), 'places': places}
    (ROOT / 'web/data/nearby.json').write_text(json.dumps(result, indent=2))
    print(f"Saved {sum(p['kind'] == 'atm' for p in places)} ATMs and {sum(p['kind'] == 'community' for p in places)} community places.")


if __name__ == '__main__':
    main()
