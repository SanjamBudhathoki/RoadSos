import { logger } from "../utils/logger.js";

// ─── Config ────────────────────────────────────────────────────────────────
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY; // add to .env
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map();

// ─── Overpass (free fallback) ───────────────────────────────────────────────
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const OVERPASS_FILTERS = {
  hospital: ['node["amenity"="hospital"]', 'way["amenity"="hospital"]'],
  police:   ['node["amenity"="police"]',   'way["amenity"="police"]'],
  ambulance: [
    'node["emergency"="ambulance_station"]',
    'way["emergency"="ambulance_station"]',
    'node["amenity"="hospital"]',
    'way["amenity"="hospital"]',
  ],
  rescue: [
    'node["shop"="car_repair"]',
    'way["shop"="car_repair"]',
    'node["amenity"="car_repair"]',
    'way["amenity"="car_repair"]',
  ],
};

// Geoapify category strings — verified against their Places API docs
const GEOAPIFY_CATEGORIES = {
  hospital:  "healthcare.hospital",
  police:    "service.police",
  ambulance: "emergency.ambulance_station,healthcare.hospital",
  rescue:    "service.vehicle.repair",
};

const FALLBACK_NAME = {
  hospital:  "Unnamed Hospital",
  police:    "Unnamed Police Station",
  ambulance: "Ambulance Station",
  rescue:    "Vehicle Repair / Rescue Shop",
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

// ─── Geoapify provider ───────────────────────────────────────────────────────
async function queryGeoapify(type, lat, lon, radius) {
  const categories = GEOAPIFY_CATEGORIES[type];
  const url =
    `https://api.geoapify.com/v2/places` +
    `?categories=${encodeURIComponent(categories)}` +
    `&filter=circle:${lon},${lat},${radius}` +
    `&bias=proximity:${lon},${lat}` +
    `&limit=20` +
    `&apiKey=${GEOAPIFY_KEY}`;

  const res = await fetchWithTimeout(url, {}, 10000);
  if (!res.ok) throw new Error(`Geoapify HTTP ${res.status}`);
  const json = await res.json();

  return (json.features || []).map((f) => {
    const p = f.properties;
    const [fLon, fLat] = f.geometry.coordinates;
    return {
      id: `geoapify/${p.place_id || Math.random()}`,
      name: p.name || FALLBACK_NAME[type],
      type,
      latitude: fLat,
      longitude: fLon,
      distanceKm: Math.round(haversineKm(lat, lon, fLat, fLon) * 100) / 100,
      address: p.formatted || p.address_line1 || null,
      phone: p.contact?.phone || p.datasource?.raw?.phone || null,
      openingHours: p.opening_hours || null,
      isAmbulanceStation: (p.categories || []).some((c) =>
        c.includes("ambulance")
      ),
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

// ─── Overpass provider ───────────────────────────────────────────────────────
function buildOverpassQuery(type, lat, lon, radius) {
  const clauses = OVERPASS_FILTERS[type]
    .map((f) => `${f}(around:${radius},${lat},${lon});`)
    .join("\n");
  return `[out:json][timeout:20];(${clauses});out center;`;
}

function parseOverpassElements(elements, type, originLat, originLon) {
  const seen = new Set();
  const results = [];
  for (const el of elements) {
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = el.tags || {};
    const addressParts = [
      tags["addr:housenumber"],
      tags["addr:street"],
      tags["addr:suburb"] || tags["addr:city"],
    ].filter(Boolean);
    results.push({
      id,
      name: tags.name || tags["name:en"] || FALLBACK_NAME[type],
      type,
      latitude: lat,
      longitude: lon,
      distanceKm:
        Math.round(haversineKm(originLat, originLon, lat, lon) * 100) / 100,
      address: addressParts.join(", ") || tags["addr:full"] || null,
      phone:
        tags.phone || tags["contact:phone"] || tags["emergency:phone"] || null,
      openingHours: tags.opening_hours || null,
      isAmbulanceStation: tags.emergency === "ambulance_station",
    });
  }
  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

async function queryOverpass(type, lat, lon, radius) {
  const query = buildOverpassQuery(type, lat, lon, radius);
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
        },
        12000
      );
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} from ${endpoint}`);
        logger.warn("Overpass endpoint failed", { endpoint, status: res.status });
        lastError = err;
        continue;
      }
      const json = await res.json();
      return parseOverpassElements(json.elements || [], type, lat, lon);
    } catch (err) {
      logger.warn("Overpass endpoint error", { endpoint, error: err.message });
      lastError = err;
    }
  }
  throw lastError;
}

// ─── Public API ─────────────────────────────────────────────────────────────
export async function findNearby({
  type,
  latitude,
  longitude,
  radius = 5000,
  limit = 10,
}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  const roundedLat = lat.toFixed(3);
  const roundedLon = lon.toFixed(3);
  const cacheKey = `${type}:${roundedLat}:${roundedLon}:${radius}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.info("findNearby cache hit", { type });
    return cached.data.slice(0, limit);
  }

  // Try Geoapify first (key-based, won't 429 randomly)
  if (GEOAPIFY_KEY) {
    try {
      logger.info("findNearby: trying Geoapify", { type });
      const results = await queryGeoapify(type, lat, lon, radius);
      cache.set(cacheKey, { timestamp: Date.now(), data: results });
      logger.info("findNearby: Geoapify success", { type, count: results.length });
      return results.slice(0, limit);
    } catch (err) {
      logger.warn("findNearby: Geoapify failed, falling back to Overpass", {
        type,
        error: err.message,
      });
    }
  }

  // Fallback: Overpass mirrors
  try {
    logger.info("findNearby: trying Overpass", { type });
    const results = await queryOverpass(type, lat, lon, radius);
    cache.set(cacheKey, { timestamp: Date.now(), data: results });
    logger.info("findNearby: Overpass success", { type, count: results.length });
    return results.slice(0, limit);
  } catch (error) {
    logger.error("findNearby: all providers failed", { type, error: error.message });
    if (cached) {
      logger.warn("findNearby: serving stale cache", { type });
      return cached.data.slice(0, limit);
    }
    throw error;
  }
}