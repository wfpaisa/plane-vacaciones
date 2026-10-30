import { expect, test } from "bun:test";
import { boundsCamera, cameraFlight, coordinates, offsetCamera, world } from "../web/src/lib/mapCamera";
import { googleMapStyles } from "../web/src/lib/googleMapStyle";

const madrid = { lat: 40.4168, lng: -3.7038 };
const paris = { lat: 48.8566, lng: 2.3522 };
const viewport = { width: 1600, height: 900 };

test("el vuelo empieza en la vista actual, aleja para el recorrido y acaba exactamente en la ciudad", () => {
  const from = { center: madrid, zoom: 13 };
  const to = { center: paris, zoom: 13 };
  const flight = cameraFlight(from, to, viewport);
  expect(flight(0)).toEqual(from);
  expect(flight(1)).toEqual(to);
  expect(flight(0.5).zoom).toBeLessThan(9);
  expect(flight(0.1).center.lat).toBeCloseTo(from.center.lat, 8);
  expect(flight(0.1).center.lng).toBeCloseTo(from.center.lng, 8);
  expect(flight(0.5).center.lat).toBeGreaterThan(madrid.lat);
  expect(flight(0.5).center.lat).toBeLessThan(paris.lat);
  let previous = flight(0);
  for (let i = 1; i <= 120; i++) {
    const next = flight(i / 120);
    expect(Math.abs(next.zoom - previous.zoom)).toBeLessThan(0.4);
    expect(Math.abs(next.center.lat - previous.center.lat)).toBeLessThan(0.25);
    previous = next;
  }
});

test("un desplazamiento corto conserva el acercamiento y no da una vuelta al mundo al cruzar la fecha internacional", () => {
  const near = cameraFlight({ center: madrid, zoom: 13 }, { center: { lat: madrid.lat + 0.001, lng: madrid.lng }, zoom: 13 }, viewport);
  expect(near(0.5).zoom).toBe(13);
  const crossing = cameraFlight({ center: { lat: 0, lng: 179 }, zoom: 5 }, { center: { lat: 0, lng: -179 }, zoom: 5 }, viewport);
  expect(Math.abs(crossing(0.5).center.lng)).toBeCloseTo(180);
});

test("el encuadre reserva espacio para el panel y mantiene los puntos dentro del área libre", () => {
  const padding = { top: 160, right: 70, bottom: 80, left: 700 };
  const camera = boundsCamera({ lat: 40, lng: -4 }, { lat: 49, lng: 3 }, viewport, padding, 15);
  const center = world(camera.center);
  const scale = 256 * 2 ** camera.zoom;
  for (const point of [{ lat: 40, lng: -4 }, { lat: 49, lng: 3 }]) {
    const p = world(point);
    const x = viewport.width / 2 + (p.x - center.x) * scale;
    const y = viewport.height / 2 + (p.y - center.y) * scale;
    expect(x).toBeGreaterThanOrEqual(padding.left - 0.001);
    expect(x).toBeLessThanOrEqual(viewport.width - padding.right + 0.001);
    expect(y).toBeGreaterThanOrEqual(padding.top - 0.001);
    expect(y).toBeLessThanOrEqual(viewport.height - padding.bottom + 0.001);
  }
  expect(boundsCamera(madrid, madrid, viewport, padding, 13).zoom).toBe(13);
});

test("las coordenadas se proyectan y el marcador queda desplazado hacia la parte libre", () => {
  const p = coordinates(world(madrid));
  expect(p.lat).toBeCloseTo(madrid.lat); expect(p.lng).toBeCloseTo(madrid.lng);
  const target = { center: madrid, zoom: 13 };
  const shifted = offsetCamera(target, [300, -50]);
  const a = world(madrid); const b = world(shifted.center);
  const scale = 256 * 2 ** target.zoom;
  expect((a.x - b.x) * scale).toBeCloseTo(300);
  expect((a.y - b.y) * scale).toBeCloseTo(-50);
});

test("el tema oscuro distingue las calles y mantiene el borde del agua sin retícula", () => {
  const styles = googleMapStyles(false, 2, true);
  const color = (feature: string, element: string) => styles.find(s => s.featureType === feature && s.elementType === element)?.stylers?.find(s => "color" in s)?.color;
  expect(color("road", "geometry.fill")).not.toBe(color("landscape", "geometry.fill"));
  expect(color("landscape.man_made", "geometry.fill")).not.toBe(color("landscape", "geometry.fill"));
  expect(color("water", "geometry.stroke")).toBe(color("water", "geometry.fill"));
  expect(googleMapStyles(true, 2, true).some(s => s.elementType.startsWith("geometry"))).toBe(false);
});

test("el encuadre final no deja teselas escaladas a un zoom fraccionario", () => {
  const camera = boundsCamera({ lat: 40, lng: -4 }, { lat: 49, lng: 3 }, viewport, { top: 160, right: 70, bottom: 80, left: 700 }, 15);
  expect(Number.isInteger(camera.zoom)).toBe(true);
});
