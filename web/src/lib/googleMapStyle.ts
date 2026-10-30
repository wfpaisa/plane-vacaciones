export const DARK_WATER = "#244860";
export const LIGHT_BACKGROUND = "#e5e3df";

export const MAP_COLOR_OPTIONS = ["Actual", "Grafito", "Azul noche", "Verde salvia", "Arena", "Lavanda", "Ártico", "Terracota", "Obsidiana", "Petróleo", "Ciruela", "Cobre", "Marfil", "Menta", "Rosa cuarzo", "Azul bruma", "Gris perla"];
const palettes = [
  ["#252a31", "#313840", "#58616d", "#323f3b", "#18232e", "#e4e7eb", "#858c98"],
  ["#202f46", "#293c55", "#5f7795", "#304c4d", "#10283d", "#dce8f5", "#92a8c4"],
  ["#35433e", "#41514a", "#71877a", "#45634b", "#24454a", "#e3ece5", "#a3ad87"],
  ["#e9e3d8", "#ded5c5", "#faf7f0", "#cdd8ba", "#a9c9d0", "#4a504f", "#c2ab81"],
  ["#39364b", "#47435b", "#7f7899", "#46544f", "#292f50", "#ebe6f5", "#b0a3c0"],
  ["#edf2f4", "#dee7ec", "#ffffff", "#d0e3d9", "#b1d6e5", "#465b6b", "#afc4d2"],
  ["#eaded6", "#ddcdc1", "#fff5ee", "#c7d2b6", "#a8c5c8", "#594d48", "#c2957b"],
  ["#1f2226", "#292d32", "#596169", "#303e35", "#17282e", "#e3e6e8", "#959b9e"],
  ["#263e43", "#304c51", "#68868a", "#3c5b49", "#16343f", "#dfedef", "#a0ac8b"],
  ["#3e3042", "#503d53", "#8b718d", "#46564b", "#292b45", "#f1e3ee", "#b39a9e"],
  ["#44352f", "#55423a", "#977966", "#4c5841", "#293e47", "#f2e7db", "#c29870"],
  ["#f4efe5", "#e6dfd1", "#ffffff", "#d8e2c5", "#bbdce1", "#55584f", "#d6c39e"],
  ["#e5efe9", "#d3e1d9", "#fcfffd", "#bdd6c1", "#add5d9", "#435c53", "#b3c4a1"],
  ["#f1e7e9", "#e5d7dc", "#fffafb", "#d5dfcb", "#bbcfdc", "#655663", "#d3b5b1"],
  ["#e4edf4", "#d2dfe9", "#f8fcff", "#c8ddd3", "#aacddd", "#405a70", "#bac8d5"],
  ["#ebedef", "#dadee2", "#ffffff", "#d1ddd2", "#b9cdd7", "#505a65", "#c3c7cb"],
];
export function readMapColor() {
  try { const value = Number(localStorage.getItem("vacaciones-mapa-color")); return Number.isInteger(value) && value >= 0 && value < MAP_COLOR_OPTIONS.length ? value : 0; } catch { return 0; }
}
export function googleMapHeaderTone(palette: number) {
  return palettes[palette - 1]?.[0];
}
export function googleMapBackground(dark: boolean, palette = 0) {
  return palettes[palette - 1]?.[4] ?? (dark ? DARK_WATER : LIGHT_BACKGROUND);
}
export function paletteStyles(index: number): google.maps.MapTypeStyle[] {
  const p = palettes[index - 1];
  if (!p) return [];
  const [land, building, road, park, water, text, highway] = p;
  const color = (featureType: string, elementType: string, value: string): google.maps.MapTypeStyle => ({ featureType, elementType, stylers: [{ color: value }] });
  return [
    color("landscape", "geometry", land),
    color("landscape.man_made", "geometry", building),
    color("poi", "geometry", building), color("poi.park", "geometry", park),
    color("road", "geometry.fill", road), color("road", "geometry.stroke", building),
    color("road.highway", "geometry.fill", highway),
    color("transit", "geometry", road), color("water", "geometry", water),
    color("administrative", "geometry.stroke", road),
    color("all", "labels.text.fill", text), color("all", "labels.text.stroke", land),
    { elementType: "labels.icon", stylers: [{ saturation: -65 }] },
  ];
}

/** Colores por superficie: las calles y edificios siguen siendo legibles en oscuro. */
const dark: google.maps.MapTypeStyle[] = [
  { featureType: "landscape", elementType: "geometry.fill", stylers: [{ color: "#303c49" }] },
  { featureType: "landscape", elementType: "geometry.stroke", stylers: [{ color: "#303c49" }] },
  { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#3d4c5a" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#465866" }] },
  { featureType: "poi", elementType: "geometry.fill", stylers: [{ color: "#374b50" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#38564b" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#6a8090" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#344756" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#a6a47d" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#6d725e" }] },
  { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#586e80" }] },
  { featureType: "transit", elementType: "geometry.fill", stylers: [{ color: "#718696" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#7d8e9c" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: DARK_WATER }] },
  { featureType: "water", elementType: "geometry.stroke", stylers: [{ color: DARK_WATER }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#e3ebf1" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#303c49" }, { weight: 2 }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#b9d8e8" }] },
];

export function googleMapStyles(satellite: boolean, detail: number, isDark: boolean, palette = 0, countryView = true): google.maps.MapTypeStyle[] {
  const show = (featureType: string): google.maps.MapTypeStyle => ({ featureType, elementType: "labels", stylers: [{ visibility: "on" }] });
  const colors = palettes[palette - 1];
  const land = colors?.[0] ?? (isDark ? "#303c49" : "#f5f3ef");
  const road = colors?.[2] ?? (isDark ? "#6a8090" : "#ffffff");
  const text = colors?.[5] ?? (isDark ? "#e3ebf1" : "#505862");
  const blend = (foreground: string, amount: number) => {
    const channels = [1, 3, 5].map(i => Math.round(parseInt(land.slice(i, i + 2), 16) * (1 - amount) + parseInt(foreground.slice(i, i + 2), 16) * amount));
    return "#" + channels.map(c => c.toString(16).padStart(2, "0")).join("");
  };
  const roadStrength = [0.121, 0.2178, 0.4235, 0.847][detail] ?? 1;
  return [
    ...(!satellite ? (palette > 0 ? paletteStyles(palette) : isDark ? dark : []) : []),
    ...(!satellite && countryView && detail < 4 ? [
      ...["road", "road.highway", "road.highway.controlled_access", "road.arterial", "road.local"].flatMap(featureType => [
        { featureType, elementType: "geometry.fill", stylers: [{ color: blend(road, roadStrength) }] },
        { featureType, elementType: "geometry.stroke", stylers: [{ color: blend(road, roadStrength * 0.4) }] },
      ]),
      { featureType: "transit", elementType: "geometry", stylers: [{ color: blend(road, roadStrength * 0.6) }] },
      { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ visibility: "on" }, { color: blend(text, detail <= 1 ? 0.364 : 0.28) }, { weight: detail <= 1 ? 1.6 : 1.2 }] },
      { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ visibility: detail <= 1 ? "off" : "on" }] },
    ] : []),
    { elementType: "labels", stylers: [{ visibility: detail >= 4 ? "on" : "off" }] },
    ...(detail >= 1 && detail < 4 ? [show("administrative.country"), show("water")] : []),
    ...(detail >= 2 && detail < 4 ? [show("administrative.province"), show("administrative.locality")] : []),
    ...(detail >= 3 && detail < 4 ? [show("road"), show("administrative.neighborhood"), show("landscape")] : []),
  ];
}
