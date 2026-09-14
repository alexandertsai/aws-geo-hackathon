"""Fetch every Active Ageing Centre (AAC) from AIC's map-items endpoint.

The AIC website's "Find an AAC" map calls POST https://www.aic.sg/api/map-items.
Output: data/aac_centres.json (list of dicts) and data/aac_centres.csv.
"""
import json
import re
import sys
from pathlib import Path

import polars as pl
import requests

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "data" / "aac_centres.json"
OUT_CSV = ROOT / "data" / "aac_centres.csv"
RAW = ROOT / "data" / "aac_raw.json"

AAC_CATEGORY_ID = "fd638c1c-5e23-410f-89f3-70a1c0c32183"
ENDPOINT = "https://www.aic.sg/api/map-items"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Content-Type": "application/json",
    "Origin": "https://www.aic.sg",
    "Referer": "https://www.aic.sg/Care-Services/Active-Ageing-Centres",
}


def fetch_raw() -> dict:
    body = {"language": "en", "first": 1000, "categoryIds": [AAC_CATEGORY_ID]}
    r = requests.post(ENDPOINT, json=body, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.json()


def field(item: dict, name: str):
    for f in item["fields"]:
        if f["name"] == name:
            v = f["jsonValue"]
            return v["value"] if isinstance(v, dict) else v
    return None


def clean_html(s: str | None, sep: str) -> str:
    return re.sub(r"<br ?/?>", sep, s or "").strip()


def parse(raw: dict) -> list[dict]:
    rows = []
    for it in raw["data"]["items"]:
        address = clean_html(field(it, "Address"), ", ")
        m = re.search(r"Singapore (\d{6})", address)
        rows.append(
            {
                "id": it["id"],
                "name": field(it, "Title"),
                "address": address,
                "postal": m.group(1) if m else None,
                "lat": float(field(it, "Latitude")),
                "lng": float(field(it, "Longitude")),
                "phone": field(it, "ContactNumber") or None,
                "email": field(it, "Email") or None,
                "hours": clean_html(field(it, "OperatingHours"), "; ") or None,
                "url": field(it, "WebsiteURL") or None,
                "catchment_postal_codes": [
                    p for p in (field(it, "SelectedPostalCodes") or "").split(";") if p
                ],
            }
        )
    return rows


def main() -> None:
    if RAW.exists() and "--refresh" not in sys.argv:
        raw = json.loads(RAW.read_text())
    else:
        raw = fetch_raw()
        RAW.write_text(json.dumps(raw))
    rows = parse(raw)
    OUT_JSON.write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    df = pl.DataFrame(rows).with_columns(
        pl.col("catchment_postal_codes").list.len().alias("n_catchment_postcodes")
    ).drop("catchment_postal_codes")
    df.write_csv(OUT_CSV)
    print(f"{len(rows)} AACs -> {OUT_JSON.relative_to(ROOT)}, {OUT_CSV.relative_to(ROOT)}")
    print(df.select("name", "postal", "lat", "lng").head(5))


if __name__ == "__main__":
    main()
