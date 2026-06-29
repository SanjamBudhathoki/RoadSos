import { logger } from "../utils/logger.js";

// Public Overpass mirrors — tries each in order so a single instance
// being slow/down during judging doesn't kill the demo.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map();

const FILTERS = {
  hospital: ['node["amenity"="hospital"]', 'way["amenity"="hospital"]'],
  police: ['node["amenity"="police"]', 'way["amenity"="police"]'],
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

const FALLBACK_NAME = {
  hospital: "Unnamed Hospital",
  police: "Unnamed Police Station",
  ambulance: "Ambulance Station",
  rescue: "Vehicle Repair / Rescue Shop",
};

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

function buildQuery(type, lat, lon, radius) {
  const clauses = FILTERS[type]
    .map((f) => `${f}(around:${radius},${lat},${lon});`)
    .join("\n");
  return `[out:json][timeout:20];(${clauses});out center;`;
}

function parseElements(elements, type, originLat, originLon) {
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
      phone: tags.phone || tags["contact:phone"] || tags["emergency:phone"] || null,
      openingHours: tags.opening_hours || null,
      isAmbulanceStation: tags.emergency === "ambulance_station",
    });
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

async function queryOverpass(query) {
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${endpoint}`);
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }
  throw lastError;
}

export async function findNearby({ type, latitude, longitude, radius = 5000, limit = 10 }) {
  const roundedLat = Number(latitude).toFixed(3);
  const roundedLon = Number(longitude).toFixed(3);
  const cacheKey = `${type}:${roundedLat}:${roundedLon}:${radius}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data.slice(0, limit);
  }

  try {
    const json = await queryOverpass(buildQuery(type, latitude, longitude, radius));
    const results = parseElements(json.elements || [], type, Number(latitude), Number(longitude));
    cache.set(cacheKey, { timestamp: Date.now(), data: results });
    return results.slice(0, limit);
  } catch (error) {
    logger.error("findNearby (overpass) error", { type, error: error.message });
    if (cached) return cached.data.slice(0, limit); // serve stale data over nothing
    throw error;
  }
}