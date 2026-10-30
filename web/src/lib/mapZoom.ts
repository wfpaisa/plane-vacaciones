/**
 * Cuánto se acerca el mapa al ir a un lugar, una ruta o una ciudad: el nivel
 * central es el encuadre de siempre y cada paso suma o resta un nivel de zoom.
 */
export const MAP_ZOOM_KEY = "vacaciones-mapa-zoom";
const DEFAULT = 2;
const LEVELS = 5;

export function normalizeMapZoom(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(4, Math.round(value))) : DEFAULT;
}

export function readMapZoom(): number {
  try {
    const stored = localStorage.getItem(MAP_ZOOM_KEY);
    return stored === null || stored.trim() === "" ? DEFAULT : normalizeMapZoom(Number(stored));
  } catch { return DEFAULT; }
}

export function saveMapZoom(value: number) {
  try { localStorage.setItem(MAP_ZOOM_KEY, String(normalizeMapZoom(value))); } catch {}
}

/**
 * Niveles de zoom que se suman al encuadre predeterminado. Alejarse llega
 * más lejos que acercarse: hasta ver el lugar entre sus alrededores.
 */
const OFFSETS = [-3, -1.5, 0, 1, 2];
export const mapZoomOffset = (level: number) => OFFSETS[normalizeMapZoom(level)];

/** La ruta ya cabe completa: al alejar la vista general basta con duplicar el ancho visible. */
export function mapOverviewZoomOffset(level: number): number {
  const offset = mapZoomOffset(level);
  return offset < 0 ? offset / 3 : offset;
}

/** Nivel de OpenStreetMap al que se acerca un lugar elegido, sin ajuste. */
export const PLACE_ZOOM = 15;

function distance(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km.toLocaleString("es-CO", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

/**
 * Cada nivel dicho como la escala que se tiene al llegar a un lugar: los
 * metros por píxel de ese zoom a esa latitud, por el ancho libre del mapa.
 */
export function mapZoomLabels(lat: number, width: number, baseZoom = PLACE_ZOOM): string[] {
  const cos = Math.cos((Math.max(-85, Math.min(85, Number.isFinite(lat) ? lat : 0)) * Math.PI) / 180);
  const px = Math.max(160, width || 0);
  return Array.from({ length: LEVELS }, (_, level) => distance((156543.03 * cos * px) / 2 ** (baseZoom + OFFSETS[level])));
}
