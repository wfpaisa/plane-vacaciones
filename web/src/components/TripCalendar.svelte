<script lang="ts">
  import { tick } from "svelte";
  import { dayColor } from "../lib/catalog";
  import { dayDate, longDate, plural, shortDate } from "../lib/format";
  import { calendarBounds, calendarMonth, monthIndex } from "../lib/tripCalendar";
  import { portal } from "../lib/portal";
  import Icon from "./Icon.svelte";

  let { start, days, value, counts, cityName = "", cityOfDay, onPick }: {
    start: string; days: number[]; value: number | null;
    counts: Record<number, number>; cityName?: string;
    cityOfDay: (day: number) => string; onPick: (day: number) => void;
  } = $props();
  const id = $props.id();
  let open = $state(false);
  let shownMonth = $state(0);
  let box: HTMLDivElement;
  let panel = $state<HTMLDivElement>();
  let trigger: HTMLButtonElement;
  let top = $state(0);
  let left = $state(0);
  const bounds = $derived(calendarBounds(start, days));
  const cells = $derived(calendarMonth(start, shownMonth, days));
  const monthTitle = $derived(new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date(Math.floor(shownMonth / 12), shownMonth % 12, 1)));
  const selectedDate = $derived(value && value > 0 ? dayDate(start, value) : null);

  $effect(() => {
    const anchor = dayDate(start, value && value > 0 ? value : days[0] ?? 1);
    if (anchor) shownMonth = monthIndex(anchor);
  });
  function placePanel() {
    if (!open || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 32);
    const height = Math.min(panel?.getBoundingClientRect().height ?? 340, window.innerHeight - 32);
    left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
    const below = window.innerHeight - rect.bottom - 16;
    const desired = below >= height ? rect.bottom + 8 : rect.top - height - 8;
    top = Math.max(16, Math.min(desired, window.innerHeight - height - 16));
  }
  async function toggle() {
    open = !open;
    if (open) {
      await tick();
      placePanel();
      panel?.querySelector<HTMLButtonElement>("button.date.selected, button.date:not(:disabled)")?.focus();
    }
  }
  async function changeMonth(delta: number) { shownMonth += delta; await tick(); placePanel(); }
  function pick(day: number) { onPick(day); open = false; trigger?.focus(); }
  function dismiss(event: MouseEvent) {
    if (open && event.target instanceof Node && !box?.contains(event.target) && !panel?.contains(event.target)) open = false;
  }
  function escape(event: KeyboardEvent) {
    if (open && event.key === "Escape") { open = false; trigger?.focus(); }
  }
</script>

<svelte:window onclick={dismiss} onkeydown={escape} onresize={placePanel} onscroll={placePanel} />

<div class="chooser" bind:this={box}>
  <span class="caption">Fecha</span>
  <button class="trigger" class:chosen={value !== null && value > 0} type="button" bind:this={trigger}
    aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onclick={toggle}>
    <Icon name="calendar-03" />
    <span>{value && value > 0 ? `Día ${value}${selectedDate ? ` · ${shortDate(selectedDate)}` : ""}` : value === 0 ? "Sin día" : "Calendario"}</span>
    <Icon name="arrow-down-01" />
  </button>
  {#if open}
    <div class="calendar" id={id} role="dialog" aria-label="Elegir día del viaje" bind:this={panel} use:portal style="top: {top}px; left: {left}px">
      {#if bounds}
        <div class="heading">
          <button class="nav" type="button" aria-label="Mes anterior" disabled={shownMonth <= bounds.first} onclick={() => changeMonth(-1)}><Icon name="arrow-left-01" /></button>
          <strong aria-live="polite">{monthTitle}</strong>
          <button class="nav" type="button" aria-label="Mes siguiente" disabled={shownMonth >= bounds.last} onclick={() => changeMonth(1)}><Icon name="arrow-right-01" /></button>
        </div>
        <div class="weekdays" aria-hidden="true">
          {#each ["L", "M", "X", "J", "V", "S", "D"] as weekday}<span>{weekday}</span>{/each}
        </div>
        <div class="dates">
          {#each cells as cell}
            {#if cell}
              <button type="button" class="date" class:available={cell.available} class:selected={value === cell.day}
                disabled={!cell.available} aria-pressed={value === cell.day}
                aria-label={cell.available ? `Día ${cell.day}, ${longDate(cell.date)}, ${cityOfDay(cell.day)}, ${plural(counts[cell.day] ?? 0, "lugar", "lugares")}` : longDate(cell.date)}
                title={cell.available ? `Día ${cell.day} · ${cityOfDay(cell.day)} · ${plural(counts[cell.day] ?? 0, "lugar", "lugares")}` : "Fuera de los días disponibles"}
                onclick={() => pick(cell.day)}>
                <span>{cell.date.getDate()}</span>
                {#if cell.available}<small>D{cell.day}</small>{/if}
                {#if cell.available && counts[cell.day]}<i class="planned" style="--day-color: {dayColor(cell.day)}" aria-hidden="true"></i>{/if}
              </button>
            {:else}<span class="empty"></span>{/if}
          {/each}
        </div>
        <div class="footer"><span><i></i> Con lugares</span><span>{cityName || "Todo el viaje"}</span></div>
      {:else if days.length}
        <p class="no-dates">El viaje no tiene fechas. Selecciona un día del plan.</p>
        <div class="undated">
          {#each days as day}<button type="button" class="date available" class:selected={value === day} aria-pressed={value === day} onclick={() => pick(day)}>Día {day}</button>{/each}
        </div>
      {:else}<p class="no-dates">Añade fechas al viaje para elegir un día.</p>{/if}
    </div>
  {/if}
</div>

<style>
  .chooser { position: relative; min-width: 0; }
  .caption { display: block; margin: 0 0 0.3rem 0.25rem; color: var(--ink-muted); font-size: 0.6875rem; font-weight: 550; }
  .trigger { width: 100%; display: flex; align-items: center; gap: 0.4rem; height: 2.5rem; padding: 0 0.65rem; border: 1px solid var(--glass-line); border-radius: var(--r); background: var(--field); color: var(--ink-soft); font: 500 0.8125rem var(--font-display); cursor: pointer; }
  .trigger span { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .trigger.chosen { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-soft); }
  .trigger:hover { background: var(--hover); }
  .calendar { position: fixed; width: min(20rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow-y: auto; z-index: 900; padding: 0.875rem; border: 1px solid var(--glass-line); border-radius: var(--r-lg); background: var(--glass-strong); backdrop-filter: var(--blur); box-shadow: var(--shadow-lg); color: var(--ink); }
  .heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.625rem; }
  .heading strong { font: 600 0.9375rem var(--font-display); text-transform: capitalize; }
  .nav { display: grid; place-items: center; width: 2rem; height: 2rem; border: 0; border-radius: 50%; background: var(--glass-soft); color: var(--ink-soft); cursor: pointer; }
  .nav:hover:not(:disabled) { background: var(--hover); }
  .nav:disabled { opacity: 0.25; cursor: default; }
  .weekdays, .dates { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.2rem; }
  .weekdays { margin-bottom: 0.25rem; text-align: center; font-size: 0.6875rem; color: var(--ink-muted); }
  .date { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 2.75rem; padding: 0.2rem; border: 1px solid transparent; border-radius: 0.625rem; background: transparent; color: var(--ink-muted); font-size: 0.8125rem; cursor: pointer; }
  .date small { font-size: 0.5625rem; opacity: 0.75; }
  .date:disabled { opacity: 0.3; cursor: default; }
  .date.available { background: var(--accent-soft); color: var(--ink); }
  .date.available:hover { border-color: var(--accent); }
  .date.selected { background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow-sm); }
  .planned { position: absolute; top: 4px; right: 4px; width: 4px; height: 4px; border-radius: 50%; background: var(--day-color); }
  .date.selected .planned { background: var(--on-accent); }
  .footer { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.75rem; color: var(--ink-muted); font-size: 0.6875rem; }
  .footer span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .footer span:first-child { display: inline-flex; align-items: center; gap: 0.3rem; white-space: nowrap; }
  .footer i { width: 5px; height: 5px; border-radius: 50%; background: var(--accent-ink); }
  .no-dates { font-size: 0.8125rem; color: var(--ink-muted); }
  .undated { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; max-height: 15rem; overflow-y: auto; margin-top: 0.75rem; }
</style>
