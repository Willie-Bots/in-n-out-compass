#!/usr/bin/env python3
"""Scrape public In-N-Out locations by numeric store id.

The location site resolves URLs like /1, /2, ... for valid stores.
This script probes ids and extracts coordinates/address from store pages.
"""

from __future__ import annotations
import json
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path

import requests

BASE = "https://locations.in-n-out.com"


@dataclass
class Location:
    id: str
    slug: str
    name: str
    city_state: str
    address_line: str
    zip_code: str
    latitude: float
    longitude: float
    url: str
    image_url: str


def normalize_whitespace(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def parse_store_page(url: str, html: str) -> Location | None:
    # valid pages have map coordinates and street-address h3
    lat_m = re.search(r'data-latitude="([^"]+)"', html)
    lng_m = re.search(r'data-longitude="([^"]+)"', html)
    h3_m = re.search(r'<h3 class="street-address">(.*?)</h3>', html, re.S)
    title_m = re.search(r"<title>(.*?)</title>", html, re.S)
    img_m = re.search(r'<img src="([^"]+)" alt="In-N-Out Burger - [^"]+" class="store-image"', html)

    if not (lat_m and lng_m and h3_m):
        return None

    # pull numeric id from URL path or fallback title slug
    path = url.replace(BASE, "").strip("/")
    id_m = re.match(r"^(\d+)", path)
    if not id_m:
        return None
    store_id = id_m.group(1)

    h3 = normalize_whitespace(re.sub(r"<[^>]+>", " ", h3_m.group(1)))
    city_state, address_zip = h3, ""
    if " - " in h3:
        city_state, address_zip = h3.split(" - ", 1)

    address_line, zip_code = address_zip, ""
    mzip = re.search(r"^(.*?),\s*(\d{5})(?:-\d{4})?$", address_zip)
    if mzip:
        address_line = normalize_whitespace(mzip.group(1))
        zip_code = mzip.group(2)

    name = "In-N-Out Burger"
    if title_m:
        t = normalize_whitespace(re.sub(r"<[^>]+>", "", title_m.group(1)))
        if " - " in t:
            name = t.split(" - ", 1)[0]

    image_url = img_m.group(1) if img_m else ""
    if image_url.startswith("/"):
        image_url = BASE + image_url

    try:
        lat = float(lat_m.group(1))
        lng = float(lng_m.group(1))
    except ValueError:
        return None

    return Location(
        id=store_id,
        slug=path,
        name=name,
        city_state=normalize_whitespace(city_state),
        address_line=normalize_whitespace(address_line),
        zip_code=zip_code,
        latitude=lat,
        longitude=lng,
        url=url,
        image_url=image_url,
    )


def scrape_by_ids(max_id: int = 1200, stop_after_consecutive_miss: int = 180) -> dict[str, Location]:
    s = requests.Session()
    s.headers.update({"User-Agent": "Mozilla/5.0 (compatible; in-n-out-compass/1.0)"})

    found: dict[str, Location] = {}
    misses = 0

    for i in range(1, max_id + 1):
        url = f"{BASE}/{i}"
        try:
            r = s.get(url, timeout=12)
            html = r.text if r.status_code == 200 else ""
        except Exception:
            html = ""

        loc = parse_store_page(url, html) if html else None
        if loc:
            found[loc.id] = loc
            misses = 0
        else:
            misses += 1

        if i % 100 == 0:
            print(f"checked={i} found={len(found)} misses={misses}")

        if misses >= stop_after_consecutive_miss and i > 300:
            print(f"Stopping early after {misses} consecutive misses at id={i}")
            break

        time.sleep(0.03)

    return found


def main() -> None:
    out_path = Path(__file__).resolve().parent / "locations.json"
    found = scrape_by_ids()

    data = {
        "source": "https://locations.in-n-out.com/",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(found),
        "locations": [asdict(v) for _, v in sorted(found.items(), key=lambda kv: int(kv[0]))],
    }

    out_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} with {len(found)} locations")


if __name__ == "__main__":
    main()
