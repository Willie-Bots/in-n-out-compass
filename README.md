# In-N-Out Compass (basic app)

A simple web app that:
1. gets your current location,
2. finds the nearest In-N-Out,
3. points a compass needle toward it.

## Data source
Location data is scraped from public In‑N‑Out location pages on:
- https://locations.in-n-out.com/

Generated data file:
- `locations.json` (currently 432 locations)

## Files
- `index.html` – UI
- `styles.css` – styling
- `app.js` – geolocation + compass math
- `locations.json` – scraped store data
- `scrape_innout_locations.py` – refresh location data

## Run locally
From this folder, run any static server, for example:

```bash
python3 -m http.server 8080
```

Then open:
- `http://localhost:8080`

## Refresh location data
```bash
python3 scrape_innout_locations.py
```

## Notes
- Compass heading support depends on the device/browser.
- On iOS Safari, motion permission is requested after clicking the start button.
- If heading is unavailable, the app still shows nearest location + distance + bearing.
