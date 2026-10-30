import { afterEach, expect, test } from "bun:test";
import { MAP_DETAIL_KEY, normalizeMapDetail, readMapDetail, saveMapDetail, mapLibreLabelDetail } from "../web/src/lib/mapDetail";
import { googleMapStyles } from "../web/src/lib/googleMapStyle";

const original = globalThis.localStorage;
afterEach(() => { globalThis.localStorage = original; });
function storage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  globalThis.localStorage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value) } as unknown as Storage;
  return entries;
}
function googleVisible(level: number, feature: string) {
  let visible = true;
  for (const style of googleMapStyles(false, level, true)) {
    if (style.elementType !== "labels") continue;
    if (style.featureType && style.featureType !== feature && !feature.startsWith(style.featureType + ".")) continue;
    for (const styler of style.stylers ?? []) if (styler.visibility) visible = styler.visibility !== "off";
  }
  return visible;
}

test("el nivel bajo despeja ciudades, calles y comercios; Todo los recupera", () => {
  for (const feature of ["administrative.country", "administrative.locality", "road.local", "poi.business"]) {
    expect(googleVisible(0, feature)).toBe(false);
    expect(googleVisible(4, feature)).toBe(true);
  }
  expect(googleVisible(1, "administrative.country")).toBe(true);
  expect(googleVisible(1, "administrative.locality")).toBe(false);
  expect(googleVisible(2, "administrative.locality")).toBe(true);
  expect(googleVisible(2, "road.local")).toBe(false);
  expect(googleVisible(3, "road.local")).toBe(true);
  expect(googleVisible(3, "poi.business")).toBe(false);
});

test("la preferencia se recupera al cambiar de mapa y respeta el interruptor anterior", () => {
  storage({ "vacaciones-mapa-nombres": "no" });
  expect(readMapDetail()).toBe(0);
  saveMapDetail(3);
  expect(readMapDetail()).toBe(3);
  storage();
  expect(readMapDetail()).toBe(2);
});

test("un valor inválido no oculta las etiquetas por accidente", () => {
  for (const value of ["", "invalid", "-1", "9", "1.5"]) {
    storage({ [MAP_DETAIL_KEY]: value }); expect(readMapDetail()).toBe(2);
  }
  expect(normalizeMapDetail(NaN)).toBe(2);
  expect(normalizeMapDetail(8)).toBe(4);
});

test("el proveedor alternativo mantiene el mismo orden de detalle", () => {
  expect(mapLibreLabelDetail("label_country_1")).toBeLessThan(mapLibreLabelDetail("label_city"));
  expect(mapLibreLabelDetail("label_city")).toBeLessThan(mapLibreLabelDetail("highway-name-major"));
  expect(mapLibreLabelDetail("highway-name-major")).toBeLessThan(mapLibreLabelDetail("airport"));
});

test("el contraste de vías y fronteras solo cambia al ver países", () => {
  const geometry = (countryView: boolean) => googleMapStyles(false, 1, true, 2, countryView).filter(style => style.featureType === "administrative.country" && style.elementType === "geometry.stroke");
  expect(geometry(true)).toHaveLength(1);
  expect(geometry(false)).toHaveLength(0);
  expect(googleMapStyles(false, 1, true, 2, false)).toEqual(googleMapStyles(false, 4, true, 2, false).filter(style => style.elementType !== "labels").concat(googleMapStyles(false, 1, true, 2, false).filter(style => style.elementType === "labels")));
});
