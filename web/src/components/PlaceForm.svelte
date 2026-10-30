<!-- Agregar o cambiar un lugar: qué es, qué día, a qué hora y cuánto cuesta. -->
<script lang="ts">
  import { PLACE_CATEGORIES } from "../lib/catalog";
  import { dayDate, weekDate } from "../lib/format";
  import { type Leg, legsOfDay, stopOfDay } from "../lib/stops";
  import type { Place, PlaceCategory } from "../lib/types";
  import Icon from "./Icon.svelte";

  let {
    initial,
    days,
    legs = [],
    start,
    currency,
    busy = false,
    onSubmit,
    onCancel,
    onDelete,
  }: {
    initial: Partial<Place>;
    days: number;
    legs?: Leg[];
    start: string;
    currency: string;
    busy?: boolean;
    onSubmit: (data: Partial<Place>) => void;
    onCancel: () => void;
    onDelete?: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const init = initial;
  let name = $state(init.name ?? "");
  let category = $state<PlaceCategory>((init.category as PlaceCategory) || "atraccion");
  let day = $state(init.day ?? 0);
  let time = $state(init.time ?? "");
  let cost = $state<number | null>(init.cost || null);
  let link = $state(init.link ?? "");
  let notes = $state(init.notes ?? "");
  let visited = $state(init.visited ?? false);
  let stop = $state(init.stop ?? "");

  // Al elegir un día de otra ciudad, la ciudad sigue al día.
  function onDay() {
    if (!day || !legs.length) return;
    if (!legsOfDay(legs, Number(day)).some((l) => l.stop.id === stop)) stop = stopOfDay(legs, Number(day))?.id ?? stop;
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), category, day: Number(day), stop, time, cost: cost ?? 0, link, notes, visited });
  }
</script>

<form onsubmit={submit} class="place-form">
  {#if init.address}
    <p class="address"><Icon name="location-01" /> {init.address}</p>
  {/if}

  <label class="field">
    <span>Nombre</span>
    <input class="input" bind:value={name} required maxlength="160" placeholder="Museo del Prado" />
  </label>

  <fieldset class="field">
    <span>Categoría</span>
    <div class="cats">
      {#each Object.entries(PLACE_CATEGORIES) as [key, c] (key)}
        <label class="cat" style="--c: {c.color}">
          <input type="radio" name="category" value={key} bind:group={category} class="sr-only" />
          <Icon name={c.icon} size={20} />
          <small>{c.label}</small>
        </label>
      {/each}
    </div>
  </fieldset>

  <div class="grid-2">
    <label class="field">
      <span>Día</span>
      <select class="select" bind:value={day} onchange={onDay}>
        <option value={0}>Sin día asignado</option>
        {#each Array.from({ length: days }, (_, i) => i + 1) as d (d)}
          <option value={d}>
            Día {d} · {weekDate(dayDate(start, d))}{legs.length > 1 ? ` · ${legsOfDay(legs, d).map((l) => l.stop.name).join(" → ")}` : ""}
          </option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span>Hora</span>
      <input class="input" type="time" bind:value={time} />
    </label>
  </div>

  {#if legs.length > 1}
    <label class="field">
      <span>Ciudad</span>
      <select class="select" bind:value={stop}>
        <option value="">Sin ciudad</option>
        {#each legs as l (l.stop.id)}<option value={l.stop.id}>{l.index + 1}. {l.stop.name}</option>{/each}
      </select>
    </label>
  {/if}

  <div class="grid-2">
    <label class="field">
      <span>Costo estimado ({currency})</span>
      <input class="input num" type="number" min="0" step="any" bind:value={cost} placeholder="0" />
    </label>
    <label class="field">
      <span>Enlace</span>
      <input class="input" type="url" bind:value={link} placeholder="https://…" />
    </label>
  </div>

  <label class="field">
    <span>Notas</span>
    <textarea class="textarea" bind:value={notes} placeholder="Horarios, reservas, recomendaciones…"></textarea>
  </label>

  <label class="check">
    <input type="checkbox" bind:checked={visited} />
    <span>Visitado</span>
  </label>

  <div class="actions">
    {#if onDelete}
      <button type="button" class="btn danger sm" onclick={onDelete}><Icon name="delete-02" /> Quitar</button>
    {/if}
    <span class="spacer"></span>
    <button type="button" class="btn ghost" onclick={onCancel}>Cancelar</button>
    <button type="submit" class="btn primary" disabled={busy}>{busy ? "Guardando…" : "Guardar lugar"}</button>
  </div>
</form>

<style>
  .place-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }

  .address {
    display: flex;
    gap: 0.4rem;
    align-items: flex-start;
    padding: 0.625rem 0.75rem;
    border-radius: var(--r);
    background: var(--paper);
    color: var(--ink-soft);
    font-size: 0.8125rem;
    line-height: 1.4;

    & :global(i) {
      margin-top: 0.1rem;
      color: var(--accent);
    }
  }

  .cats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.375rem;
  }

  .cat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.625rem 0.25rem;
    border: 1px solid var(--line);
    border-radius: var(--r);
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 0.15s;

    & small {
      font-size: 0.72rem;
      font-weight: 600;
    }
    &:hover {
      border-color: var(--c);
      color: var(--c);
    }
    &:has(input:checked) {
      border-color: var(--c);
      background: color-mix(in oklch, var(--c) 14%, transparent);
      color: color-mix(in oklch, var(--c) 85%, var(--ink));
    }
    &:has(input:focus-visible) {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    cursor: pointer;

    & input {
      width: 1.125rem;
      height: 1.125rem;
      accent-color: var(--leaf);
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.875rem;
    border-top: 1px solid var(--line);
  }

  .spacer {
    flex: 1;
  }
</style>
