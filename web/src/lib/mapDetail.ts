export const MAP_DETAIL_LABELS = ["Sin nombres", "Países", "Ciudades", "Calles", "Todo"] as const;
export const MAP_DETAIL_KEY = "vacaciones-mapa-detalle";

export function normalizeMapDetail(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(4, Math.round(value))) : 2;
}

export function readMapDetail(): number {
  try {
    const stored = localStorage.getItem(MAP_DETAIL_KEY);
    if (stored !== null && stored.trim() !== "" && Number.isInteger(Number(stored)) && Number(stored) >= 0 && Number(stored) <= 4) return Number(stored);
    return localStorage.getItem("vacaciones-mapa-nombres") === "no" ? 0 : 2;
  } catch { return 2; }
}

export function saveMapDetail(value: number) {
  try { localStorage.setItem(MAP_DETAIL_KEY, String(normalizeMapDetail(value))); } catch {}
}

/** Solo las etiquetas del mapa base; los marcadores del viaje se conservan. */
export function mapLibreLabelDetail(layerId: string): number {
  if (/label_country/.test(layerId)) return 1;
  if (/label_(state|city)/.test(layerId)) return 2;
  if (/label_(town|village|other)|highway.*name|water.*label/.test(layerId)) return 3;
  return 4;
}
