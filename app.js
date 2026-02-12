const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");
const targetEl = document.getElementById("target");
const distEl = document.getElementById("distance");
const distanceLineEl = document.getElementById("distanceLine");
const bearingEl = document.getElementById("bearing");
const needleEl = document.getElementById("needle");

let locations = [];
let userPos = null;
let headingDeg = null; // 0 = north
let nearest = null;

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function haversineMiles(a, b) {
  const R = 3958.8; // miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function initialBearing(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function updateNearest() {
  if (!userPos || !locations.length) return;

  let best = null;
  for (const loc of locations) {
    const d = haversineMiles(userPos, { lat: loc.latitude, lon: loc.longitude });
    if (!best || d < best.distanceMiles) {
      best = { loc, distanceMiles: d };
    }
  }

  if (!best) return;

  const bearing = initialBearing(userPos, {
    lat: best.loc.latitude,
    lon: best.loc.longitude,
  });

  nearest = { ...best, bearingDeg: bearing };

  targetEl.textContent = `Nearest: ${best.loc.city_state} — ${best.loc.address_line}`;
  const milesText = `${best.distanceMiles.toFixed(2)} mi away`;
  distEl.textContent = `Distance: ${best.distanceMiles.toFixed(2)} mi`;
  if (distanceLineEl) distanceLineEl.textContent = milesText;
  bearingEl.textContent = `Bearing to target: ${bearing.toFixed(1)}°`;

  renderNeedle();
}

function renderNeedle() {
  if (!nearest) return;

  // If heading available: rotate by relative angle.
  // If not: use absolute bearing (needle points as if top=North)
  const angle = headingDeg == null ? nearest.bearingDeg : nearest.bearingDeg - headingDeg;
  needleEl.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
}

function onGeoSuccess(pos) {
  userPos = {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
  };
  statusEl.textContent = "Location enabled";
  updateNearest();
}

function onGeoError(err) {
  statusEl.textContent = `Location error: ${err.message}`;
}

function startGeolocation() {
  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocation not supported on this device.";
    return;
  }

  navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 30000,
  });

  navigator.geolocation.watchPosition(onGeoSuccess, onGeoError, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 15000,
  });
}

async function startCompass() {
  // iOS requires user gesture + permission request
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state !== "granted") {
        statusEl.textContent += " | Compass permission denied";
        return;
      }
    } catch {
      statusEl.textContent += " | Compass permission failed";
      return;
    }
  }

  window.addEventListener("deviceorientationabsolute", onOrientation, true);
  window.addEventListener("deviceorientation", onOrientation, true);
}

function onOrientation(e) {
  // alpha in degrees clockwise from North on some platforms
  let heading = null;

  if (typeof e.webkitCompassHeading === "number") {
    heading = e.webkitCompassHeading; // iOS Safari
  } else if (typeof e.alpha === "number") {
    heading = 360 - e.alpha;
  }

  if (heading == null || Number.isNaN(heading)) return;

  headingDeg = ((heading % 360) + 360) % 360;
  renderNeedle();
}

async function loadLocations() {
  const res = await fetch("./locations.json");
  if (!res.ok) throw new Error("Failed to load locations.json");
  const data = await res.json();
  locations = data.locations || [];
  statusEl.textContent = "Ready";
}

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  try {
    if (!locations.length) {
      await loadLocations();
    }
    startGeolocation();
    await startCompass();
  } catch (err) {
    statusEl.textContent = `Startup error: ${err.message}`;
  } finally {
    startBtn.disabled = false;
  }
});

loadLocations().catch(() => {
  statusEl.textContent = "Could not pre-load locations. Tap start to retry.";
});
