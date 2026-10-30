import { pb } from "./pb";

/** Google Places a través del servidor; Nominatim cuando no está disponible. */
export interface GeoResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: string;
  provider?: "google";
  placeId?: string;
}

const BASE = "https://nominatim.openstreetmap.org";

type Raw = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
  class?: string;
};

const toResult = (r: Raw): GeoResult => ({
  name: r.name || r.display_name.split(",")[0],
  address: r.display_name,
  lat: Number(r.lat),
  lng: Number(r.lon),
  kind: r.type ?? r.class ?? "",
});

export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  try {
    const response = await pb.send<{ provider: string; results?: GeoResult[] }>("/api/vacaciones/google/search", {
      method: "GET", query: { q: query, ...(near ? { lat: near.lat, lng: near.lng } : {}) }, signal,
    });
    if (response.provider === "google") return response.results ?? [];
  } catch (err) {
    if (signal?.aborted) throw err;
  }
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "6",
    "accept-language": "es",
  });
  if (near && (near.lat || near.lng)) {
    // Prefiere lo cercano al destino, sin dejar fuera lo demás.
    const d = 1.5;
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`${BASE}/search?${params}`, { signal });
  if (!res.ok) throw new Error("No se pudo buscar el lugar.");
  return ((await res.json()) as Raw[]).map(toResult);
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    "accept-language": "es",
    zoom: "18",
  });
  const res = await fetch(`${BASE}/reverse?${params}`);
  if (!res.ok) return null;
  const raw = (await res.json()) as Raw & { error?: string };
  return raw.error ? null : toResult(raw);
}

/** Distancia en km en línea recta. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const hasCoords = (p: { lat: number; lng: number }) => !!(p.lat || p.lng);
