<!--
  Un nivel de 0 a 4 del mapa (detalle, zoom). En escritorio es un icono y una
  barra; en móvil, dos botones con icono que se desactivan en los extremos.
  Mientras se ajusta, una leyenda encima dice qué nivel queda.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    value = $bindable(2),
    labels,
    label,
    name,
    icon,
    lessIcon,
    moreIcon,
    lessLabel,
    moreLabel,
    onchange,
  }: {
    value?: number;
    labels: readonly string[];
    label: string;
    /** Lo que se ajusta, encima del nivel en la leyenda. */
    name: string;
    icon: string;
    lessIcon: string;
    moreIcon: string;
    lessLabel: string;
    moreLabel: string;
    onchange?: (value: number) => void;
  } = $props();
  const id = $props.id();
  const max = $derived(labels.length - 1);
  function set(next: number) {
    value = Math.max(0, Math.min(max, Math.round(next)));
    onchange?.(value);
  }

  // La leyenda se ve mientras se arrastra y un momento después de cada cambio.
  let dragging = $state(false);
  let lingering = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function linger() {
    lingering = true;
    clearTimeout(timer);
    timer = setTimeout(() => (lingering = false), 1200);
  }
  function change(next: number) {
    set(next);
    linger();
  }
  function release() {
    if (!dragging) return;
    dragging = false;
    linger();
  }
  $effect(() => () => clearTimeout(timer));
</script>

<div class="level" role="group" aria-label={label}>
  <button class="adjust" type="button" aria-label="{lessLabel}: {labels[Math.max(0, value - 1)]}" 
    disabled={value <= 0} onclick={() => change(value - 1)}>
    <Icon name={lessIcon} size={18} />
  </button>
  <span class="lead" aria-hidden="true"><Icon name={icon} size={16} /></span>
  <div class="slider">
    <span class="segments" aria-hidden="true">
      {#each labels as _, i}
        <i class:filled={i < value} class:selected={i === value}></i>
      {/each}
    </span>
    <input id={id} type="range" min="0" {max} step="1" dir="ltr" {value}
      oninput={(e) => change(Number(e.currentTarget.value))}
      onpointerdown={() => (dragging = true)} onpointerup={release} onpointercancel={release} onlostpointercapture={release}
      aria-label={label} aria-valuetext={labels[value]} />
  </div>
  <button class="adjust" type="button" aria-label="{moreLabel}: {labels[Math.min(max, value + 1)]}" 
    disabled={value >= max} onclick={() => change(value + 1)}>
    <Icon name={moreIcon} size={18} />
  </button>
  {#if dragging || lingering}
    <span class="legend" role="status" style="--at: {(value + 0.5) / labels.length}">
      <small>{name}</small>{labels[value]}
    </span>
  {/if}
</div>

<style>
  .level {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0 0.375rem;
    min-height: 2.125rem;
    color: var(--ink-soft);
    font: 500 0.75rem var(--font-display);
  }
  .adjust {
    display: none;
    align-items: center;
    justify-content: center;
    width: 1.875rem;
    height: 1.875rem;
    padding: 0;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background 0.18s, color 0.18s;
  }
  .lead { display: inline-flex; color: var(--ink-soft); }
  .adjust:hover:not(:disabled) { background: var(--hover); color: var(--ink); }
  .adjust:active:not(:disabled) { background: var(--accent-soft); color: var(--accent-ink); }
  .adjust:disabled { opacity: 0.35; cursor: default; }
  .adjust:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .slider {
    position: relative;
    display: flex;
    align-items: center;
    width: 6rem;
    height: 2.125rem;
    flex-shrink: 0;
    border-radius: var(--pill);
  }
  .segments {
    position: absolute;
    inset: 6px 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--field);
    box-shadow: inset 0 1px 3px oklch(0 0 0 / 0.07);
    pointer-events: none;
  }
  .segments i {
    position: relative;
    border-radius: 3px;
    background: var(--line-strong);
    transition: background 0.18s, box-shadow 0.18s;
  }
  .segments i.filled { background: var(--accent-soft); }
  .segments i.selected {
    background: var(--accent);
    box-shadow: 0 1px 4px oklch(0 0 0 / 0.2);
  }
  .segments i.selected::after {
    content: "";
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: calc(50% - 1px);
    width: 2px;
    border-radius: 1px;
    background: var(--on-accent);
  }
  input {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 2rem;
    margin: 0;
    opacity: 0;
    cursor: ew-resize;
  }
  .slider:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
  /* Sobre la barra, a la altura del nivel elegido. */
  .legend {
    position: absolute;
    bottom: calc(100% + 0.75rem);
    /* Margen, icono y separación hasta la barra, que mide 6rem. */
    left: calc(1.75rem + 6rem * var(--at));
    translate: -50% 0;
    z-index: 2;
    display: grid;
    justify-items: center;
    gap: 0.0625rem;
    padding: 0.375rem 0.625rem;
    border: 1px solid var(--line-strong);
    border-radius: 0.625rem;
    background: var(--glass-strong);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    box-shadow: var(--shadow);
    color: var(--ink);
    font: 600 0.8125rem var(--font-display);
    white-space: nowrap;
    pointer-events: none;
    animation: rise 0.14s ease-out;
  }
  .legend small {
    color: var(--ink-soft);
    font-size: 0.6875rem;
    font-weight: 500;
  }
  @keyframes rise {
    from { opacity: 0; translate: -50% 0.25rem; }
  }
  @media (max-width: 40rem) {
    .legend { left: 50%; }
    .level { gap: 0.1rem; padding: 0; }
    .adjust { display: inline-flex; }
    .lead, .slider { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .segments i, .adjust { transition: none; }
    .legend { animation: none; }
  }
</style>
