"""Thin OneMap client. Search works without a token; routing needs one.

Set ONEMAP_EMAIL and ONEMAP_PASSWORD (or ONEMAP_TOKEN) in the environment.
"""
import os
from functools import lru_cache

import requests

BASE = "https://www.onemap.gov.sg/api"


@lru_cache
def token() -> str | None:
    if t := os.environ.get("ONEMAP_TOKEN"):
        return t
    email, pw = os.environ.get("ONEMAP_EMAIL"), os.environ.get("ONEMAP_PASSWORD")
    if not (email and pw):
        return None
    r = requests.post(f"{BASE}/auth/post/getToken", json={"email": email, "password": pw}, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


def _headers() -> dict:
    t = token()
    return {"Authorization": f"Bearer {t}"} if t else {}


def search(q: str) -> list[dict]:
    r = requests.get(
        f"{BASE}/common/elastic/search",
        params={"searchVal": q, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": 1},
        headers=_headers(),
        timeout=20,
    )
    r.raise_for_status()
    return r.json().get("results", [])


def walk_route(start: tuple[float, float], end: tuple[float, float]) -> dict:
    """Baseline OneMap walking route (lat, lng pairs). Requires a token."""
    if not token():
        raise RuntimeError("OneMap routing needs ONEMAP_TOKEN or ONEMAP_EMAIL/ONEMAP_PASSWORD")
    r = requests.get(
        f"{BASE}/public/routingsvc/route",
        params={"start": f"{start[0]},{start[1]}", "end": f"{end[0]},{end[1]}", "routeType": "walk"},
        headers=_headers(),
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    for x in search("79 Toa Payoh Central")[:3]:
        print(x["ADDRESS"], x["LATITUDE"], x["LONGITUDE"])
    print("token available:", bool(token()))
