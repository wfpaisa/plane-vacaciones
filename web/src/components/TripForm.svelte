<!--
  Los datos de un viaje. Al crearlo se arma también el recorrido (una o varias
  paradas, cada una con sus noches) y la lista de viajeros. Al editarlo solo
  se cambian los datos generales: el recorrido se maneja en la pestaña Ruta.
-->
<script lang="ts">
  import { COVERS, CURRENCIES, SWATCHES, TRANSPORTS } from "../lib/catalog";
  import { dayDate, fromInput, longDate, toInput, tripLength } from "../lib/format";
  import { countryOf } from "../lib/stops";
  import type { Cover, Stop, Transport, Trip, TripDraft } from "../lib/types";
  import MapColorSettings from "./MapColorSettings.svelte";
  import Icon from "./Icon.svelte";
  import PlaceSearch from "./PlaceSearch.svelte";

  let {
    initial,
    creating = false,
    hasStops = false,
    busy = false,
    submitLabel = "Guardar",
    onSubmit,
    onCancel,
    onDelete,
  }: {
    initial?: Partial<Trip>;
    /** Muestra el recorrido y los viajeros. */
    creating?: boolean;
    /** Con paradas, el regreso lo fijan las noches y no se edita aquí. */
    hasStops?: boolean;
    busy?: boolean;
    submitLabel?: string;
    onSubmit: (draft: TripDraft) => void;
    onCancel: () => void;
    onDelete?: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const init = initial ?? {};
  let name = $state(init.name ?? "");
  let region = $state(init.destination ?? "");
  let origin = $state(init.origin ?? "");
  let start = $state(toInput(init.start_date));
  let end = $state(toInput(init.end_date));
  let budget = $state<number | null>(init.budget || null);
  let currency = $state(init.currency || "COP");
  let secondaryCurrency = $state(init.secondary_currency || "");
  let cover = $state<Cover>((init.cover as Cover) || "mar");

  type Row = { query: string; picked: Partial<Stop> | null; nights: number; transport: Transport };
  let stops = $state<Row[]>([{ query: "", picked: null, nights: 3, transport: "avion" }]);
  let travelers = $state(["", "", "", ""].map((n, i) => ({ name: n, color: SWATCHES[i] })));

  const nights = $derived(stops.reduce((a, s) => a + (s.picked ? Math.max(0, s.nights) : 0), 0));
  const computedEnd = $derived(start && nights ? dayDate(start, nights + 1) : null);
  const days = $derived(tripLength(start, end));

  function pick(i: number, r: { name: string; address: string; lat: number; lng: number; provider?: string; placeId?: string }) {
    stops[i].picked = { name: r.name, address: r.address, lat: r.lat, lng: r.lng, country: countryOf(r.address), geo_provider: r.provider ?? "openstreetmap", google_place_id: r.placeId ?? "" };
    stops[i].query = r.name;
  }

  function isoOf(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const picked = stops.filter((s) => s.picked);
    const route = picked.map((s) => s.picked!.name).join(" → ");
    const first = picked[0]?.picked;
    const endValue = creating && computedEnd ? isoOf(computedEnd) : end || start;
    onSubmit({
      trip: {
        name: name.trim() || route || "Viaje",
        origin: origin.trim(),
        destination: region.trim() || (creating ? route : ""),
        ...(first ? { lat: first.lat, lng: first.lng } : {}),
        start_date: fromInput(start),
        end_date: fromInput(endValue),
        budget: budget ?? 0,
        currency,
        secondary_currency: secondaryCurrency === currency ? "" : secondaryCurrency,
        cover,
      },
      travelers: travelers.filter((t) => t.name.trim()).map((t) => ({ ...t, name: t.name.trim() })),
      stops: picked.map((s, i) => ({ ...s.picked, nights: s.nights, transport: s.transport, position: i })),
    });
  }
</script>

<form onsubmit={submit} class="trip-form">
  <div class="grid-2">
    <label class="field">
      <span>Nombre del viaje</span>
      <input class="input" bind:value={name} placeholder="Europa 2027" maxlength="120" />
    </label>
    <label class="field">
      <span>Países o región <em>(opcional)</em></span>
      <input class="input" bind:value={region} placeholder="España, Francia e Italia" maxlength="200" />
    </label>
  </div>

  <label class="field">
    <span>Sale desde <em>(opcional)</em></span>
    <input class="input" bind:value={origin} placeholder="Medellín" maxlength="200" />
  </label>

  <div class="grid-2">
    <label class="field">
      <span>Fecha de ida</span>
      <input class="input" type="date" bind:value={start} required />
    </label>
    {#if creating || hasStops}
      <div class="field">
        <span>Fecha de regreso</span>
        <div class="computed">
          <Icon name="calendar-03" size={20} />
          <div>
            <p class="return-date">
              {#if computedEnd && creating}
                {longDate(computedEnd)}
              {:else if hasStops && end}
                {longDate(new Date(end + "T12:00"))}
              {:else}
                Por definir
              {/if}
            </p>
            <p class="return-help">
              {#if computedEnd && creating}{nights} noches · {/if}Se calcula según las noches en cada ciudad.
            </p>
          </div>
        </div>
      </div>
    {:else}
      <label class="field">
        <span>Fecha de regreso {days ? `· ${days} días` : ""}</span>
        <input class="input" type="date" bind:value={end} min={start} />
      </label>
    {/if}
  </div>

  {#if creating}
    <fieldset class="block">
      <legend>Recorrido</legend>
      <p class="help">Agregue las ciudades en orden e indique cuántas noches pasarán en cada una.</p>
      <ol class="stops">
        {#each stops as s, i (i)}
          <li>
            <span class="n">{i + 1}</span>
            <div class="where">
              <PlaceSearch bind:value={s.query} placeholder={i === 0 ? "Primera ciudad, p. ej. Madrid" : "Siguiente ciudad"} onPick={(r) => pick(i, r)} />
            </div>
            <label class="nights" title="Noches">
              <input class="input num" type="number" min="0" max="90" bind:value={s.nights} aria-label="Noches" />
              <span>noches</span>
            </label>
            <select class="select transport" bind:value={s.transport} aria-label="Cómo se llega">
              {#each Object.entries(TRANSPORTS) as [k, t] (k)}<option value={k}>{t.label}</option>{/each}
            </select>
            <button
              type="button"
              class="btn ghost icon sm"
              aria-label="Quitar parada"
              disabled={stops.length === 1}
              onclick={() => stops.splice(i, 1)}
            >
              <Icon name="cancel-01" />
            </button>
          </li>
        {/each}
      </ol>
      <button
        type="button"
        class="btn sm"
        onclick={() => stops.push({ query: "", picked: null, nights: 2, transport: "tren" })}
      >
        <Icon name="add-01" /> Agregar parada
      </button>
    </fieldset>
  {/if}

  <div class="grid-2">
    <label class="field">
      <span>Presupuesto total</span>
      <input class="input num" type="number" min="0" step="any" bind:value={budget} placeholder="0" />
    </label>
    <label class="field">
      <span>Moneda de los importes</span>
      <select class="select" bind:value={currency}>
        {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
      </select>
    </label>
  </div>

  <label class="field">
    <span>Segunda moneda <em>(opcional)</em></span>
    <select class="select" bind:value={secondaryCurrency}>
      <option value="">Sin segunda moneda</option>
      {#each CURRENCIES.filter((c) => c !== currency) as c (c)}<option value={c}>{c}</option>{/each}
    </select>
    <small class="help">Puede cambiar la moneda que ve sin modificar los importes guardados.</small>
  </label>

  <fieldset class="block">
    <legend>Color del viaje</legend>
    <div class="covers">
      {#each Object.entries(COVERS) as [key, c] (key)}
        <label class="cover" title={c.label}>
          <input type="radio" name="cover" value={key} bind:group={cover} class="sr-only" />
          <span class="swatch" style="background: {c.color}"></span>
          <span class="sr-only">{c.label}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  {#if creating}
    <fieldset class="block">
      <legend>Viajeros</legend>
      <div class="people">
        {#each travelers as t, i (i)}
          <div class="person">
            <span class="dot" style="background: {t.color}"></span>
            <input class="input" bind:value={t.name} placeholder="Nombre {i + 1}" maxlength="80" />
          </div>
        {/each}
      </div>
      <button
        type="button"
        class="btn sm"
        onclick={() => travelers.push({ name: "", color: SWATCHES[travelers.length % SWATCHES.length] })}
      >
        <Icon name="user-add-01" /> Agregar viajero
      </button>
    </fieldset>
  {/if}

  {#if !creating}
    <MapColorSettings />
  {/if}

  <div class="actions">
    {#if onDelete}
      <button type="button" class="btn danger delete" disabled={busy} onclick={onDelete}><Icon name="delete-02" /> Borrar</button>
    {/if}
    <button type="button" class="btn ghost" onclick={onCancel}>Cancelar</button>
    <button type="submit" class="btn primary" disabled={busy || (creating && !stops.some((s) => s.picked))}>
      {busy ? "Guardando…" : submitLabel}
    </button>
  </div>
</form>

<style>
  .trip-form {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  em {
    font-style: normal;
    color: var(--ink-muted);
    font-weight: 400;
  }

  .computed {
    display: flex;
    align-items: flex-start;
    gap: .625rem;
    padding: .5rem 0;
    color: var(--ink-muted);
  }
  .computed :global(svg) { flex-shrink: 0; margin-top: .125rem; }
  .return-date { color: var(--ink); font-size: .875rem; font-weight: 550; line-height: 1.4; }
  .return-help { margin-top: .25rem; font-size: .75rem; line-height: 1.5; color: var(--ink-muted); }

  .block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.625rem;
    margin: 0;
    padding: 0;
    border: 0;

    & legend {
      padding: 0;
      margin-bottom: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 550;
      color: var(--ink-soft);
    }
  }

  .help {
    font-size: 0.8125rem;
    color: var(--ink-muted);
  }

  .stops {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;

    & li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  }

  .n {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--ink);
    color: var(--surface);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .where {
    flex: 1;
    min-width: 0;
  }

  .nights {
    position: relative;
    width: 6.5rem;
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

  .transport {
    width: 6.5rem;
    flex-shrink: 0;
  }

  .covers {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
  }

  .cover {
    cursor: pointer;
    display: block;
    padding: .25rem;

    & .swatch {
      display: block;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      transition: box-shadow 0.15s;
    }
    &:has(input:checked) .swatch {
      box-shadow:
        0 0 0 2px var(--surface),
        0 0 0 4px var(--ink);
    }
    &:has(input:focus-visible) .swatch {
      outline: 2px solid var(--accent);
      outline-offset: 4px;
    }
  }

  .people {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    width: 100%;
  }

  .person {
    position: relative;

    & .dot {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      translate: 0 -50%;
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 50%;
    }
    & input {
      padding-left: 1.875rem;
    }
  }

  .actions .delete { margin-right: auto; }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }

  @media (max-width: 34rem) {
    .people {
      grid-template-columns: 1fr;
    }
    .stops li {
      flex-wrap: wrap;
    }
    .where {
      flex-basis: calc(100% - 2rem);
    }
  }
</style>
