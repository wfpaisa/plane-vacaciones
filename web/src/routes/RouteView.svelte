<!--
  La ruta del viaje: las ciudades en orden, cuántas noches en cada una y cómo
  se llega de una a otra. Las fechas de cada parada salen de la fecha de ida y
  de las noches de las anteriores.
-->
<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import PlaceSearch from "../components/PlaceSearch.svelte";
  import TripMap from "../components/ProviderMap.svelte";

  let map: { openFullscreen(): void } | undefined = $state();
  import { TRANSPORTS } from "../lib/catalog";
  import { dayDate, plural, shortDate } from "../lib/format";
  import type { GeoResult } from "../lib/geo";
  import { errorText } from "../lib/pb";
  import { tripPath } from "../lib/router.svelte";
  import { countryOf, schedule, totalNights } from "../lib/stops";
  import { toast } from "../lib/toast.svelte";
  import type { TripStore } from "../lib/tripStore.svelte";
  import type { Stop, Transport } from "../lib/types";

  let { store }: { store: TripStore } = $props();

  const trip = $derived(store.trip!);
  const legs = $derived(schedule(store.stops));
  const nights = $derived(totalNights(store.stops));
  const km = $derived(legs.reduce((a, l) => a + l.km, 0));
  // La leyenda muestra solo los medios que aparecen en la ruta, en el orden del catálogo.
  const usedTransports = $derived(
    (Object.keys(TRANSPORTS) as Transport[]).filter((k) => legs.slice(1).some((l) => (l.stop.transport || "otro") === k)),
  );
  const countries = $derived(new Set(store.stops.map((s) => s.country).filter(Boolean)).size);

  let focus = $state<string | null>(null);

  // Toda la tarjeta elige la ciudad, y un segundo clic la suelta. Sus botones y
  // el enlace a los lugares hacen otra cosa y no deben mover el mapa. El nombre
  // solo elige: hacer clic para editarlo no debe soltar la ciudad.
  function pickCard(e: MouseEvent, id: string) {
    const target = e.target as HTMLElement;
    if (target.closest("select, a, button:not(.n)")) return;
    focus = focus === id && !target.closest("input") ? null : id;
  }

  let query = $state("");
  let newNights = $state(2);
  let newTransport = $state<Transport>("tren");

  const placesOf = (id: string) => store.places.filter((p) => p.stop === id).length;
  const spentOf = (id: string) => store.expenses.filter((e) => e.stop === id).reduce((a, e) => a + e.amount, 0);

  async function add(r: GeoResult) {
    try {
      const rec = await store.saveStop({
        name: r.name,
        address: r.address,
        country: countryOf(r.address),
        lat: r.lat,
        lng: r.lng,
        geo_provider: r.provider ?? "openstreetmap",
        google_place_id: r.placeId ?? "",
        nights: newNights,
        transport: store.stops.length ? newTransport : "avion",
        position: store.stops.length,
      });
      if (!trip.lat && !trip.lng) await store.updateTrip({ lat: r.lat, lng: r.lng });
      focus = rec.id;
      query = "";
      toast.ok(`${rec.name} agregada a la ruta.`);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function patch(s: Stop, data: Partial<Stop>) {
    try {
      await store.saveStop(data, s.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function move(i: number, delta: number) {
    const ids = legs.map((l) => l.stop.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await store.reorderStops(ids);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function remove(s: Stop) {
    const n = placesOf(s.id);
    const msg = n ? `¿Quitar ${s.name} de la ruta? Sus ${n} lugares quedarán sin ciudad asignada.` : `¿Quitar ${s.name} de la ruta?`;
    if (!confirm(msg)) return;
    try {
      await store.deleteStop(s.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }
</script>

<div class="route-view">
  <div class="mobile-map-action">
    <button class="glass" onclick={() => map?.openFullscreen()}>
      <Icon name="arrow-expand-01" size={18} /> Ver mapa completo
    </button>
  </div>
  <section class="panel glass">
    <header class="summary">
      <div><strong>{legs.length}</strong><span>{legs.length === 1 ? "ciudad" : "ciudades"}</span></div>
      <div><strong>{countries}</strong><span>{countries === 1 ? "país" : "países"}</span></div>
      <div><strong>{nights}</strong><span>noches</span></div>
      <div><strong class="num">{Math.round(km).toLocaleString("es-CO")}</strong><span>km línea recta</span></div>
    </header>

    {#if !legs.length}
      <div class="empty">
        <Icon name="route-01" size={24} />
        <p>Agregue la primera ciudad para crear la ruta del viaje.</p>
      </div>
    {:else}
      <ol class="legs">
        {#each legs as leg, i (leg.stop.id)}
          {@const s = leg.stop}
          <li class:active={focus === s.id}>
            <div class="transfer">
              <span class="tline"></span>
              <label class="how">
                <Icon name={TRANSPORTS[s.transport || "otro"].icon} />
                <select
                  value={s.transport || "otro"}
                  aria-label="Cómo se llega a {s.name}"
                  onchange={(e) => patch(s, { transport: e.currentTarget.value as Transport })}
                >
                  {#each Object.entries(TRANSPORTS) as [k, t] (k)}<option value={k}>{t.label}</option>{/each}
                </select>
              </label>
              <span class="dist">
                {#if i === 0}Llegada{:else}{Math.round(leg.km).toLocaleString("es-CO")} km desde {legs[i - 1].stop.name}{/if}
              </span>
            </div>

            <!-- El número sigue siendo el botón accesible; el clic en la tarjeta es un atajo para el ratón. -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
            <article class="stop" onclick={(e) => pickCard(e, s.id)}>
              <button class="n" title={focus === s.id ? "Dejar de ver en el mapa" : "Ver en el mapa"} aria-pressed={focus === s.id}>{i + 1}</button>
              <div class="info">
                <input
                  class="name"
                  value={s.name}
                  aria-label="Nombre de la ciudad"
                  onchange={(e) => patch(s, { name: e.currentTarget.value.trim() || s.name })}
                />
                <p class="muted">
                  {s.country ? `${s.country} · ` : ""}{shortDate(dayDate(trip.start_date, leg.firstDay))} – {shortDate(
                    dayDate(trip.start_date, leg.lastDay),
                  )}
                </p>
                <p class="meta">
                  <a href={tripPath(trip.id, "lugares")}>{plural(placesOf(s.id), "lugar", "lugares")}</a>
                  {#if spentOf(s.id)}<span>· {store.money(spentOf(s.id))} en gastos</span>{/if}
                </p>
              </div>
              <div class="stepper" aria-label="Noches en {s.name}">
                <button class="btn icon sm" aria-label="Una noche menos" disabled={s.nights <= 0} onclick={() => patch(s, { nights: s.nights - 1 })}>
                  <Icon name="minus-sign" />
                </button>
                <span><strong>{s.nights}</strong> {s.nights === 1 ? "noche" : "noches"}</span>
                <button class="btn icon sm" aria-label="Una noche más" onclick={() => patch(s, { nights: s.nights + 1 })}>
                  <Icon name="add-01" />
                </button>
              </div>
              <div class="acts">
                <button class="btn ghost icon sm" aria-label="Mover {s.name} antes" disabled={i === 0} onclick={() => move(i, -1)}>
                  <Icon name="arrow-up-01" />
                </button>
                <button class="btn ghost icon sm" aria-label="Mover {s.name} después" disabled={i === legs.length - 1} onclick={() => move(i, 1)}>
                  <Icon name="arrow-down-01" />
                </button>
                <button class="btn ghost icon sm" aria-label="Quitar {s.name} de la ruta" onclick={() => remove(s)}>
                  <Icon name="delete-02" />
                </button>
              </div>
            </article>
          </li>
        {/each}
      </ol>
    {/if}

    <div class="add">
      <span class="label">Agregar ciudad</span>
      <div class="row">
        <div class="grow"><PlaceSearch bind:value={query} placeholder="Buscar ciudad: París, Roma, Lisboa…" onPick={add} /></div>
        <label class="mini">
          <input class="input num" type="number" min="0" max="90" bind:value={newNights} aria-label="Noches" />
          <span>noches</span>
        </label>
        {#if store.stops.length}
          <select class="select mini-select" bind:value={newTransport} aria-label="Cómo se llega">
            {#each Object.entries(TRANSPORTS) as [k, t] (k)}<option value={k}>{t.label}</option>{/each}
          </select>
        {/if}
      </div>
    </div>
  </section>

  <div class="stage">
    <TripMap
      bind:this={map}
      places={store.places}
      {legs}
      showPlaces={false}
      focusStop={focus}
      center={trip.lat || trip.lng ? { lat: trip.lat, lng: trip.lng } : null}
      onSelectStop={(id) => (focus = focus === id ? null : id)}
      inset={{ top: 190, right: 60, bottom: 110, left: 520 }}
    />
    {#if usedTransports.length}
      <div class="legend glass" aria-label="Colores de los trayectos">
        {#each usedTransports as k (k)}
          {@const t = TRANSPORTS[k]}
          <span style="--c: {t.color}"><i class:dashed={k === "avion" || k === "barco"}></i>{t.label}</span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .mobile-map-action { display: none; }
  @media (max-width: 60rem) {
    .mobile-map-action { position: relative; z-index: 3; display: flex; justify-content: flex-end; margin-bottom: .75rem; pointer-events: auto; }
    .mobile-map-action button { display: flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: .625rem 1rem; border-radius: var(--r); color: var(--ink); font: 550 .8125rem var(--font); cursor: pointer; white-space: nowrap; }
  }
  .route-view {
    position: relative;
    height: 100%;
    min-height: 0;
    pointer-events: none;
  }

  .panel {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    width: min(30rem, 100%);
    height: 100%;
    min-height: 0;
    border-radius: var(--r-xl);
    overflow: hidden;
    pointer-events: auto;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-bottom: 1px solid var(--line);

    & div {
      display: flex;
      flex-direction: column;
      padding: 0.875rem 1rem;
      & + div {
        border-left: 1px solid var(--line);
      }
    }
    & strong {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 300;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    & span {
      font-size: 0.75rem;
      color: var(--ink-muted);
    }
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem 1rem;
    color: var(--ink-muted);
  }

  .legs {
    flex: 1;
    overflow-y: auto;
    margin: 0;
    padding: 0.5rem 1rem 1rem;
    list-style: none;
  }

  .transfer {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem 0 0.375rem 0.25rem;
    min-height: 2.5rem;
  }

  .tline {
    align-self: stretch;
    width: 0;
    margin: 0 0.5rem 0 0.625rem;
    border-left: 2px dotted var(--line-strong);
  }

  .how {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.25rem 0.125rem 0.5rem;
    border: 1px solid var(--glass-line);
    border-radius: var(--pill);
    background: var(--glass-soft);
    color: var(--ink-soft);
    font-size: 0.75rem;

    & select {
      border: 0;
      background: none;
      font-size: 0.75rem;
      font-weight: 550;
      color: inherit;
      cursor: pointer;
    }
  }

  .dist {
    font-size: 0.75rem;
    color: var(--ink-muted);
  }

  .stop {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--glass-line);
    border-radius: var(--r-lg);
    background: var(--glass-soft);
    cursor: pointer;
    transition:
      background 0.25s,
      color 0.25s,
      box-shadow 0.25s;
  }

  /* La parada elegida: la tarjeta azul eléctrica. */
  li.active .stop {
    background: var(--accent);
    border-color: transparent;
    color: var(--on-accent);
    box-shadow: 0 16px 32px -12px oklch(0.47 0.29 264 / 0.6);
    --ink: var(--on-accent);
    --ink-muted: oklch(1 0 0 / 0.72);
    --accent-ink: var(--lime);
    --line-strong: oklch(1 0 0 / 0.3);

    & .n {
      background: var(--lime);
      color: oklch(0.17 0.005 100);
    }
    & :global(.btn) {
      color: inherit;
      background: oklch(1 0 0 / 0.14);
      border-color: transparent;
    }
  }

  .n {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
    border: 0;
    border-radius: 50%;
    background: var(--pill-on);
    color: var(--pill-on-text);
    font-family: var(--font-display);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
  }

  .info {
    flex: 1;
    min-width: 0;

    & p {
      font-size: 0.75rem;
    }
  }

  .name {
    width: 100%;
    padding: 0;
    border: 0;
    border-bottom: 1px solid transparent;
    background: none;
    font-family: var(--font-display);
    font-size: 1.0625rem;
    font-weight: 500;
    color: inherit;
    &:hover,
    &:focus {
      outline: none;
      border-bottom-color: var(--line-strong);
    }
  }

  .meta {
    margin-top: 0.125rem;
    color: var(--ink-muted);

    & a {
      color: var(--accent-ink);
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--ink-muted);
    white-space: nowrap;

    & strong {
      color: var(--ink);
      font-size: 0.875rem;
    }
    & .btn {
      width: 1.75rem;
      height: 1.75rem;
    }
  }

  .acts {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    & .btn {
      width: 1.75rem;
      height: 1.5rem;
    }
  }

  .add {
    padding: 0.875rem 1rem 1rem;
    border-top: 1px solid var(--line);

    & .label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 550;
      color: var(--ink-soft);
    }
    & .row {
      display: flex;
      gap: 0.5rem;
    }
    & .grow {
      flex: 1;
      min-width: 0;
    }
  }

  .mini {
    position: relative;
    width: 6.25rem;
    flex-shrink: 0;
    & input {
      padding-right: 3.25rem;
    }
    & span {
      position: absolute;
      right: 0.625rem;
      top: 50%;
      translate: 0 -50%;
      font-size: 0.75rem;
      color: var(--ink-muted);
      pointer-events: none;
    }
  }

  .mini-select {
    width: 6.25rem;
    flex-shrink: 0;
  }

  /* Encima de los créditos del mapa, que ocupan la esquina inferior derecha. */
  .legend {
    position: fixed;
    right: clamp(1rem, 2.5vw, 2rem);
    bottom: 2.75rem;
    z-index: 3;
    pointer-events: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.875rem;
    max-width: calc(100% - 1.5rem);
    padding: 0.4rem 0.875rem;
    border-radius: var(--pill);
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--ink-soft);

    & span {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    /* Una muestra del trazo: continuo por tierra, punteado en avión y barco. */
    & i {
      width: 1.125rem;
      height: 3px;
      border-radius: 2px;
      background: var(--c);
      &.dashed {
        background: repeating-linear-gradient(90deg, var(--c) 0 4px, transparent 4px 7px);
      }
    }
  }

  @media (max-width: 60rem) {
    .legend {
      display: none;
    }
    .route-view {
      height: auto;
      padding-top: 45dvh;
    }
    .panel {
      width: 100%;
      height: auto;
    }
    .legs {
      overflow: visible;
    }
  }
</style>
