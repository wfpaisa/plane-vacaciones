import { afterEach, expect, test } from "bun:test";
import { GoogleMap, loadGoogleMaps } from "../web/src/lib/googleMaps";

const globals = globalThis as unknown as Record<string, unknown>;
const originals = new Map<string, unknown>();
function stub(name: string, value: unknown) {
  if (!originals.has(name)) originals.set(name, globals[name]);
  globals[name] = value;
}
afterEach(() => { for (const [name, value] of originals) { if (value === undefined) delete globals[name]; else globals[name] = value; } originals.clear(); });

test("el cierre tolera getDiv invalidado y no elimina dos veces el contenedor", () => {
  let cleaned = 0;
  let disconnected = 0;
  let cleared = 0;
  let detached = 0;
  const container = { replaceChildren: () => { cleaned++; }, addEventListener() {}, removeEventListener() {} } as unknown as HTMLElement;
  stub("google", { maps: { Map: class { getDiv() { return undefined; } getZoom() { return 11; } addListener() { return { remove() {} }; } }, event: { clearInstanceListeners: () => { cleared++; } } } });
  stub("ResizeObserver", class { observe() {} disconnect() { disconnected++; } });
  const map = new GoogleMap({ container, center: [-3.7, 40.4], zoom: 10, interactive: true });
  map.attach({ remove: () => { detached++; } } as Parameters<GoogleMap["attach"]>[0]);
  expect(() => map.remove()).not.toThrow();
  expect(cleaned).toBe(1); expect(disconnected).toBe(1); expect(cleared).toBe(1); expect(detached).toBe(1);
  map.remove();
  expect(cleaned).toBe(1);
});

test("un rechazo de autorización posterior a la carga activa el proveedor alternativo y evita reintentos", async () => {
  const callbacks: Record<string, unknown> = {};
  let appended = 0;
  let fallback = 0;
  stub("window", callbacks);
  callbacks.dispatchEvent = (event: Event) => { if (event.type === "vacaciones-google-error") fallback++; };
  stub("document", { createElement: () => ({ remove() {} }), head: { append: () => { appended++; } } });
  const first = loadGoogleMaps("test-public-key");
  const second = loadGoogleMaps("test-public-key");
  expect(first).toBe(second); expect(appended).toBe(1);
  (callbacks.vacacionesGoogleReady as () => void)();
  await first;
  (callbacks.gm_authFailure as () => void)();
  expect(fallback).toBe(1);
  await expect(loadGoogleMaps("test-public-key")).rejects.toThrow("Google Maps rechazó la clave");
  expect(appended).toBe(1);
});

test("cambiar de ciudad anima desde la vista actual y arrastrar cancela el vuelo", () => {
  let now = 0;
  let id = 0;
  const queue = new Map<number, FrameRequestCallback>();
  const listeners: Record<string, () => void> = {};
  let center = { lat: 40.4168, lng: -3.7038 };
  let zoom = 13;
  const moves: { center: { lat: number; lng: number }; zoom: number }[] = [];
  stub("performance", { now: () => now });
  stub("requestAnimationFrame", (fn: FrameRequestCallback) => { queue.set(++id, fn); return id; });
  stub("cancelAnimationFrame", (key: number) => queue.delete(key));
  stub("google", { maps: { Map: class {
    addListener(name: string, fn: () => void) { listeners[name] = fn; return { remove() {} }; }
    getCenter() { return { lat: () => center.lat, lng: () => center.lng, toJSON: () => center }; }
    getZoom() { return zoom; }
    moveCamera(camera: typeof moves[number]) { center = camera.center; zoom = camera.zoom; moves.push(camera); }
  }, event: { clearInstanceListeners() {} } } });
  stub("ResizeObserver", class { observe() {} disconnect() {} });
  const container = { clientWidth: 1600, clientHeight: 900, replaceChildren() {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLElement;
  const map = new GoogleMap({ container, center, zoom: 12, interactive: true });
  const step = (time: number) => { now = time; const pending = [...queue.values()]; queue.clear(); for (const fn of pending) fn(time); };
  map.flyTo({ center: [2.3522, 48.8566], zoom: 12, duration: 1000 });
  expect(moves).toHaveLength(0);
  step(500);
  expect(center.lat).toBeGreaterThan(40.4168); expect(center.lat).toBeLessThan(48.8566);
  const halfway = center;
  map.flyTo({ center: [12.4964, 41.9028], zoom: 12, duration: 1000 });
  expect(center).toEqual(halfway);
  expect(queue.size).toBe(1);
  step(1500);
  expect(center).toEqual({ lat: 41.9028, lng: 12.4964 }); expect(zoom).toBe(13);
  expect(queue.size).toBe(0);
  map.flyTo({ center: [-3.7038, 40.4168], zoom: 12 });
  listeners.dragstart();
  expect(queue.size).toBe(0);
  map.remove();
});

test("el fondo inicial y los cambios de tema no dejan un fondo claro entre teselas oscuras", () => {
  const water = "#244860";
  let initialized: { backgroundColor: string } | undefined;
  let constructed = 0;
  const styles: Record<string, string> = {};
  const root = { style: { backgroundColor: "" } };
  const container = { style: { backgroundColor: "", setProperty: (name: string, value: string) => { styles[name] = value; } },
    firstElementChild: root, addEventListener() {}, removeEventListener() {}, replaceChildren() {} } as unknown as HTMLElement;
  stub("google", { maps: { Map: class {
    constructor(_container: unknown, options: typeof initialized) { initialized = options; constructed++; }
    getZoom() { return 6; }
    addListener() { return { remove() {} }; }
    setMapTypeId() {}
    setOptions() {}
  }, event: { clearInstanceListeners() {} } } });
  stub("ResizeObserver", class { observe() {} disconnect() {} });
  const map = new GoogleMap({ container, center: [0, 0], zoom: 5, interactive: true, dark: true });
  expect(initialized?.backgroundColor).toBe(water);
  map.setBase(false, 2, true);
  expect(container.style.backgroundColor).toBe(water);
  expect(root.style.backgroundColor).toBe(water);
  expect(styles["--google-map-background"]).toBe(water);
  map.setBase(false, 2, false);
  expect(root.style.backgroundColor).not.toBe(water);
  map.setBase(false, 2, true);
  expect(root.style.backgroundColor).toBe(water);
  expect(constructed).toBe(1);
  map.remove();
});
