<!--
  Un buscador de lugares. Espera a que se deje de escribir
  antes de preguntar, y entrega el lugar elegido con sus coordenadas.
-->
<script lang="ts">
  import { type GeoResult, searchPlaces } from "../lib/geo";
  import Icon from "./Icon.svelte";

  let {
    onPick,
    near = null,
    placeholder = "Buscar un lugar…",
    value = $bindable(""),
    autofocus = false,
  }: {
    onPick: (r: GeoResult) => void;
    near?: { lat: number; lng: number } | null;
    placeholder?: string;
    value?: string;
    autofocus?: boolean;
  } = $props();

  let results = $state<GeoResult[]>([]);
  let open = $state(false);
  let loading = $state(false);
  let active = $state(-1);
  let typed = false;
  let box: HTMLDivElement;
  let up = $state(false);
  let room = $state(320);

  // La lista se abre hacia donde haya más espacio: al pie de un panel con
  // scroll quedaría recortada por debajo. Mide contra el primer contenedor que
  // recorta su contenido, o contra la ventana si ninguno lo hace.
  function place() {
    const r = box.getBoundingClientRect();
    let top = 0;
    let bottom = window.innerHeight;
    for (let el = box.parentElement; el; el = el.parentElement) {
      const o = getComputedStyle(el);
      if (/(hidden|auto|scroll|clip)/.test(o.overflowY + o.overflowX)) {
        const c = el.getBoundingClientRect();
        top = Math.max(top, c.top);
        bottom = Math.min(bottom, c.bottom);
        break;
      }
    }
    const below = bottom - r.bottom - 12;
    const above = r.top - top - 12;
    up = below < 240 && above > below;
    room = Math.max(120, Math.min(320, up ? above : below));
  }

  $effect.pre(() => {
    if (open && results.length) place();
  });

  $effect(() => {
    const q = value.trim();
    if (!typed || q.length < 3) {
      results = [];
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      loading = true;
      try {
        results = await searchPlaces(q, near, ctrl.signal);
        open = true;
        active = -1;
      } catch {
        if (!ctrl.signal.aborted) results = [];
      } finally {
        loading = false;
      }
    }, 650);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  });

  function pick(r: GeoResult) {
    typed = false;
    value = r.name;
    open = false;
    results = [];
    onPick(r);
  }

  function onKey(e: KeyboardEvent) {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = (active + 1) % results.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = (active - 1 + results.length) % results.length;
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      open = false;
    }
  }
</script>

<div class="search" bind:this={box}>
  <Icon name={loading ? "loading-03" : "search-01"} class={loading ? "spin lead" : "lead"} />
  <!-- svelte-ignore a11y_autofocus -->
  <input
    class="input"
    type="search"
    {placeholder}
    {autofocus}
    bind:value
    oninput={() => (typed = true)}
    onkeydown={onKey}
    onfocus={() => results.length && (open = true)}
    onblur={() => setTimeout(() => (open = false), 150)}
    role="combobox"
    aria-expanded={open}
    aria-controls="place-results"
    aria-autocomplete="list"
  />
  {#if open && results.length}
    <ul id="place-results" role="listbox" class="results" class:up style:max-height="{room}px">
      {#each results as r, i (r.lat + "," + r.lng + i)}
        <li role="option" aria-selected={i === active}>
          <button type="button" class:active={i === active} onmousedown={(e) => e.preventDefault()} onclick={() => pick(r)}>
            <Icon name="location-01" />
            <span>
              <strong>{r.name}</strong>
              <small>{r.address}</small>
            </span>
          </button>
        </li>
      {/each}
      {#if results.some((r) => r.provider === "google")}
        <li class="attribution">Resultados de Google Maps</li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;

    & .input {
      padding-left: 2.5rem;
    }
    & :global(.lead) {
      position: absolute;
      left: 0.875rem;
      top: 50%;
      translate: 0 -50%;
      color: var(--ink-muted);
      font-size: 1.05rem;
      pointer-events: none;
    }
    & :global(.spin) {
      animation: spin 0.9s linear infinite;
    }
  }

  .results {
    position: absolute;
    z-index: 1200;
    top: calc(100% + 0.375rem);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0.375rem;
    list-style: none;
    background: var(--glass-strong);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    border: 1px solid var(--glass-line);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-lg);
    overflow: auto;

    &.up {
      top: auto;
      bottom: calc(100% + 0.375rem);
    }

    & button {
      display: flex;
      gap: 0.625rem;
      align-items: flex-start;
      width: 100%;
      padding: 0.5rem 0.625rem;
      border: 0;
      border-radius: var(--r-sm);
      background: none;
      text-align: left;
      cursor: pointer;

      &:hover,
      &.active {
        background: var(--hover);
      }
      & :global(i) {
        margin-top: 0.2rem;
        color: var(--accent);
      }
    }
    & span {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    & strong {
      font-weight: 600;
      font-size: 0.875rem;
    }
    & small {
      color: var(--ink-muted);
      font-size: 0.75rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .attribution {
    padding: 0.5rem 0.625rem;
    font-size: 0.75rem;
    color: var(--ink-muted);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
