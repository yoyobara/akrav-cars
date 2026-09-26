/**
 * Reverse geocoding via Nominatim (SPEC §9): no API key, no billing, but a
 * strict usage policy — at most one request per second and a real User-Agent.
 *
 * Every call therefore goes through this module, which serialises upstream
 * requests and caches results. Addresses are additionally persisted per
 * parking report in `address_cached`, so a report is only ever geocoded once.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 4000;
const CACHE_MAX = 500;

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "akrav-cars/0.1 (family car coordination app)";

// ~11 m buckets: dragging the pin a few metres reuses the same lookup.
const cacheKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

const cache = new Map<string, string | null>();
let lastCallAt = 0;
let chain: Promise<unknown> = Promise.resolve();

/** Runs `fn` after the previous upstream call, never faster than 1/sec. */
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  // Keep the chain alive even if this link rejects.
  chain = run.catch(() => undefined);
  return run;
}

/** A short human label such as "Rothschild 12, Tel Aviv", or null. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const address = await throttle(() => fetchAddress(lat, lng)).catch(() => null);

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, address);
  return address;
}

async function fetchAddress(lat: number, lng: number): Promise<string | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "he,en" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    address?: Record<string, string>;
    display_name?: string;
  };

  return shortLabel(body.address) ?? body.display_name ?? null;
}

/** "Rothschild 12, Tel Aviv" rather than Nominatim's full display_name. */
function shortLabel(a?: Record<string, string>): string | null {
  if (!a) return null;

  const street = a.road ?? a.pedestrian ?? a.footway ?? a.neighbourhood;
  const street_with_number = street && a.house_number ? `${street} ${a.house_number}` : street;
  const place = a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality;

  const parts = [street_with_number, place].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
