import { afterEach, expect, test } from "bun:test";
import { MAP_ZOOM_KEY, mapZoomLabels, mapZoomOffset, mapOverviewZoomOffset, readMapZoom, saveMapZoom } from "../web/src/lib/mapZoom";
import { boundsCamera } from "../web/src/lib/mapCamera";

const original = globalThis.localStorage;
afterEach(() => { globalThis.localStorage = original; });
function storage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  globalThis.localStorage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value) } as unknown as Storage;
}

test("el acercamiento arranca en el encuadre de siempre y se recuerda", () => {
  storage();
  expect(readMapZoom()).toBe(2);
  expect(mapZoomOffset(readMapZoom())).toBe(0);
  saveMapZoom(4);
  expect(readMapZoom()).toBe(4);
  expect(mapZoomOffset(0)).toBe(-3);
  expect(mapZoomOffset(4)).toBe(2);
  for (const value of ["", "nada"]) { storage({ [MAP_ZOOM_KEY]: value }); expect(readMapZoom()).toBe(2); }
});

test("el ajuste suma o resta niveles al encuadre de una ruta", () => {
  const sw = { lat: 6.2, lng: -75.6 };
  const ne = { lat: 6.3, lng: -75.5 };
  const viewport = { width: 1000, height: 800 };
  const pad = { top: 0, right: 0, bottom: 0, left: 0 };
  const base = boundsCamera(sw, ne, viewport, pad, 18).zoom;
  expect(boundsCamera(sw, ne, viewport, pad, 18, 2).zoom).toBe(base + 2);
  expect(boundsCamera(sw, ne, viewport, pad, 18, -1).zoom).toBe(base - 1);
});

test("cada nivel se dice como la escala, cada vez más corto", () => {
  const labels = mapZoomLabels(0, 800, 15);
  expect(labels).toHaveLength(5);
  expect(labels[2]).toBe("3,8 km");
  expect(labels[4]).toBe("960 m");
  expect(mapZoomLabels(60, 800, 15)[2]).toBe("1,9 km");
});

test("la escala lejana de la vista general conserva la ruta visible sin mostrar ocho veces su ancho", () => {
  const sw = { lat: 40.4, lng: -3.7 };
  const ne = { lat: 52.4, lng: 12.5 };
  const viewport = { width: 1920, height: 1080 };
  const padding = { top: 160, right: 80, bottom: 80, left: 700 };
  const base = boundsCamera(sw, ne, viewport, padding, 15).zoom;
  const wide = boundsCamera(sw, ne, viewport, padding, 15, mapOverviewZoomOffset(0)).zoom;
  expect(base - wide).toBe(1);
  expect(2 ** (base - wide)).toBe(2);
  expect(mapOverviewZoomOffset(1)).toBe(-0.5);
  expect(mapOverviewZoomOffset(2)).toBe(0);
  expect(mapOverviewZoomOffset(4)).toBe(mapZoomOffset(4));
  expect(mapZoomOffset(0)).toBe(-3);
});
