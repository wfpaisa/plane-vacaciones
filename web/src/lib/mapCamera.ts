export type Coordinates = { lat: number; lng: number };
export type Camera = { center: Coordinates; zoom: number };
export type Viewport = { width: number; height: number };
export type Padding = { top: number; right: number; bottom: number; left: number };

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (x: number) => ((x + 180) % 360 + 360) % 360 - 180;

export function world(p: Coordinates) {
  const sin = Math.sin(clamp(p.lat, -85.051129, 85.051129) * Math.PI / 180);
  return { x: (p.lng + 180) / 360, y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) };
}
export function coordinates(p: { x: number; y: number }): Coordinates {
  return { lng: wrap(p.x * 360 - 180), lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * p.y))) * 180) / Math.PI };
}

/** Desplaza el centro para que el punto quede en la parte libre entre paneles. */
export function offsetCamera(camera: Camera, offset: [number, number] = [0, 0]): Camera {
  if (!offset[0] && !offset[1]) return camera;
  const p = world(camera.center);
  const pixels = 256 * 2 ** camera.zoom;
  return { zoom: camera.zoom, center: coordinates({ x: p.x - offset[0] / pixels, y: p.y - offset[1] / pixels }) };
}

/** Encuadre sin llamar fitBounds: evita un salto de cámara antes de la animación. */
export function boundsCamera(sw: Coordinates, ne: Coordinates, viewport: Viewport, padding: Padding, maxZoom: number, zoomOffset = 0): Camera {
  const a = world(sw);
  const b = world(ne);
  const dx = b.x < a.x ? b.x + 1 - a.x : b.x - a.x;
  const dy = Math.abs(b.y - a.y);
  const width = Math.max(80, viewport.width - padding.left - padding.right);
  const height = Math.max(80, viewport.height - padding.top - padding.bottom);
  // Las teselas raster se dejan en su escala nativa al terminar el encuadre;
  // los niveles fraccionarios se reservan para la animación de la cámara.
  const zoom = clamp(zoomOffset + Math.floor(clamp(Math.min(maxZoom, Math.log2(width / (256 * Math.max(dx, 1e-9))), Math.log2(height / (256 * Math.max(dy, 1e-9)))), 0, 21)), 0, 21);
  return offsetCamera({ center: coordinates({ x: a.x + dx / 2, y: (a.y + b.y) / 2 }), zoom }, [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2]);
}

/** Aleja antes de recorrer grandes distancias y acerca al llegar al destino. */
export function cameraFlight(from: Camera, to: Camera, viewport: Viewport): (progress: number) => Camera {
  const a = world(from.center);
  const b = world(to.center);
  let dx = b.x - a.x;
  if (dx > 0.5) dx -= 1;
  if (dx < -0.5) dx += 1;
  const distance = Math.hypot(dx, b.y - a.y);
  const room = Math.max(80, Math.min(viewport.width, viewport.height)) * 0.7;
  const travelZoom = Math.max(0, Math.min(from.zoom, to.zoom, Math.log2(room / (256 * Math.max(distance, 1e-9)))));
  const wide = travelZoom < Math.min(from.zoom, to.zoom) - 0.5;
  return (progress) => {
    const t = clamp(progress, 0, 1);
    if (t === 0) return from;
    if (t === 1) return to;
    const p = wide ? smooth((t - 0.2) / 0.6) : smooth(t);
    const zoom = wide
      ? t < 0.5 ? mix(from.zoom, travelZoom, smooth(t / 0.35)) : mix(travelZoom, to.zoom, smooth((t - 0.65) / 0.35))
      : mix(from.zoom, to.zoom, smooth(t));
    return { center: coordinates({ x: a.x + dx * p, y: mix(a.y, b.y, p) }), zoom };
  };
}
