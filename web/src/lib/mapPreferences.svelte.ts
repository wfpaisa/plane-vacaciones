import { readMapColor } from "./googleMapStyle";

export const MAP_LIGHT_COLORS = [6, 0, 4, 7, 12, 13, 14, 15, 16];
export const MAP_DARK_COLORS = [2, 0, 1, 3, 5, 8, 9, 10, 11];
function read(mode: "light" | "dark", options: number[]) {
  const fallback = options[0];
  try {
    const key = `vacaciones-mapa-color-${mode}`;
    const migrationKey = `${key}-defaults-v2`;
    const stored = localStorage.getItem(key);
    const value = stored === null ? readMapColor() : Number(stored);
    const migrated = localStorage.getItem(migrationKey) === "yes";
    const selected = options.includes(value) && (value !== 0 || migrated) ? value : fallback;
    localStorage.setItem(key, String(selected));
    localStorage.setItem(migrationKey, "yes");
    return selected;
  } catch { return fallback; }
}
class MapPreferences {
  light = $state(read("light", MAP_LIGHT_COLORS));
  dark = $state(read("dark", MAP_DARK_COLORS));
  set(mode: "light" | "dark", value: number) {
    const options = mode === "dark" ? MAP_DARK_COLORS : MAP_LIGHT_COLORS;
    if (!options.includes(value)) return;
    this[mode] = value;
    try { localStorage.setItem(`vacaciones-mapa-color-${mode}`, String(value)); } catch {}
  }
}
export const mapPreferences = new MapPreferences();
