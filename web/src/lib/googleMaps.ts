import type { FeatureCollection } from "geojson";
import { boundsCamera, cameraFlight, offsetCamera, type Camera, type Padding } from "./mapCamera";
import { googleMapBackground, googleMapStyles } from "./googleMapStyle";

let loading: Promise<void> | undefined;
let authorizationFailed = false;
/** El script se comparte; cada instancia de mapa necesita su propia reserva. */
export function loadGoogleMaps(key: string): Promise<void> {
  if (authorizationFailed) return Promise.reject(new Error("Google Maps rechazó la clave. Revisa los sitios autorizados y recarga la página."));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const globals = window as unknown as Record<string, unknown>;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        script.remove();
        loading = undefined;
        reject(error);
      } else resolve();
    };
    const timer = setTimeout(() => finish(new Error("Google Maps no respondió.")), 15000);
    globals.vacacionesGoogleReady = () => finish();
    globals.gm_authFailure = () => {
      authorizationFailed = true;
      finish(new Error("Google Maps rechazó la clave."));
      window.dispatchEvent(new Event("vacaciones-google-error"));
    };
    const params = new URLSearchParams({ key, v: "weekly", language: "es", loading: "async", callback: "vacacionesGoogleReady" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => finish(new Error("No se pudo cargar Google Maps."));
    document.head.append(script);
  });
  return loading;
}

type Point = [number, number] | { lng: number; lat: number };
const position = (p: Point): google.maps.LatLngLiteral => Array.isArray(p) ? { lng: p[0], lat: p[1] } : p;

/** Interfaz pequeña que conserva los marcadores, trayectos y controles del viaje. */
export class GoogleMap {
  readonly native: google.maps.Map;
  private lines = new Map<string, google.maps.Polyline[]>();
  private overlays = new Set<GoogleMarker>();
  private listeners: google.maps.MapsEventListener[] = [];
  private animation?: number;
  private resize: ResizeObserver;
  private container: HTMLElement;
  private removed = false;
  private baseStyle?: { satellite: boolean; detail: number; dark: boolean; palette: number };
  private countryView = true;
  private updateZoomStyle = () => {
    const countryView = (this.native.getZoom() ?? 2) <= 7;
    if (countryView === this.countryView) return;
    this.countryView = countryView;
    if (this.baseStyle) {
      const { satellite, detail, dark, palette } = this.baseStyle;
      this.native.setOptions({ styles: googleMapStyles(satellite, detail, dark, palette, countryView) });
    }
  };
  constructor(options: { container: HTMLElement; center: Point; zoom: number; interactive: boolean; dark?: boolean }) {
    this.container = options.container;
    this.native = new google.maps.Map(options.container, {
      center: position(options.center), zoom: options.zoom + 1,
      disableDefaultUI: true, clickableIcons: false, tilt: 0,
      gestureHandling: options.interactive ? "greedy" : "none",
      keyboardShortcuts: options.interactive, scrollwheel: options.interactive,
      isFractionalZoomEnabled: true,
      backgroundColor: googleMapBackground(options.dark ?? false),
    });
    this.resize = new ResizeObserver(() => google.maps.event.trigger(this.native, "resize"));
    this.resize.observe(options.container);
    this.countryView = (this.native.getZoom() ?? 2) <= 7;
    this.listeners.push(this.native.addListener("zoom_changed", this.updateZoomStyle));
    this.listeners.push(this.native.addListener("dragstart", this.stopFlight));
    this.container.addEventListener("wheel", this.stopFlight, { passive: true });
    this.container.addEventListener("pointerdown", this.stopFlight);
  }
  on(event: "load" | "click", callback: (e: { lngLat: { lat: number; lng: number } }) => void) {
    if (event === "load") {
      this.listeners.push(google.maps.event.addListenerOnce(this.native, "idle", () => callback({ lngLat: { lat: 0, lng: 0 } })));
    } else {
      this.listeners.push(this.native.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) callback({ lngLat: { lat: e.latLng.lat(), lng: e.latLng.lng() } });
      }));
    }
  }
  setBase(satellite: boolean, detail: number, dark: boolean, palette = 0) {
    // backgroundColor solo se admite al crear el mapa. Al cambiar el tema,
    // actualizamos también el fondo del renderizador sin crear otra instancia facturable.
    const background = googleMapBackground(dark, satellite ? 0 : palette);
    this.container.style.backgroundColor = background;
    this.container.style.setProperty("--google-map-background", background);
    const root = this.container.firstElementChild as HTMLElement | null;
    if (root?.style) root.style.backgroundColor = background;
    this.native.setMapTypeId(satellite ? (detail > 0 ? "hybrid" : "satellite") : "roadmap");
    this.baseStyle = { satellite, detail, dark, palette };
    this.native.setOptions({ styles: googleMapStyles(satellite, detail, dark, palette, this.countryView) });
  }
  getZoom() { return (this.native.getZoom() ?? 2) - 1; }
  private stopFlight = () => {
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    this.animation = undefined;
  };
  private animate(to: Camera, duration = 1800) {
    this.stopFlight();
    const center = this.native.getCenter();
    const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!center || !duration || reduceMotion) {
      this.native.moveCamera(to);
      return;
    }
    const frame = cameraFlight({ center: { lat: center.lat(), lng: center.lng() }, zoom: this.native.getZoom() ?? to.zoom }, to,
      { width: this.container.clientWidth, height: this.container.clientHeight });
    const start = performance.now();
    const tick = (now: number) => {
      if (this.removed) return;
      const progress = Math.min(1, (now - start) / duration);
      this.native.moveCamera(frame(progress));
      this.animation = progress < 1 ? requestAnimationFrame(tick) : undefined;
    };
    this.animation = requestAnimationFrame(tick);
  }
  zoomIn() { const center = this.native.getCenter(); if (center) this.animate({ center: center.toJSON(), zoom: (this.native.getZoom() ?? 2) + 1 }, 350); }
  zoomOut() { const center = this.native.getCenter(); if (center) this.animate({ center: center.toJSON(), zoom: (this.native.getZoom() ?? 2) - 1 }, 350); }
  flyTo(options: { center: Point; zoom: number; offset?: [number, number]; duration?: number }) {
    this.animate(offsetCamera({ center: position(options.center), zoom: options.zoom + 1 }, options.offset), options.duration);
  }
  fitBounds(bounds: { getSouthWest(): { lng: number; lat: number }; getNorthEast(): { lng: number; lat: number } }, options: { padding: Padding; maxZoom: number; zoomOffset?: number; duration?: number }) {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    this.animate(boundsCamera(sw, ne, { width: this.container.clientWidth, height: this.container.clientHeight }, options.padding, options.maxZoom + 1, options.zoomOffset), options.duration);
  }
  getSource(source: string) {
    return { setData: (data: FeatureCollection) => {
      for (const line of this.lines.get(source) ?? []) line.setMap(null);
      const lines: google.maps.Polyline[] = [];
      for (const feature of data.features) {
        if (feature.geometry?.type !== "LineString") continue;
        const path = feature.geometry.coordinates.map(([lng, lat]) => ({ lng, lat }));
        const color = String(feature.properties?.color ?? "#444");
        const flight = !!feature.properties?.flight;
        lines.push(new google.maps.Polyline({ map: this.native, path, clickable: false,
          strokeColor: "#252525", strokeWeight: source === "trip" ? 6 : 5, strokeOpacity: 0.4, zIndex: 1 }));
        lines.push(new google.maps.Polyline({ map: this.native, path, clickable: false,
          strokeColor: color, strokeWeight: source === "trip" ? 3 : 2.5, strokeOpacity: flight ? 0 : 1, zIndex: 2,
          ...(flight ? { icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, scale: 2 }, offset: "0", repeat: "14px" }] } : {}),
        }));
      }
      this.lines.set(source, lines);
    } };
  }
  attach(marker: GoogleMarker) { this.overlays.add(marker); }
  detach(marker: GoogleMarker) { this.overlays.delete(marker); }
  remove() {
    if (this.removed) return;
    this.removed = true;
    this.stopFlight();
    this.resize.disconnect();
    this.container.removeEventListener("wheel", this.stopFlight);
    this.container.removeEventListener("pointerdown", this.stopFlight);
    for (const listener of this.listeners) listener.remove();
    for (const marker of [...this.overlays]) marker.remove();
    for (const lines of this.lines.values()) for (const line of lines) line.setMap(null);
    google.maps.event.clearInstanceListeners(this.native);
    // Google puede invalidar getDiv() al rechazar la clave. Conservamos el contenedor original.
    this.container.replaceChildren();
  }
}

export class GoogleMarker {
  private overlay?: google.maps.OverlayView;
  private map?: GoogleMap;
  private point = { lat: 0, lng: 0 };
  constructor(private options: { element: HTMLElement; anchor?: string; offset?: [number, number] }) {}
  setLngLat(p: Point) { this.point = position(p); this.overlay?.draw(); return this; }
  getLngLat() { return this.point; }
  addTo(map: GoogleMap) {
    this.remove();
    this.map = map;
    const element = this.options.element;
    const point = () => this.point;
    const options = this.options;
    class Pin extends google.maps.OverlayView {
      onAdd() {
        element.style.position = "absolute";
        this.getPanes()!.overlayMouseTarget.appendChild(element);
        google.maps.OverlayView.preventMapHitsAndGesturesFrom(element);
      }
      draw() {
        const pixel = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(point()));
        if (!pixel) return;
        const [dx, dy] = options.offset ?? [0, 0];
        element.style.left = `${pixel.x + dx}px`;
        element.style.top = `${pixel.y + dy}px`;
        element.style.transform = options.anchor === "top-left" ? "none" : "translate(-50%, -50%)";
      }
      onRemove() { element.remove(); }
    }
    this.overlay = new Pin();
    this.overlay.setMap(map.native);
    map.attach(this);
    return this;
  }
  remove() { this.overlay?.setMap(null); this.overlay = undefined; this.map?.detach(this); this.map = undefined; }
}

export class GooglePopup {
  private native?: google.maps.InfoWindow;
  private point = { lat: 0, lng: 0 };
  private html = "";
  setLngLat(p: Point) { this.point = position(p); return this; }
  setHTML(html: string) { this.html = html; return this; }
  addTo(map: GoogleMap) {
    this.native ??= new google.maps.InfoWindow({ maxWidth: 260, pixelOffset: new google.maps.Size(0, -18), headerDisabled: true, disableAutoPan: true });
    this.native.setPosition(this.point);
    this.native.setContent(this.html);
    this.native.open({ map: map.native, shouldFocus: false });
    return this;
  }
  remove() { this.native?.close(); }
}
