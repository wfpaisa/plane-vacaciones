<!--
  La vista pública de un viaje, abierta con un enlace de solo lectura. No
  necesita sesión: muestra origen, ruta, itinerario por día y mapa, sin gastos.
  El mapa se puede ampliar a pantalla completa con el contenido flotando
  encima; al tocar una parada o un lugar, el mapa va hasta él.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import Avatar from "../components/Avatar.svelte";
  import Icon from "../components/Icon.svelte";
  import Logo from "../components/Logo.svelte";
  import TripMap from "../components/TripMap.svelte";
  import { dayColor, PLACE_CATEGORIES, TRANSPORTS } from "../lib/catalog";
  import { dateRange, dayDate, plural, tripLength, weekDate } from "../lib/format";
  import { hasCoords } from "../lib/geo";
  import { pb } from "../lib/pb";
  import { session } from "../lib/session.svelte";
  import { legsOfDay, schedule } from "../lib/stops";
  import { theme } from "../lib/theme.svelte";
  import type { Place, Stop, Traveler, Trip } from "../lib/types";
  import { tripPath } from "../lib/router.svelte";

  let { token }: { token: string } = $props();
  type Shared = { trip: Trip; stops: Stop[]; travelers: Traveler[]; places: Place[] };
  let data = $state<Shared | null>(null);
  let error = $state("");
  let day = $state<number | null>(null);
  let selected = $state<string | null>(null);
  let focusStop = $state<string | null>(null);
  let full = $state(false);
  const query = window.matchMedia("(max-width: 60rem)");
  let mobile = $state(query.matches);
  let height = $state(window.innerHeight);
  let fullButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    const current = token;
    data = null; error = "";
    pb.send<Shared>(`/api/vacaciones/shared/${encodeURIComponent(current)}`, { method: "GET" })
      .then((d) => { if (current === token) { data = d; document.title = `${d.trip.name} · Vacaciones`; } })
      .catch(() => { if (current === token) error = "Este enlace no existe o fue desactivado. Pide uno nuevo a quien te lo compartió."; });
  });

  const legs = $derived(data ? schedule(data.stops) : []);
  const days = $derived.by(() => {
    if (!data) return 0;
    const fromDates = tripLength(data.trip.start_date, data.trip.end_date);
    const fromRoute = legs.length ? legs[legs.length - 1].lastDay : 0;
    const fromPlaces = Math.max(0, ...data.places.map((p) => p.day));
    return Math.max(fromDates, fromRoute, fromPlaces);
  });
  const itinerary = $derived(
    data
      ? Array.from({ length: days }, (_, i) => i + 1).map((n) => ({
          n,
          date: dayDate(data!.trip.start_date, n),
          stops: legsOfDay(legs, n).map((l) => l.stop.name),
          places: data!.places.filter((p) => p.day === n).sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || a.position - b.position),
        }))
      : [],
  );
  const ideas = $derived(data ? data.places.filter((p) => !p.day) : []);
  const center = $derived(data && (data.trip.lat || data.trip.lng) ? { lat: data.trip.lat, lng: data.trip.lng } : null);
  const transport = (s: Stop) => (s.transport ? TRANSPORTS[s.transport] : null);
  const visible = $derived(day === null ? itinerary : itinerary.filter((d) => d.n === day));
  // Lo que tapan los paneles: en pantalla completa, el contenido flota a la derecha (o abajo en móvil).
  const inset = $derived(
    full
      ? mobile ? { top: 80, right: 24, bottom: Math.round(height * .5) + 16, left: 24 } : { top: 70, right: 470, bottom: 80, left: 70 }
      : { top: 60, right: 120, bottom: 70, left: 50 },
  );

  function setDay(n: number | null) {
    day = n;
    selected = null;
    focusStop = null;
  }

  async function setFull(value: boolean) {
    full = value;
    await tick();
    // MapLibre recalcula el tamaño del lienzo con el evento de la ventana.
    window.dispatchEvent(new Event("resize"));
    fullButton?.focus({ preventScroll: true });
  }

  /** Lleva el mapa hasta un lugar; en móvil el mapa queda abajo, así que se amplía. */
  function showPlace(p: Place) {
    if (!hasCoords(p)) return;
    focusStop = null;
    selected = selected === p.id ? null : p.id;
    if (selected && mobile && !full) void setFull(true);
  }

  function showStop(s: Stop) {
    if (!hasCoords(s)) return;
    selected = null;
    focusStop = focusStop === s.id ? null : s.id;
    if (focusStop && mobile && !full) void setFull(true);
  }

  // Al tocar un marcador, el lugar se marca en la lista y queda a la vista.
  async function selectFromMap(id: string) {
    selected = id;
    focusStop = null;
    await tick();
    document.getElementById(`lugar-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async function selectStopFromMap(id: string) {
    selected = null;
    focusStop = focusStop === id ? null : id;
    await tick();
    if (focusStop) document.getElementById(`parada-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  $effect(() => {
    if (!full) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  });

  onMount(() => {
    const change = () => { mobile = query.matches; };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  });
</script>

<svelte:window
  onresize={() => (height = window.innerHeight)}
  onkeydown={(e) => { if (full && e.key === "Escape") { e.preventDefault(); void setFull(false); } }}
/>

{#snippet placeItem(p: Place)}
  {@const cat = p.category ? PLACE_CATEGORIES[p.category] : null}
  {@const located = hasCoords(p)}
  <li id={`lugar-${p.id}`}>
    <button type="button" class="item" class:on={selected === p.id} aria-pressed={selected === p.id} disabled={!located} title={located ? "Ver en el mapa" : "Sin ubicación en el mapa"} onclick={() => showPlace(p)}>
      <span class="cat" style="--c: {cat?.color ?? 'var(--ink-muted)'}"><Icon name={cat?.icon ?? "location-01"} /></span>
      <span class="text">
        <strong>{#if p.time}<span class="time">{p.time}</span>{/if}{p.name}</strong>
        {#if p.address}<span class="muted">{p.address}</span>{/if}
        {#if p.notes}<span class="note">{p.notes}</span>{/if}
      </span>
      {#if located}<Icon name="location-01" class="locate" />{/if}
    </button>
    {#if p.link}<a class="more" href={p.link} target="_blank" rel="noopener noreferrer nofollow">Ver más</a>{/if}
  </li>
{/snippet}

<header class="bar">
  <Logo />
  <div class="right">
    <span class="readonly"><Icon name="view" /> Solo lectura</span>
    {#if session.user && data}<a class="btn sm" href={tripPath(data.trip.id)}>Abrir para editar</a>{/if}
    <button type="button" class="btn icon sm round" aria-label={theme.dark ? "Usar tema claro" : "Usar tema oscuro"} onclick={() => theme.toggle()}>
      <Icon name={theme.dark ? "sun-03" : "moon-02"} />
    </button>
  </div>
</header>

{#if error}
  <div class="state">
    <Icon name="link-off" size={40} />
    <h2>Enlace no disponible</h2>
    <p class="muted">{error}</p>
  </div>
{:else if !data}
  <div class="state"><span class="loader"></span></div>
{:else}
  <main class="shared">
    <section class="intro">
      <p class="eyebrow">{data.trip.destination || "Viaje"}</p>
      <h1>{data.trip.name}</h1>
      <p class="meta">
        {#if data.trip.origin}<span><Icon name="location-01" /> Desde {data.trip.origin}</span>{/if}
        <span><Icon name="calendar-03" /> {dateRange(data.trip.start_date, data.trip.end_date)}</span>
        {#if days}<span>{plural(days, "día", "días")}</span>{/if}
      </p>
      {#if data.travelers.length}
        <div class="faces" aria-label="Viajeros">
          {#each data.travelers as t (t.id)}<Avatar traveler={t} size={30} ring />{/each}
          <span class="muted">{data.travelers.map((t) => t.name).join(", ")}</span>
        </div>
      {/if}
      {#if data.trip.notes}<p class="notes">{data.trip.notes}</p>{/if}
    </section>

    <div class="layout" class:full role={full ? "dialog" : undefined} aria-modal={full ? true : undefined} aria-label={full ? "Mapa a pantalla completa" : undefined}>
      <div class="map card">
        <TripMap
          places={data.places}
          {legs}
          {center}
          {selected}
          {focusStop}
          {inset}
          days={day === null ? null : [day]}
          maxZoom={14}
          onSelect={selectFromMap}
          onSelectStop={selectStopFromMap}
        />
        <button type="button" class="expand glass" bind:this={fullButton} aria-pressed={full} onclick={() => setFull(!full)}>
          <Icon name={full ? "arrow-shrink-02" : "arrow-expand-02"} size={16} />
          {full ? "Salir" : "Pantalla completa"}
        </button>
      </div>

      <div class="column">
        {#if full}
          <div class="panel-head">
            <strong>{data.trip.name}</strong>
            <span class="muted">{dateRange(data.trip.start_date, data.trip.end_date)}</span>
          </div>
        {/if}

        {#if legs.length}
          <section class="card block">
            <h2>Ruta</h2>
            <ol class="route">
              {#if data.trip.origin}
                <li class="origin"><span class="dot"></span><div class="text"><strong>{data.trip.origin}</strong><span class="muted">Salida</span></div></li>
              {/if}
              {#each legs as l (l.stop.id)}
                {@const located = hasCoords(l.stop)}
                <li id={`parada-${l.stop.id}`}>
                  <span class="dot" style="--c: {transport(l.stop)?.color ?? 'var(--accent)'}"></span>
                  <button type="button" class="item stop" class:on={focusStop === l.stop.id} aria-pressed={focusStop === l.stop.id} disabled={!located} title={located ? "Ver en el mapa" : "Sin ubicación en el mapa"} onclick={() => showStop(l.stop)}>
                    <span class="text">
                      <strong>{l.stop.name}</strong>
                      <span class="muted">
                        {plural(l.stop.nights, "noche", "noches")} · {weekDate(dayDate(data.trip.start_date, l.firstDay))}
                        · llegada en {transport(l.stop)?.label.toLowerCase() ?? "otro medio"}
                      </span>
                      {#if l.stop.notes}<span class="note">{l.stop.notes}</span>{/if}
                    </span>
                    {#if located}<Icon name="location-01" class="locate" />{/if}
                  </button>
                </li>
              {/each}
            </ol>
          </section>
        {/if}

        {#if days}
          <section class="card block">
            <div class="block-head">
              <h2>Itinerario</h2>
              <div class="days" role="group" aria-label="Filtrar por día">
                <button type="button" class="chip" aria-pressed={day === null} onclick={() => setDay(null)}>Todos</button>
                {#each itinerary as d (d.n)}
                  <button type="button" class="chip" aria-pressed={day === d.n} onclick={() => setDay(day === d.n ? null : d.n)}>Día {d.n}</button>
                {/each}
              </div>
            </div>
            {#each visible as d (d.n)}
              <article class="day">
                <header>
                  <span class="badge" style="--c: {dayColor(d.n)}">{d.n}</span>
                  <div>
                    <strong>{weekDate(d.date) || `Día ${d.n}`}</strong>
                    {#if d.stops.length}<span class="muted">{d.stops.join(" → ")}</span>{/if}
                  </div>
                </header>
                {#if d.places.length}
                  <ul class="places">
                    {#each d.places as p (p.id)}{@render placeItem(p)}{/each}
                  </ul>
                {:else}
                  <p class="muted empty">Día libre.</p>
                {/if}
              </article>
            {/each}
          </section>
        {/if}

        {#if ideas.length && day === null}
          <section class="card block">
            <h2>Ideas sin día</h2>
            <ul class="places ideas">
              {#each ideas as p (p.id)}{@render placeItem(p)}{/each}
            </ul>
          </section>
        {/if}
      </div>

    </div>
  </main>
{/if}

<style>
  .bar { position: sticky; top: 0; z-index: 600; display: flex; align-items: center; justify-content: space-between; height: var(--header-h); padding: 0 clamp(1rem, 2.5vw, 2rem); background: color-mix(in oklch, var(--canvas) 80%, transparent); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border-bottom: 1px solid var(--line); }
  .right { display: flex; align-items: center; gap: .5rem; }
  .readonly { display: inline-flex; align-items: center; gap: .375rem; padding: .25rem .625rem; border-radius: var(--pill); background: var(--accent-soft); color: var(--accent-ink); font-size: .75rem; font-weight: 600; }

  .state { display: flex; flex-direction: column; align-items: center; gap: .75rem; padding: 6rem 1rem; text-align: center; color: var(--ink-muted); }
  .state h2 { color: var(--ink); }

  .shared { max-width: 80rem; margin: 0 auto; padding: 1.5rem clamp(1rem, 2.5vw, 2rem) 4rem; }
  .intro { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1.5rem; }
  h1 { font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 600; line-height: 1.1; }
  h2 { font-size: 1.0625rem; font-weight: 600; }
  .meta { display: flex; flex-wrap: wrap; gap: .375rem 1rem; font-size: .875rem; color: var(--ink-soft); }
  .meta span { display: inline-flex; align-items: center; gap: .375rem; }
  .faces { display: flex; align-items: center; gap: .25rem; flex-wrap: wrap; font-size: .8125rem; }
  .faces .muted { margin-left: .5rem; }
  .notes { max-width: 48rem; font-size: .875rem; line-height: 1.6; color: var(--ink-soft); white-space: pre-line; }

  .layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
  .map { position: sticky; top: calc(var(--header-h) + 1rem); height: calc(100dvh - var(--header-h) - 2rem); min-height: 22rem; overflow: hidden; }
  .column { display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }
  .block { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; }
  .block-head { display: flex; flex-direction: column; gap: .75rem; }
  .days { display: flex; gap: .375rem; overflow-x: auto; scrollbar-width: none; }
  .days::-webkit-scrollbar { display: none; }
  .days .chip { flex-shrink: 0; }

  .expand { position: absolute; z-index: 560; top: .75rem; right: .75rem; display: inline-flex; align-items: center; gap: .375rem; min-height: 2.25rem; padding: .375rem .75rem; border-radius: var(--pill); color: var(--ink); font: 550 .8125rem var(--font); cursor: pointer; }
  .expand:hover { background: var(--paper); }
  /* Los controles del mapa van abajo y centrados en la tarjeta. */
  .map :global(.controls) { top: auto; bottom: 1rem; }

  /* Pantalla completa: el mapa ocupa toda la ventana y el contenido flota encima. */
  .layout.full { position: fixed; inset: 0; z-index: 1200; display: block; background: var(--canvas); }
  .full .map { position: absolute; inset: 0; height: 100%; min-height: 0; border: 0; border-radius: 0; box-shadow: none; }
  .full .expand { top: max(1rem, env(safe-area-inset-top)); right: auto; left: max(1rem, env(safe-area-inset-left)); }
  .full .column { position: absolute; z-index: 570; top: 1rem; right: 1rem; bottom: 1rem; width: 27rem; gap: .75rem; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding: .25rem; }
  .full .column .card { background: var(--glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border-color: var(--glass-line); }
  .panel-head { display: flex; flex-direction: column; gap: .125rem; padding: .875rem 1.25rem; border-radius: var(--r); background: var(--glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border: 1px solid var(--glass-line); }
  .panel-head strong { font-size: 1.0625rem; }
  .panel-head .muted { font-size: .8125rem; }

  /* Una parada o un lugar: toda la fila lleva el mapa hasta él. */
  .item { display: flex; align-items: flex-start; gap: .625rem; width: 100%; margin: -.375rem -.5rem; padding: .375rem .5rem; border: 0; border-radius: calc(var(--r) * .6); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background .15s; box-sizing: content-box; }
  .item:hover:not(:disabled) { background: var(--paper-deep); }
  .item.on, .item.on:hover { background: var(--accent); color: var(--on-accent); }
  .item.on .muted, .item.on .note, .item.on .time { color: color-mix(in oklch, var(--on-accent) 82%, transparent); }
  .item.on .cat { background: color-mix(in oklch, var(--on-accent) 22%, transparent); color: var(--on-accent); }
  .item:disabled { cursor: default; }
  .item :global(.locate) { flex-shrink: 0; margin: .3rem 0 0 auto; color: var(--ink-muted); opacity: 0; transition: opacity .15s; }
  .item:hover :global(.locate), .item:focus-visible :global(.locate), .item.on :global(.locate) { opacity: 1; }
  .item.on :global(.locate) { color: var(--on-accent); }
  .text { display: flex; flex-direction: column; gap: .125rem; min-width: 0; }

  .route { display: flex; flex-direction: column; padding: 0; margin: 0; list-style: none; }
  .route li { position: relative; display: flex; gap: .875rem; padding-bottom: 1rem; }
  .route li:last-child { padding-bottom: 0; }
  .route li:not(:last-child)::before { content: ""; position: absolute; left: .4375rem; top: 1.125rem; bottom: 0; width: 2px; background: var(--line-strong); }
  .route .item { margin-left: -.5rem; }
  .route strong { font-size: .9375rem; }
  .route .muted { font-size: .8125rem; }
  .dot { flex-shrink: 0; width: 1rem; height: 1rem; margin-top: .125rem; border-radius: 50%; border: 3px solid var(--c, var(--accent)); background: var(--canvas); }
  .origin .dot { border-color: var(--ink-muted); border-style: dashed; }

  .day { display: flex; flex-direction: column; gap: .625rem; padding-top: 1rem; border-top: 1px solid var(--line); }
  .day:first-of-type { padding-top: 0; border-top: 0; }
  .day header { display: flex; align-items: center; gap: .75rem; }
  .day header div { display: flex; flex-direction: column; }
  .day header .muted { font-size: .8125rem; }
  .badge { display: grid; place-items: center; flex-shrink: 0; width: 2rem; height: 2rem; border-radius: 50%; background: var(--c); color: white; font-size: .8125rem; font-weight: 700; }
  .empty { font-size: .8125rem; padding-left: 2.75rem; }

  .places { display: flex; flex-direction: column; gap: .75rem; padding: 0 0 0 2.75rem; margin: 0; list-style: none; }
  .places.ideas { padding-left: 0; }
  .places li { display: flex; flex-direction: column; gap: .125rem; padding: .375rem .5rem; }
  .places strong { font-size: .875rem; font-weight: 550; }
  .places .muted { font-size: .75rem; overflow-wrap: anywhere; }
  .more { align-self: flex-start; margin-left: 2.375rem; font-size: .75rem; color: var(--accent-ink); }
  .cat { display: grid; place-items: center; flex-shrink: 0; width: 1.75rem; height: 1.75rem; border-radius: .5rem; background: color-mix(in oklch, var(--c) 18%, transparent); color: var(--c); }
  .time { margin-right: .5rem; font-variant-numeric: tabular-nums; color: var(--accent-ink); }
  .note { font-size: .8125rem; line-height: 1.5; color: var(--ink-soft); white-space: pre-line; }

  @media (max-width: 60rem) {
    .layout { grid-template-columns: 1fr; }
    .map { position: relative; top: 0; height: 22rem; min-height: 0; }
    .places, .empty { padding-left: 0; }
    /* En móvil el contenido sube como una hoja sobre la mitad baja del mapa. */
    .full .column { top: auto; left: .5rem; right: .5rem; bottom: .5rem; width: auto; max-height: 50dvh; }
    .full .map :global(.controls) { top: max(1rem, env(safe-area-inset-top)); bottom: auto; left: calc(50% - 3rem); }
  }
  @media (max-width: 32rem) {
    .readonly { display: none; }
    .full .map :global(.controls) { display: none; }
  }
</style>
