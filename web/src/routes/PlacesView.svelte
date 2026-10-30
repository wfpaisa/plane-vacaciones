<!--
  Lugares y mapa. A la izquierda el plan día a día, con los lugares que se
  arrastran de un día a otro; a la derecha el mapa con las rutas. Se agrega un
  lugar buscándolo o tocando el mapa.
-->
<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import Modal from "../components/Modal.svelte";
  import PlaceForm from "../components/PlaceForm.svelte";
  import PlaceSearch from "../components/PlaceSearch.svelte";
  import TripMap from "../components/ProviderMap.svelte";

  let map: { openFullscreen(): void } | undefined = $state();
  import { dayColor, PLACE_CATEGORIES } from "../lib/catalog";
  import { dayDate, plural, tripLength, weekDate } from "../lib/format";
  import { distanceKm, type GeoResult, hasCoords, reverseGeocode } from "../lib/geo";
  import { errorText } from "../lib/pb";
  import { legsOfDay, nearestStop, schedule, stopOfDay } from "../lib/stops";
  import { toast } from "../lib/toast.svelte";
  import type { TripStore } from "../lib/tripStore.svelte";
  import type { Place } from "../lib/types";
  import TripCalendar from "../components/TripCalendar.svelte";

  let { store }: { store: TripStore } = $props();

  const trip = $derived(store.trip!);
  const days = $derived(tripLength(trip.start_date, trip.end_date));
  const lastDay = $derived(Math.max(days, ...store.places.map((p) => p.day)));

  const legs = $derived(schedule(store.stops));
  const multi = $derived(legs.length > 1);

  /** Ciudad elegida (null = todas) y día elegido dentro de ella (null = todos). */
  let city = $state<string | null>(null);
  let filter = $state<number | null>(null);
  const cityLeg = $derived(legs.find((l) => l.stop.id === city) ?? null);
  const dayRange = $derived(
    cityLeg
      ? Array.from({ length: cityLeg.lastDay - cityLeg.firstDay + 1 }, (_, i) => cityLeg.firstDay + i)
      : Array.from({ length: lastDay }, (_, i) => i + 1),
  );
  const stopName = (id: string) => store.stops.find((s) => s.id === id)?.name ?? "";
  const cityOfDay = (d: number) => legsOfDay(legs, d).map((l) => l.stop.name).join(" → ");

  function pickCity(id: string | null) {
    city = id;
    filter = null;
    selected = null;
  }
  function pickDay(day: number | null) {
    filter = day;
    selected = null;
  }
  const dayCounts = $derived.by(() => {
    const counts: Record<number, number> = {};
    for (const place of store.places) counts[place.day] = (counts[place.day] ?? 0) + 1;
    return counts;
  });
  let selected = $state<string | null>(null);
  $effect(() => {
    if (city && !legs.some((leg) => leg.stop.id === city)) pickCity(null);
    else if (filter !== null && filter > 0 && !dayRange.includes(filter)) pickDay(null);
  });
  let preview = $state<GeoResult | null>(null);
  let query = $state("");
  let form = $state<{ initial: Partial<Place>; id?: string } | null>(null);
  let busy = $state(false);

  const groups = $derived(
    [0, ...dayRange].map((d) => {
      const items = store.places
        .filter((p) => p.day === d && (d !== 0 || !city || p.stop === city))
        .sort((a, b) => a.position - b.position || a.created.localeCompare(b.created));
      let km = 0;
      const pts = items.filter(hasCoords);
      for (let i = 1; i < pts.length; i++) km += distanceKm(pts[i - 1], pts[i]);
      return { day: d, items, km };
    }).filter((g) => filter === null || g.day === filter),
  );

  const center = $derived(hasCoords(trip) ? { lat: trip.lat, lng: trip.lng } : null);

  /** Dónde buscar primero: la ciudad elegida, la del día elegido o el destino. */
  const near = $derived.by(() => {
    const s = cityLeg?.stop ?? (filter ? stopOfDay(legs, filter) : null);
    return s && hasCoords(s) ? { lat: s.lat, lng: s.lng } : center;
  });

  const mapPlaces = $derived(
    cityLeg ? store.places.filter((p) => p.stop === city || dayRange.includes(p.day)) : store.places,
  );

  function openNew(r: GeoResult) {
    preview = r;
    form = {
      initial: {
        name: r.name,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        geo_provider: r.provider ?? "openstreetmap",
        google_place_id: r.placeId ?? "",
        day: filter ?? 0,
        stop: city ?? (filter ? stopOfDay(legs, filter)?.id : nearestStop(store.stops, r)?.id) ?? "",
        category: guessCategory(r.kind),
      },
    };
  }

  function guessCategory(kind: string): Place["category"] {
    if (/hotel|hostel|guest|apartment|motel|lodging/.test(kind)) return "alojamiento";
    if (/restaurant|cafe|bar|fast_food|pub|ice_cream|bakery/.test(kind)) return "comida";
    if (/beach|coast/.test(kind)) return "playa";
    if (/park|peak|wood|water|nature|forest|garden|volcano|waterfall/.test(kind)) return "naturaleza";
    if (/mall|shop|market|supermarket/.test(kind)) return "compras";
    if (/airport|station|bus|aerodrome|terminal|ferry/.test(kind)) return "transporte";
    return "atraccion";
  }

  async function mapClick(lat: number, lng: number) {
    preview = { name: "Punto en el mapa", address: "", lat, lng, kind: "" };
    const found = await reverseGeocode(lat, lng).catch(() => null);
    openNew(found ? { ...found, lat, lng } : { name: "", address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, kind: "" });
  }

  async function save(data: Partial<Place>) {
    if (!form) return;
    busy = true;
    try {
      const base = form.initial;
      const moved = !form.id || base.day !== data.day;
      const position = moved ? store.places.filter((p) => p.day === data.day).length : base.position;
      const rec = await store.savePlace({ ...base, ...data, position }, form.id);
      toast.ok(form.id ? "Lugar actualizado." : `«${rec.name}» quedó en el plan.`);
      selected = rec.id;
      close();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!form?.id) return;
    const id = form.id;
    close();
    try {
      await store.deletePlace(id);
      toast.info("Lugar quitado del plan.");
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function close() {
    form = null;
    preview = null;
    query = "";
  }

  async function toggleVisited(p: Place) {
    try {
      await store.savePlace({ visited: !p.visited }, p.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  // ——— Arrastrar y soltar ———
  let dragging = $state<string | null>(null);
  let over = $state<{ day: number; before: string | null } | null>(null);

  function dropOn(day: number, before: string | null) {
    const id = dragging;
    dragging = null;
    over = null;
    if (!id) return;
    const ids = store.places
      .filter((p) => p.day === day && p.id !== id)
      .sort((a, b) => a.position - b.position)
      .map((p) => p.id);
    const at = before ? ids.indexOf(before) : -1;
    ids.splice(at === -1 ? ids.length : at, 0, id);
    store.reorder(day, ids).catch((err) => toast.error(errorText(err)));
    // Al pasar a un día de otra ciudad, el lugar cambia de ciudad.
    const target = day ? stopOfDay(legs, day) : null;
    const place = store.places.find((p) => p.id === id);
    if (target && place && place.stop !== target.id && !legsOfDay(legs, day).some((l) => l.stop.id === place.stop)) {
      store.savePlace({ stop: target.id }, id).catch((err) => toast.error(errorText(err)));
    }
  }

  function move(p: Place, delta: number) {
    const ids = groups.find((g) => g.day === p.day)!.items.map((x) => x.id);
    const i = ids.indexOf(p.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    store.reorder(p.day, ids).catch((err) => toast.error(errorText(err)));
  }
</script>

<div class="places-view">
  <div class="mobile-map-action">
    <button class="glass" onclick={() => map?.openFullscreen()}>
      <Icon name="arrow-expand-01" size={18} /> Ver mapa completo
    </button>
  </div>
  <aside class="plan glass">
    <div class="tools">
      <PlaceSearch bind:value={query} {near} placeholder="Agregar un lugar: playa, museo, hotel…" onPick={openNew} />
      <p class="hint"><Icon name="information-circle" /> También puede hacer clic en el mapa para marcar un punto.</p>
      <div class="filter-selectors" class:single={!multi}>
        {#if multi}
          <label class="city-picker">
            <span>Ciudad</span>
            <select class="select" aria-label="Filtrar por ciudad" value={city ?? ""} onchange={(e) => pickCity(e.currentTarget.value || null)}>
              <option value="">Todas las ciudades</option>
              {#each legs as leg (leg.stop.id)}
                <option value={leg.stop.id}>{leg.index + 1}. {leg.stop.name}</option>
              {/each}
            </select>
          </label>
        {/if}
        <TripCalendar start={trip.start_date} days={dayRange} value={filter} counts={dayCounts}
          cityName={cityLeg?.stop.name ?? ""} {cityOfDay} onPick={pickDay} />
      </div>
      <div class="day-modes" role="group" aria-label="Mostrar días">
        <button class="chip" aria-pressed={filter === null} onclick={() => pickDay(null)}>Todos los días</button>
        <button class="chip" aria-pressed={filter === 0} onclick={() => pickDay(0)}>Sin día</button>
      </div>
    </div>

    <div class="days">
      {#each groups as g (g.day)}
        <section
          class="day"
          class:target={over?.day === g.day && !over.before}
          style="--c: {g.day ? dayColor(g.day) : 'var(--ink-muted)'}"
          ondragover={(e) => {
            if (!dragging) return;
            e.preventDefault();
            if (over?.day !== g.day || over.before) over = { day: g.day, before: null };
          }}
          ondrop={(e) => {
            e.preventDefault();
            dropOn(g.day, null);
          }}
          aria-label={g.day ? `Día ${g.day}` : "Ideas"}
        >
          <header>
            {#if g.day}
              <span class="badge">{g.day}</span>
              <div>
                <h3>Día {g.day}</h3>
                <small>
                  {weekDate(dayDate(trip.start_date, g.day))}{multi && cityOfDay(g.day) ? ` · ${cityOfDay(g.day)}` : ""}{g.day > days
                    ? " · fuera de las fechas"
                    : ""}
                </small>
              </div>
            {:else}
              <span class="badge idea"><Icon name="bulb" /></span>
              <div>
                <h3>Sin día asignado</h3>
                <small>Asigne estos lugares a un día del viaje</small>
              </div>
            {/if}
            <span class="meta">
              {plural(g.items.length, "lugar", "lugares")}{g.km >= 0.1 ? ` · ${g.km.toFixed(1)} km` : ""}
            </span>
          </header>

          {#if g.items.length}
            <ol>
              {#each g.items as p, i (p.id)}
                {@const cat = PLACE_CATEGORIES[p.category || "otro"]}
                <li
                  class="place"
                  class:selected={selected === p.id}
                  class:visited={p.visited}
                  class:dragging={dragging === p.id}
                  class:drop-before={over?.before === p.id}
                  draggable="true"
                  ondragstart={(e) => {
                    dragging = p.id;
                    e.dataTransfer?.setData("text/plain", p.id);
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                  }}
                  ondragend={() => {
                    dragging = null;
                    over = null;
                  }}
                  ondragover={(e) => {
                    if (!dragging || dragging === p.id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (over?.before !== p.id) over = { day: g.day, before: p.id };
                  }}
                  ondrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropOn(g.day, p.id);
                  }}
                >
                  <span class="grip" aria-hidden="true"><Icon name="drag-drop-vertical" /></span>
                  <span class="mark" style="--k: {cat.color}">
                    {#if g.day}{i + 1}{:else}<Icon name={cat.icon} />{/if}
                  </span>
                  <button class="body" onclick={() => (selected = p.id)}>
                    <strong>{p.name}</strong>
                    <span class="line">
                      <span class="tag" style="--c: {cat.color}"><Icon name={cat.icon} /> {cat.label}</span>
                      {#if p.time}<span class="muted"><Icon name="clock-01" /> {p.time}</span>{/if}
                      {#if p.cost}<span class="muted num">{store.money(p.cost)}</span>{/if}
                      {#if !hasCoords(p)}<span class="muted">sin ubicación</span>{/if}
                      {#if multi && !city && p.stop && g.day === 0}<span class="muted">{stopName(p.stop)}</span>{/if}
                    </span>
                  </button>
                  <div class="acts">
                    <button
                      class="btn ghost icon sm round visit"
                      class:on={p.visited}
                      title={p.visited ? "Marcar como pendiente" : "Marcar como visitado"}
                      aria-label={p.visited ? "Marcar como pendiente" : "Marcar como visitado"}
                      onclick={() => toggleVisited(p)}
                    >
                      <Icon name={p.visited ? "checkmark-circle-02" : "circle"} />
                    </button>
                    <span class="order">
                      <button class="btn ghost icon sm" aria-label="Mover {p.name} antes" disabled={i === 0} onclick={() => move(p, -1)}>
                        <Icon name="arrow-up-01" />
                      </button>
                      <button class="btn ghost icon sm" aria-label="Mover {p.name} después" disabled={i === g.items.length - 1} onclick={() => move(p, 1)}>
                        <Icon name="arrow-down-01" />
                      </button>
                    </span>
                    <button class="btn ghost icon sm round" aria-label="Editar {p.name}" title="Editar {p.name}" onclick={() => (form = { initial: p, id: p.id })}>
                      <Icon name="pencil-edit-02" />
                    </button>
                  </div>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="drop">{g.day ? "Arrastre un lugar aquí o búsquelo arriba." : "Los lugares sin día aparecerán aquí."}</p>
          {/if}
        </section>
      {/each}
    </div>
  </aside>

  <div class="stage">
    <TripMap
      bind:this={map}
      places={mapPlaces}
      {legs}
      {center}
      days={filter === null ? null : [filter]}
      focusStop={city}
      {selected}
      {preview}
      onSelect={(id) => (selected = id)}
      onMapClick={mapClick}
      inset={{ top: 190, right: 60, bottom: 110, left: 470 }}
    />
    <div class="legend glass">
      {#each Object.values(PLACE_CATEGORIES).slice(0, 7) as c (c.label)}
        <span style="--c: {c.color}"><i></i>{c.label}</span>
      {/each}
    </div>
  </div>
</div>

<Modal open={!!form} onClose={close} title={form?.id ? "Editar lugar" : "Agregar al plan"} eyebrow={trip.name}>
  {#if form}
    <PlaceForm
      initial={form.initial}
      {days}
      {legs}
      start={trip.start_date}
      currency={trip.currency}
      {busy}
      onSubmit={save}
      onCancel={close}
      onDelete={form.id ? remove : undefined}
    />
  {/if}
</Modal>

<style>
  .mobile-map-action { display: none; }
  @media (max-width: 60rem) {
    .mobile-map-action { position: relative; z-index: 3; display: flex; justify-content: flex-end; margin-bottom: .75rem; pointer-events: auto; }
    .mobile-map-action button { display: flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: .625rem 1rem; border-radius: var(--r); color: var(--ink); font: 550 .8125rem var(--font); cursor: pointer; white-space: nowrap; }
  }
  .places-view {
    position: relative;
    height: 100%;
    min-height: 0;
    pointer-events: none;
  }

  .plan {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    width: min(27rem, 100%);
    height: 100%;
    min-height: 0;
    border-radius: var(--r-xl);
    pointer-events: auto;
  }

  .tools {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1rem 1rem 0.75rem;
    border-bottom: 1px solid var(--line);
  }

  .hint {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.75rem;
    color: var(--ink-muted);
  }

  .filter-selectors { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.625rem; }
  .filter-selectors.single { grid-template-columns: 1fr; }
  .city-picker { min-width: 0; }
  .city-picker > span { display: block; margin: 0 0 0.3rem 0.25rem; color: var(--ink-muted); font-size: 0.6875rem; font-weight: 550; }
  .city-picker .select { width: 100%; min-width: 0; height: 2.5rem; border-radius: var(--r); font-size: 0.8125rem; text-overflow: ellipsis; }
  .day-modes { display: flex; flex-wrap: wrap; gap: 0.375rem; }

  .days {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0.75rem 1rem;
  }

  .day {
    padding: 0.625rem 0.25rem;
    border-radius: var(--r-lg);
    transition: background 0.15s;

    &.target {
      background: color-mix(in oklch, var(--c) 10%, transparent);
    }
    & + .day {
      border-top: 1px solid var(--line);
    }

    & header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0 0.25rem 0.5rem;

      & h3 {
        font-size: 1.125rem;
      }
      & small {
        color: var(--ink-muted);
        font-size: 0.75rem;
      }
    }
  }

  .badge {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--c);
    color: white;
    font-weight: 800;
    font-size: 0.875rem;
    flex-shrink: 0;

    &.idea {
      background: var(--paper-deep);
      color: var(--ink-muted);
    }
  }

  .meta {
    margin-left: auto;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--ink-muted);
    white-space: nowrap;
  }

  ol {
    margin: 0;
    padding: 0 0 0 0.25rem;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    position: relative;
  }

  .place {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.375rem 0.375rem 0;
    border-radius: var(--r);
    border: 1px solid transparent;
    background: transparent;
    transition:
      background 0.15s,
      border-color 0.15s,
      opacity 0.15s;
    cursor: grab;
    /* El centro del círculo: relleno (0.375rem) + margen (0.125rem) + medio círculo (0.6875rem). */
    --mark-mid: 1.1875rem;

    /* El hilo hacia el siguiente lugar del día: va de centro a centro de los
       círculos, a la altura del título. A la izquierda quedan el asa (1rem), la
       separación (0.375rem) y medio círculo (0.6875rem), menos medio hilo. */
    &:not(:last-child)::after {
      content: "";
      position: absolute;
      left: calc(2.0625rem - 1px);
      top: var(--mark-mid);
      /* Cruza la separación entre filas (0.375rem) y los dos bordes de 1px. */
      bottom: calc(-0.375rem - 2px - var(--mark-mid));
      border-left: 2px dotted color-mix(in oklch, var(--c) 60%, transparent);
    }

    &:hover {
      background: var(--hover);
    }
    &:hover .grip {
      opacity: 1;
    }
    &.selected {
      border-color: transparent;
      background: var(--accent);
      color: var(--on-accent);
      box-shadow: 0 16px 32px -12px oklch(0.47 0.29 264 / 0.6);
      --ink: var(--on-accent);
      --ink-soft: var(--on-accent);
      --ink-muted: oklch(1 0 0 / 0.72);
      --line-strong: oklch(1 0 0 / 0.3);

      & :global(.btn) {
        color: inherit;
        background: oklch(1 0 0 / 0.14);
        border-color: transparent;
      }

      & .grip {
        color: var(--on-accent);
        opacity: 1;
      }

      & .visit.on {
        color: var(--lime);
      }
    }
    &.dragging {
      opacity: 0.35;
    }
    &.drop-before::before {
      content: "";
      position: absolute;
      left: 0.5rem;
      right: 0.5rem;
      top: -0.25rem;
      height: 3px;
      border-radius: 3px;
      background: var(--accent);
    }
    &.visited strong {
      text-decoration: line-through;
      text-decoration-color: var(--ink-muted);
      color: var(--ink-muted);
    }
  }

  .grip {
    align-self: center;
    height: 1.375rem;
    margin-top: 0;
    width: 1rem;
    flex-shrink: 0;
    color: var(--ink-muted);
    opacity: 0;
    transition: opacity 0.15s;
    display: grid;
    place-items: center;
  }

  /* Arriba, frente al título, y no en la mitad de la fila. */
  .mark {
    position: relative;
    z-index: 1;
    align-self: flex-start;
    margin-top: 0.125rem;
    display: grid;
    place-items: center;
    width: 1.375rem;
    height: 1.375rem;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--k);
    color: white;
    font-size: 0.6875rem;
    font-weight: 750;
    box-shadow: 0 0 0 2px oklch(1 0 0 / 0.7);
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.125rem 0.25rem;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;

    & strong {
      font-weight: 600;
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    font-size: 0.75rem;

    & .muted {
      display: inline-flex;
      gap: 0.2rem;
      align-items: center;
    }
  }

  .acts {
    display: flex;
    align-items: center;

    /* Siempre ocupan su lugar (invisibles) para que el hover no cambie el alto. */
    & .order {
      display: flex;
      flex-direction: column;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s;

      & :global(.btn) {
        width: 1.5rem;
        height: 1.25rem;
      }
    }
    & .visit.on {
      color: var(--leaf);
    }
  }

  .place:hover .order,
  .place:focus-within .order {
    opacity: 1;
    pointer-events: auto;
  }

  .drop {
    margin: 0 0.25rem;
    padding: 0.875rem;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--r);
    font-size: 0.8125rem;
    color: var(--ink-muted);
    text-align: center;
  }

  .legend {
    position: fixed;
    right: clamp(1rem, 2.5vw, 2rem);
    bottom: 1.25rem;
    z-index: 3;
    pointer-events: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    max-width: calc(100% - 1.5rem);
    padding: 0.4rem 0.75rem;
    border-radius: var(--pill);
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--ink-soft);

    & span {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    & i {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--c);
    }
  }

  @media (max-width: 60rem) {
    .places-view {
      height: auto;
      padding-top: 45dvh;
    }
    .plan {
      width: 100%;
      height: auto;
    }
    .legend {
      display: none;
    }
    .days {
      overflow: visible;
    }
    .order {
      display: flex !important;
    }
  }
</style>
