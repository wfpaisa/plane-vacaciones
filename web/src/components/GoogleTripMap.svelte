<!--
  El mapa del viaje, en dos capas:

  - El recorrido: cada parada es una etiqueta numerada con el nombre de la
    ciudad, unida a la siguiente por un trayecto (curvo y punteado si es en
    avión o barco) con el color y el icono del medio de transporte.
  - Los lugares: un marcador con el color de su categoría y, si ya tiene día,
    su número de orden. Los de un mismo día se unen con la ruta de ese día.

  Google Maps conserva las capas y controles del viaje.
-->
<script lang="ts">
  import { LngLatBounds } from "maplibre-gl";
  import { GoogleMap as MapGL, GoogleMarker as Marker, GooglePopup as Popup } from "../lib/googleMaps";
  import { onMount, untrack } from "svelte";

  import { dayColor, PLACE_CATEGORIES, TRANSPORTS } from "../lib/catalog";
  import { hasCoords } from "../lib/geo";
  import { oklchToRgb } from "../lib/mapStyle";
  import type { Feature } from "geojson";

  import type { Leg } from "../lib/stops";
  import { theme } from "../lib/theme.svelte";
  import type { Place } from "../lib/types";
  import Icon from "./Icon.svelte";
  import MapLevelControl from "./MapLevelControl.svelte";
  import { mapPreferences } from "../lib/mapPreferences.svelte";
  import { PLACE_ZOOM, mapZoomLabels, mapZoomOffset, mapOverviewZoomOffset, readMapZoom, saveMapZoom } from "../lib/mapZoom";
  import { MAP_DETAIL_LABELS, saveMapDetail, readMapDetail } from "../lib/mapDetail";

  let {
    places,
    legs = [],
    center,
    days = null,
    focusStop = null,
    selected = null,
    preview = null,
    interactive = true,
    showPlaces = true,
    controls = true,
    useSavedZoom = true,
    maxZoom = 15,
    inset = { top: 56, right: 56, bottom: 56, left: 56 },
    onSelect,
    onSelectStop,
    onMapClick,
  }: {
    places: Place[];
    legs?: Leg[];
    center: { lat: number; lng: number } | null;
    /** Días visibles; null = todos (incluidas las ideas). */
    days?: number[] | null;
    /** Parada en la que se centra el mapa. */
    focusStop?: string | null;
    selected?: string | null;
    preview?: { lat: number; lng: number; name: string } | null;
    interactive?: boolean;
    showPlaces?: boolean;
    /** La cápsula de controles (capa, acercar, alejar, encuadrar). */
    controls?: boolean;
    /** Aplicar la escala guardada en las vistas del viaje. */
    useSavedZoom?: boolean;
    /** El acercamiento máximo al encuadrar, en niveles de OpenStreetMap. */
    maxZoom?: number;
    /** Espacio que tapan los paneles flotantes, para encuadrar sin esconder nada. */
    inset?: { top: number; right: number; bottom: number; left: number };
    onSelect?: (id: string) => void;
    onSelectStop?: (id: string) => void;
    onMapClick?: (lat: number, lng: number) => void;
  } = $props();

  type Point = [lng: number, lat: number];

  let el: HTMLDivElement;
  let map: MapGL | undefined = $state();
  /** El estilo terminó de cargar y ya existen las capas propias. */
  let ready = $state(false);
  const markers = new Map<string, { marker: Marker; el: HTMLElement }>();
  let markerVersion = $state(0);
  let paintedSelection: string | null = null;
  let centeredSelection: string | null = null;
  let centeredOffset = 0;
  let tripMarkers: Marker[] = [];
  let previewMarker: Marker | null = null;
  // Se cierra a mano: el clic en un marcador también le llega al mapa.
  const popup = new Popup();

  const flightDuration = 1800;
  const INK = oklchToRgb("oklch(0.17 0.005 100)");
  const ACCENT = oklchToRgb("oklch(0.93 0.21 122)");

  /**
   * Los niveles de acercamiento de la app son los de OpenStreetMap (teselas de
   * 256 px); MapLibre usa teselas de 512 px y va un nivel por debajo.
   */
  const gl = (zoom: number) => zoom - 1;

  /** El margen de los paneles, recortado si no deja espacio para el mapa. */
  function padding() {
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    const fit = (a: number, b: number, size: number) => {
      const room = size - 80;
      return a + b <= room || room <= 0 ? [a, b] : [(a * room) / (a + b), (b * room) / (a + b)];
    };
    const [left, right] = fit(inset.left, inset.right, w);
    const [top, bottom] = fit(inset.top, inset.bottom, h);
    return { top, right, bottom, left };
  }

  function flyTo(point: Point, zoom: number, offset = overviewZoomOffset) {
    map?.flyTo({ center: point, zoom: gl(zoom + offset), duration: flightDuration });
  }

  function flyToBounds(points: Point[], zoom: number, offset = overviewZoomOffset) {
    const bounds = points.reduce((b, p) => b.extend(p), new LngLatBounds(points[0], points[0]));
    map?.fitBounds(bounds, { padding: padding(), maxZoom: gl(zoom), zoomOffset: offset, duration: flightDuration });
  }

  const BASE_KEY = "vacaciones-mapa";
  let base = $state<"map" | "sat">(readBase());
  function readBase(): "map" | "sat" {
    try {
      return localStorage.getItem(BASE_KEY) === "sat" ? "sat" : "map";
    } catch {
      return "map";
    }
  }
  function setBase(b: "map" | "sat") {
    base = b;
    try {
      localStorage.setItem(BASE_KEY, b);
    } catch {}
  }

  let detail = $state(readMapDetail());
  /** Niveles que el usuario suma o resta al encuadre al ir a un lugar. */
  let zoomLevel = $state(readMapZoom());
  const zoomOffset = $derived(useSavedZoom ? mapZoomOffset(zoomLevel) : 0);
  const overviewZoomOffset = $derived(useSavedZoom ? mapOverviewZoomOffset(zoomLevel) : 0);
  let mapWidth = $state(0);
  const mapColor = $derived(theme.dark ? mapPreferences.dark : mapPreferences.light);

  $effect(() => {
    if (!map || !ready) return;
    map.setBase(base === "sat", detail, theme.dark, mapColor);
  });

  /** Encuadra todo lo que hay en el mapa. */
  function frameAll() {
    if (!map) return;
    const pts: Point[] = [...visible.map((p) => [p.lng, p.lat] as Point), ...placed.map((l) => [l.stop.lng, l.stop.lat] as Point)];
    if (pts.length > 1) flyToBounds(pts, 15, 0);
    else if (pts.length === 1) flyTo(pts[0], 13, 0);
  }

  const escape = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

  /** Un elemento para un marcador. MapLibre lo mueve con `transform`, así que el dibujo va adentro. */
  function element(html: string, zIndex = 0) {
    const div = document.createElement("div");
    div.innerHTML = html;
    if (zIndex) div.style.zIndex = String(zIndex);
    return div;
  }

  function pinHtml(p: Place, n: number | null, active: boolean) {
    const cat = PLACE_CATEGORIES[p.category || "otro"];
    const inner = n ? `<b>${n}</b>` : `<i></i>`;
    return `<div class="pin${active ? " active" : ""}${p.visited ? " visited" : ""}" style="--c:${cat.color}">${inner}</div>`;
  }

  function popupHtml(p: Place) {
    const cat = PLACE_CATEGORIES[p.category || "otro"];
    return `<div class="map-pop"><small>${cat.label}${p.day ? ` · Día ${p.day}` : " · Sin día"}</small><strong>${escape(p.name)}</strong>${p.time ? `<span>${escape(p.time)}</span>` : ""}</div>`;
  }

  function openPopup(p: Place) {
    if (!map) return;
    popup.setLngLat([p.lng, p.lat]).setHTML(popupHtml(p)).addTo(map);
  }

  /** Un arco entre dos puntos, para los trayectos en avión. */
  function arc(a: Point, b: Point, bend = 0.18): Point[] {
    const [x1, y1] = a;
    const [x2, y2] = b;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const cx = mx - (y2 - y1) * bend;
    const cy = my + (x2 - x1) * bend;
    const out: Point[] = [];
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t ** 2 * x2;
      const y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t ** 2 * y2;
      out.push([x, y]);
    }
    return out;
  }

  const line = (coordinates: Point[], properties: Record<string, unknown>): Feature => ({
    type: "Feature",
    properties,
    geometry: { type: "LineString", coordinates },
  });

  function setData(source: string, features: Feature[]) {
    map?.getSource(source)?.setData({ type: "FeatureCollection", features });
  }

  onMount(() => {
    const m = new MapGL({
      container: el,
      center: center && hasCoords(center) ? [center.lng, center.lat] : [-30, 20],
      zoom: center ? gl(11) : gl(2),
      interactive,
      dark: theme.dark,
    });
    m.setBase(base === "sat", detail, theme.dark, mapColor);
    m.on("load", () => { ready = true; });
    m.on("click", (e) => {
      popup.remove();
      onMapClick?.(e.lngLat.lat, e.lngLat.lng);
    });

    map = m;
    return () => {
      ready = false;
      map = undefined;
      popup.remove();
      m.remove();
    };
  });

  const placed = $derived(legs.filter((l) => hasCoords(l.stop)));
  const visible = $derived(
    showPlaces ? places.filter((p) => hasCoords(p) && (days === null || days.includes(p.day))) : [],
  );
  /** La escala que se tendrá al llegar al lugar elegido (o a la zona del viaje). */
  const zoomLabels = $derived(mapZoomLabels(
    visible.find((p) => p.id === selected)?.lat ?? (center && hasCoords(center) ? center.lat : visible[0]?.lat ?? 0),
    mapWidth - inset.left - inset.right,
    Math.min(PLACE_ZOOM, maxZoom),
  ));

  // El recorrido entre ciudades.
  $effect(() => {
    if (!map || !ready) return;
    for (const m of tripMarkers) m.remove();
    tripMarkers = [];
    const lines: Feature[] = [];

    placed.forEach((leg, i) => {
      const s = leg.stop;
      const prev = placed[i - 1];
      if (prev) {
        const a: Point = [prev.stop.lng, prev.stop.lat];
        const b: Point = [s.lng, s.lat];
        const flight = s.transport === "avion" || s.transport === "barco";
        const coords = flight ? arc(a, b) : [a, b];
        const t = TRANSPORTS[s.transport || "otro"];
        lines.push(line(coords, { flight, color: oklchToRgb(t.color) }));
        const mid = flight ? coords[Math.floor(coords.length / 2)] : ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point);
        const legEl = element(`<div class="leg" title="${t.label}" style="--c: ${t.color}"><i class="icon icon-${t.icon}"></i></div>`);
        legEl.style.pointerEvents = "none";
        tripMarkers.push(new Marker({ element: legEl }).setLngLat(mid).addTo(map!));
      }
      const stopEl = element(
        `<div class="stop${focusStop === s.id ? " active" : ""}" title="${escape(s.name)}"><b>${leg.index + 1}</b><span>${escape(s.name)}</span></div>`,
        500,
      );
      stopEl.addEventListener("click", () => onSelectStop?.(s.id));
      tripMarkers.push(new Marker({ element: stopEl, anchor: "top-left", offset: [-13, -13] }).setLngLat([s.lng, s.lat]).addTo(map!));
    });
    setData("trip", lines);
  });

  // Los lugares y la ruta de cada día.
  $effect(() => {
    if (!map || !ready) return;
    for (const { marker } of markers.values()) marker.remove();
    markers.clear();
    const activeId = untrack(() => selected);

    const byDay = new Map<number, Place[]>();
    for (const p of visible) {
      if (!p.day) continue;
      byDay.set(p.day, [...(byDay.get(p.day) ?? []), p]);
    }
    const routes: Feature[] = [];
    for (const [d, list] of byDay) {
      list.sort((a, b) => a.position - b.position);
      if (list.length < 2) continue;
      const color = days === null ? oklchToRgb(dayColor(d)) : ACCENT;
      routes.push(line(list.map((p) => [p.lng, p.lat]), { color }));
    }
    setData("days", routes);

    for (const p of visible) {
      const order = p.day ? (byDay.get(p.day)?.indexOf(p) ?? -1) + 1 : null;
      const pinEl = element(pinHtml(p, order, p.id === activeId), p.id === activeId ? 1000 : 0);
      pinEl.title = p.name;
      pinEl.addEventListener("click", () => {
        openPopup(p);
        onSelect?.(p.id);
      });
      const marker = new Marker({ element: pinEl }).setLngLat([p.lng, p.lat]).addTo(map);
      markers.set(p.id, { marker, el: pinEl });
    }
    markerVersion = untrack(() => markerVersion) + 1;
  });

  // Encuadre: cuando cambia lo que se está mirando.
  // También al cambiar la escala, para ver el ajuste sobre la ruta o el día.
  let framedFor = "";
  let framedShift = 0;
  $effect(() => {
    if (!map || !ready) return;
    const focus = focusStop ? placed.find((l) => l.stop.id === focusStop)?.stop : null;
    const key = `${days?.join(",") ?? "all"}:${visible.length}:${placed.map((l) => l.stop.id).join(",")}:${focusStop ?? ""}:${inset.top},${inset.right},${inset.bottom},${inset.left}`;
    const shift = zoomOffset;
    if (key === framedFor && shift === framedShift) return;
    const rescaled = key === framedFor;
    framedFor = key;
    framedShift = shift;
    // Con un lugar elegido, la nueva escala se aplica sobre ese lugar.
    if (rescaled && untrack(() => selected)) return;

    const pts: Point[] = visible.map((p) => [p.lng, p.lat]);
    if (focus) pts.push([focus.lng, focus.lat]);
    if (days === null && !focus) for (const l of placed) pts.push([l.stop.lng, l.stop.lat]);

    if (pts.length === 1) flyTo(pts[0], Math.min(13, maxZoom));
    else if (pts.length > 1) flyToBounds(pts, maxZoom);
    else if (center && hasCoords(center)) flyTo([center.lng, center.lat], 11);
  });

  $effect(() => {
    if (!map) return;
    markerVersion;
    for (const id of [paintedSelection, selected]) {
      if (!id) continue;
      const entry = markers.get(id);
      const p = visible.find((place) => place.id === id);
      if (!entry || !p) continue;
      const order = p.day ? visible.filter((place) => place.day === p.day).sort((a, b) => a.position - b.position).findIndex((place) => place.id === id) + 1 : null;
      entry.el.innerHTML = pinHtml(p, order, id === selected);
      entry.el.style.zIndex = id === selected ? "1000" : "";
    }
    paintedSelection = selected;
    if (!selected) {
      centeredSelection = null;
      popup.remove();
      return;
    }
    const entry = markers.get(selected);
    const p = visible.find((place) => place.id === selected);
    if (!entry || !p) return;
    // Se lee siempre: cambiar el acercamiento vuelve a encuadrar el lugar elegido.
    const shift = zoomOffset;
    if (centeredSelection !== selected || centeredOffset !== shift) {
      // Al elegir un lugar no se aleja si ya está más cerca; alejarse o
      // cambiar el acercamiento es pedirlo.
      const target = gl(Math.min(PLACE_ZOOM, maxZoom) + shift);
      const zoom = shift < 0 || centeredSelection === selected ? target : Math.max(map.getZoom(), target);
      const w = el.clientWidth;
      const h = el.clientHeight;
      // El lugar queda en el centro de la parte libre, no debajo de los paneles.
      const offset: [number, number] = [
        Math.max(-w / 4, Math.min(w / 4, (inset.left - inset.right) / 2)),
        Math.max(-h / 4, Math.min(h / 4, (inset.top - inset.bottom) / 2)),
      ];
      map.flyTo({ center: entry.marker.getLngLat(), zoom, offset, duration: flightDuration });
      centeredSelection = selected;
      centeredOffset = shift;
    }
    openPopup(p);
  });

  $effect(() => {
    if (!map) return;
    previewMarker?.remove();
    previewMarker = null;
    if (!preview) return;
    previewMarker = new Marker({ element: element(`<div class="pin preview"><b>+</b></div>`, 900) })
      .setLngLat([preview.lng, preview.lat])
      .addTo(map);
    map.flyTo({ center: [preview.lng, preview.lat], zoom: zoomOffset < 0 ? gl(14 + zoomOffset) : Math.max(map.getZoom(), gl(14 + zoomOffset)), duration: flightDuration });
  });
</script>

<div class="map-shell">
  <div class="map" class:clickable={!!onMapClick} bind:this={el} bind:clientWidth={mapWidth}></div>
  {#if controls && interactive}
    <div class="controls glass" role="toolbar" aria-label="Controles del mapa" style="--free-left: {inset.left}px; --free-right: {inset.right}px">
      <button class:on={base === "map"} onclick={() => setBase("map")}>Mapa</button>
      <button class:on={base === "sat"} onclick={() => setBase("sat")}>Satélite</button>
      <span class="sep"></span>
      <MapLevelControl bind:value={detail} labels={MAP_DETAIL_LABELS} label="Detalle del mapa" name="Detalle"
        icon="layer" lessIcon="layer" moreIcon="layers-01" lessLabel="Menos detalle" moreLabel="Más detalle"
        onchange={saveMapDetail} />
      <span class="sep"></span>
      <MapLevelControl bind:value={zoomLevel} labels={zoomLabels} label="Escala al ir a un lugar" name="Escala"
        icon="maximize-04" lessIcon="minimize-04" moreIcon="maximize-04" lessLabel="Reducir zoom" moreLabel="Aumentar zoom"
        onchange={saveMapZoom} />
      <span class="sep"></span>
      <button class="ic" aria-label="Alejar" onclick={() => map?.zoomOut()}><Icon name="minus-sign" /></button>
      <button class="ic" aria-label="Acercar" onclick={() => map?.zoomIn()}><Icon name="add-01" /></button>
      <button class="ic" aria-label="Ver todo" title="Ver todo" onclick={frameAll}><Icon name="map" /></button>
    </div>
  {/if}
</div>

<style>
  .map-shell {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: inherit;
  }

  .map {
    width: 100%;
    height: 100%;
    min-height: 14rem;
    border-radius: inherit;
    z-index: 0;
    background: var(--canvas);
    font-family: var(--font);
  }

  /* El fondo claro de Google quedaba visible en las uniones de las teselas oscuras. */
  .map :global(.gm-style) {
    background-color: var(--google-map-background, #e5e3df) !important;
  }

  .clickable :global(.maplibregl-canvas-container.maplibregl-interactive) {
    cursor: crosshair;
  }

  /* La cápsula de controles, como la de «3D · + · −». */
  .controls {
    position: absolute;
    /* Centrada en la parte del mapa que no tapan los paneles. */
    left: calc(50% + (var(--free-left, 0px) - var(--free-right, 0px)) / 2);
    bottom: var(--controls-bottom, 1.25rem);
    translate: -50% 0;
    z-index: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem;
    border-radius: var(--pill);

    & button {
      height: 2.125rem;
      padding: 0 0.875rem;
      border: 0;
      border-radius: var(--pill);
      background: transparent;
      font-family: var(--font-display);
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--ink-soft);
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: var(--hover);
      }
      &.on {
        background: var(--pill-on);
        color: var(--pill-on-text);
      }
      &.ic {
        width: 2.125rem;
        padding: 0;
        border-radius: 50%;
        background: var(--glass-soft);
        display: grid;
        place-items: center;
        font-size: 1rem;
      }
    }
    & .sep {
      width: 1px;
      height: 1.25rem;
      margin: 0 0.25rem;
      background: var(--line-strong);
    }
  }

  @media (max-width: 40rem) {
    .controls { gap: 0.1rem; padding: 0.25rem; }
    .controls button { padding: 0 0.5rem; font-size: 0.75rem; }
    .controls button.ic { width: 1.875rem; height: 1.875rem; }
    .controls .sep { margin: 0 0.1rem; }
  }

  /* Marcador de lugar: un círculo de vidrio con el punto de su categoría. */
  .map :global(.pin) {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: oklch(1 0 0 / 0.55);
    backdrop-filter: blur(6px);
    border: 1px solid oklch(1 0 0 / 0.8);
    box-shadow: 0 4px 12px oklch(0.2 0.01 100 / 0.3);
    transition:
      transform 0.2s var(--ease),
      background 0.2s;
  }
  .map :global(.pin i) {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 0 2px white;
  }
  .map :global(.pin b) {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--c);
    color: white;
    font: 600 0.72rem/1 var(--font-display);
  }
  .map :global(.pin:hover) {
    transform: scale(1.15);
  }
  .map :global(.pin.active) {
    transform: scale(1.2);
    background: oklch(0.47 0.29 264);
    border-color: oklch(0.47 0.29 264);
  }
  .map :global(.pin.visited) {
    opacity: 0.5;
  }
  .map :global(.pin.preview) {
    background: oklch(0.93 0.21 122);
    border-color: white;
  }
  .map :global(.pin.preview b) {
    background: oklch(0.17 0.005 100);
    font-size: 1rem;
  }

  /* Parada del recorrido: píldora negra con el número y la ciudad. */
  .map :global(.stop) {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 3px 12px 3px 3px;
    border-radius: 999px;
    background: oklch(0.17 0.005 100);
    color: white;
    box-shadow: 0 6px 16px oklch(0.2 0.01 100 / 0.35);
    white-space: nowrap;
    font: 500 0.8125rem/1 var(--font-display);
    cursor: pointer;
    transition: background 0.2s;
  }
  .map :global(.stop b) {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: oklch(0.93 0.21 122);
    color: oklch(0.17 0.005 100);
    font-weight: 600;
  }
  .map :global(.stop.active),
  .map :global(.stop:hover) {
    background: oklch(0.47 0.29 264);
  }

  .map :global(.leg) {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: oklch(0.17 0.005 100 / 0.85);
    backdrop-filter: blur(6px);
    border: 2px solid var(--c, white);
    color: var(--c, white);
    box-shadow: 0 4px 10px oklch(0.2 0.01 100 / 0.25);
    font-size: 14px;
  }

  /* Google usa blanco por defecto, incluso cuando la aplicación está en oscuro. */
  .map :global(.gm-style-iw-c) {
    background: var(--paper) !important;
    color: var(--ink);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-lg) !important;
    box-shadow: var(--shadow-lg);
    padding: 0.75rem 1rem !important;
  }

  /* El contenido es corto: los carriles blancos de Google no son necesarios. */
  .map :global(.gm-style-iw-d) {
    overflow: auto !important;
    background: transparent;
    color: var(--ink);
    scrollbar-width: none;
  }

  .map :global(.gm-style-iw-d::-webkit-scrollbar) {
    display: none;
    width: 0;
    height: 0;
  }

  .map :global(.gm-style-iw-d::-webkit-scrollbar-corner) {
    background: transparent;
  }

  .map :global(.gm-style-iw-tc::after) {
    background: var(--paper) !important;
  }

  .map :global(.map-pop) {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    color: var(--ink);
  }
  .map :global(.map-pop small) {
    font-size: 0.6875rem;
    color: var(--ink-muted);
  }
  .map :global(.map-pop strong) {
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 500;
  }
  .map :global(.map-pop span) {
    color: var(--ink-muted);
    font-size: 0.75rem;
  }

  /* En móvil el panel sube sobre la mitad baja del mapa. */
  @media (max-width: 60rem) {
    .controls {
      left: 50%;
      bottom: auto;
      top: calc(var(--header-h) + 45dvh - 1rem);
    }
  }
</style>
