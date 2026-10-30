/**
 * El mapa base: el estilo Positron de OpenFreeMap con nuestra paleta encima.
 *
 * Positron trae todo en grises; aquí cada elemento recibe un pastel tenue para
 * reconocer el agua, los parques y las vías sin que le ganen a la ruta. Hay una
 * paleta clara y otra oscura, y una tercera para las etiquetas sobre el satélite.
 */
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { type Map as MapGL, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

// MapLibre busca su worker junto a su propio archivo, y Vite lo mueve al
// empaquetar; con la ruta explícita funciona igual en desarrollo y producción.
setWorkerUrl(workerUrl);

export const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export const SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const SATELLITE_ATTRIBUTION = "Imágenes &copy; Esri";

type PaintName = Parameters<MapGL["setPaintProperty"]>[1];
type Paint = Partial<Record<PaintName, string>>;
type Palette = Record<string, Paint>;

const ROADS_MINOR = ["highway_path", "highway_minor", "road_pier", "tunnel_motorway_inner"];
const ROADS_MAJOR_CASING = ["highway_major_casing", "highway_motorway_casing", "highway_motorway_bridge_casing", "tunnel_motorway_casing"];
const RAILS = ["railway", "railway_transit", "railway_service"];
const RAIL_DASHES = ["railway_dashline", "railway_transit_dashline", "railway_service_dashline"];
const BOUNDARIES = ["boundary_2", "boundary_3", "boundary_disputed"];
const ROAD_LABELS = ["highway-name-path", "highway-name-minor", "highway-name-major"];
const PLACE_LABELS = [
  "label_other",
  "label_village",
  "label_town",
  "label_state",
  "label_city",
  "label_city_capital",
  "label_country_1",
  "label_country_2",
  "label_country_3",
  "airport",
];
const WATER_LABELS = ["waterway_line_label", "water_name_point_label", "water_name_line_label"];

/** Las etiquetas que se ven sobre el satélite; el resto del mapa queda debajo. */
export const LABEL_LAYERS = [...PLACE_LABELS, ...WATER_LABELS];

function each(ids: string[], paint: Paint): Palette {
  return Object.fromEntries(ids.map((id) => [id, paint]));
}

const light: Palette = {
  background: { "background-color": "#f4f3ef" },
  landuse_residential: { "fill-color": "#efede7" },
  park: { "fill-color": "#e1ecd9" },
  landcover_wood: { "fill-color": "#dbe7d3" },
  landcover_ice_shelf: { "fill-color": "#f7f9fb" },
  landcover_glacier: { "fill-color": "#f7f9fb" },
  water: { "fill-color": "#c6deeb" },
  waterway: { "line-color": "#b4d2e3" },
  building: { "fill-color": "#e9e5dd", "fill-outline-color": "#dcd6cb" },
  "aeroway-area": { "fill-color": "#ebe9f0" },
  "aeroway-runway": { "line-color": "#dedbe6" },
  "aeroway-taxiway": { "line-color": "#e4e1ea" },
  "aeroway-runway-casing": { "line-color": "#dedbe6" },
  road_area_pier: { "fill-color": "#f4f3ef" },
  ...each(ROADS_MINOR, { "line-color": "#ffffff" }),
  ...each(ROADS_MAJOR_CASING, { "line-color": "#e9dcc2" }),
  highway_major_inner: { "line-color": "#fff8ea" },
  highway_major_subtle: { "line-color": "#eee3cc" },
  highway_motorway_inner: { "line-color": "#fdeccb" },
  highway_motorway_bridge_inner: { "line-color": "#fdeccb" },
  highway_motorway_subtle: { "line-color": "#f1dfbb" },
  ...each(RAILS, { "line-color": "#d9d6cf" }),
  ...each(RAIL_DASHES, { "line-color": "#f7f6f2" }),
  ...each(BOUNDARIES, { "line-color": "#c2bcb2" }),
  ...each(ROAD_LABELS, { "text-color": "#86817a", "text-halo-color": "#f4f3ef" }),
  ...each(PLACE_LABELS, { "text-color": "#3f3c37", "text-halo-color": "#ffffff" }),
  ...each(WATER_LABELS, { "text-color": "#5a7d96", "text-halo-color": "rgba(255,255,255,0.7)" }),
};

const dark: Palette = {
  background: { "background-color": "#1c1f23" },
  landuse_residential: { "fill-color": "#202328" },
  park: { "fill-color": "#232a27" },
  landcover_wood: { "fill-color": "#242b28" },
  landcover_ice_shelf: { "fill-color": "#2a2e33" },
  landcover_glacier: { "fill-color": "#2a2e33" },
  water: { "fill-color": "#1b3348" },
  waterway: { "line-color": "#24425c" },
  building: { "fill-color": "#272a2f", "fill-outline-color": "#30343a" },
  "aeroway-area": { "fill-color": "#25272d" },
  "aeroway-runway": { "line-color": "#30333a" },
  "aeroway-taxiway": { "line-color": "#2c2f35" },
  "aeroway-runway-casing": { "line-color": "#30333a" },
  road_area_pier: { "fill-color": "#1c1f23" },
  ...each(ROADS_MINOR, { "line-color": "#2c3036" }),
  ...each(ROADS_MAJOR_CASING, { "line-color": "#24262a" }),
  highway_major_inner: { "line-color": "#3a3b3d" },
  highway_major_subtle: { "line-color": "#34363a" },
  highway_motorway_inner: { "line-color": "#4a4437" },
  highway_motorway_bridge_inner: { "line-color": "#4a4437" },
  highway_motorway_subtle: { "line-color": "#3d392f" },
  ...each(RAILS, { "line-color": "#363a40" }),
  ...each(RAIL_DASHES, { "line-color": "#1c1f23" }),
  ...each(BOUNDARIES, { "line-color": "#4a4e55" }),
  ...each(ROAD_LABELS, { "text-color": "#7d828a", "text-halo-color": "#1c1f23" }),
  ...each(PLACE_LABELS, { "text-color": "#d5d8dc", "text-halo-color": "#1c1f23" }),
  ...each(WATER_LABELS, { "text-color": "#7fa6c6", "text-halo-color": "rgba(28,31,35,0.7)" }),
};

const overSatellite: Palette = {
  ...each(PLACE_LABELS, { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,0.75)" }),
  ...each(WATER_LABELS, { "text-color": "#d8ecfa", "text-halo-color": "rgba(0,0,0,0.6)" }),
};

/** Nombres en español cuando el mapa los tiene; si no, en alfabeto latino. */
const SPANISH_NAME: ExpressionSpecification = ["coalesce", ["get", "name:es"], ["get", "name:latin"], ["get", "name"]];

export function useSpanishNames(map: MapGL) {
  for (const id of LABEL_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "text-field", SPANISH_NAME);
  }
}

export function applyPalette(map: MapGL, mode: { dark: boolean; satellite: boolean }) {
  const palette = { ...(mode.dark ? dark : light), ...(mode.satellite ? overSatellite : {}) };
  for (const [id, paint] of Object.entries(palette)) {
    if (!map.getLayer(id)) continue;
    for (const [prop, value] of Object.entries(paint)) map.setPaintProperty(id, prop as PaintName, value);
  }
}

/**
 * MapLibre no entiende `oklch()`, y los colores de la app están en oklch.
 * Convierte "oklch(0.64 0.17 38)" (con alfa opcional) a "rgb(…)".
 */
export function oklchToRgb(value: string): string {
  const m = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)/);
  if (!m) return value;
  const [L, C, H] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const [r, g, bl] = linear.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
  return m[4] ? `rgba(${r}, ${g}, ${bl}, ${m[4]})` : `rgb(${r}, ${g}, ${bl})`;
}
