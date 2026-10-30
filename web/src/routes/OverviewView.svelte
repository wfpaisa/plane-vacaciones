<!--
  El resumen del viaje de un vistazo: cifras, el plan día a día y el mapa.
-->
<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { dayColor, EXPENSE_CATEGORIES, PLACE_CATEGORIES, TRANSPORTS } from "../lib/catalog";
  import { dayDate, shortDate, tripLength, weekDate } from "../lib/format";
  import { tripPath } from "../lib/router.svelte";
  import { legsOfDay, schedule } from "../lib/stops";
  import type { TripStore } from "../lib/tripStore.svelte";
  import type { ExpenseCategory } from "../lib/types";

  let { store }: { store: TripStore } = $props();

  const trip = $derived(store.trip!);
  const days = $derived(tripLength(trip.start_date, trip.end_date));
  const legs = $derived(schedule(store.stops));
  const planned = $derived(store.expenses.reduce((a, e) => a + e.amount, 0));
  const scheduled = $derived(store.places.filter((p) => p.day > 0).length);
  const visited = $derived(store.places.filter((p) => p.visited).length);
  const used = $derived(trip.budget ? Math.min(100, (planned / trip.budget) * 100) : 0);

  const plan = $derived(
    Array.from({ length: days }, (_, i) => {
      const d = i + 1;
      return { day: d, items: store.places.filter((p) => p.day === d).sort((a, b) => a.position - b.position) };
    }),
  );

  const topCats = $derived(
    (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[])
      .map((k) => ({ ...EXPENSE_CATEGORIES[k], value: store.expenses.filter((e) => e.category === k).reduce((a, e) => a + e.amount, 0) }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value),
  );
</script>

<div class="overview">
  <div class="stats">
    <div class="stat card rise">
      <span class="label">Duración</span>
      <strong class="big-num">{days || "–"}<small>días</small></strong>
      <span class="sub"><span class="tag" style="--c: var(--lime)">{legs.length} {legs.length === 1 ? "ciudad" : "ciudades"}</span></span>
    </div>
    <div class="stat card rise" style="animation-delay: 50ms">
      <span class="label">Lugares</span>
      <strong class="big-num">{store.places.length}<small>en el plan</small></strong>
      <span class="sub"><span class="tag" style="--c: var(--leaf)">{scheduled} con día · {visited} visitados</span></span>
    </div>
    <div class="stat card hero rise" style="animation-delay: 100ms">
      <span class="label"><Icon name="wallet-02" /> Gastos planeados</span>
      <strong class="big-num num">{store.compactMoney(planned)}</strong>
      <span class="sub">
        {trip.budget ? `${Math.round((planned / trip.budget) * 100)}% del presupuesto de ${store.compactMoney(trip.budget)}` : "Sin presupuesto definido"}
      </span>
      {#if trip.budget}<div class="meter"><i style="width: {used}%" class:over={planned > trip.budget}></i></div>{/if}
    </div>
    <div class="stat card rise" style="animation-delay: 150ms">
      <span class="label">Distancia</span>
      <strong class="big-num num">{Math.round(legs.reduce((a, l) => a + l.km, 0)).toLocaleString("es-CO")}<small>km</small></strong>
      <span class="sub"><span class="tag" style="--c: var(--sea)">en línea recta</span></span>
    </div>
  </div>

  {#if legs.length}
    <section class="card journey">
      <header>
        <h3>Recorrido</h3>
        <a class="btn ghost sm" href={tripPath(trip.id, "ruta")}>Editar ruta <Icon name="arrow-right-01" /></a>
      </header>
      <ol class="legs">
        {#each legs as l, i (l.stop.id)}
          {#if i}
            <li class="hop" title={TRANSPORTS[l.stop.transport || "otro"].label}>
              <span class="line"></span>
              <Icon name={TRANSPORTS[l.stop.transport || "otro"].icon} size={24} />
              <span class="line"></span>
            </li>
          {/if}
          <li class="city">
            <span class="idx">{i + 1}</span>
            <strong>{l.stop.name}</strong>
            <small>{shortDate(dayDate(trip.start_date, l.firstDay))} · {l.stop.nights} {l.stop.nights === 1 ? "noche" : "noches"}</small>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  <section class="card itinerary">
    <header>
      <h3>Plan día a día</h3>
      <a class="btn ghost sm" href={tripPath(trip.id, "lugares")}>Organizar <Icon name="arrow-right-01" /></a>
    </header>
    {#if !days}
      <p class="muted">Defina las fechas del viaje para ver los días.</p>
    {:else}
      <div class="days">
        {#each plan as d (d.day)}
          <article class="daycard" style="--c: {dayColor(d.day)}">
            <div class="head">
              <span class="n">{d.day}</span>
              <span class="date">{weekDate(dayDate(trip.start_date, d.day))}</span>
            </div>
            {#if legs.length > 1}
              <p class="city-of">{legsOfDay(legs, d.day).map((l) => l.stop.name).join(" → ")}</p>
            {/if}
            {#if d.items.length}
              <ul>
                {#each d.items as p (p.id)}
                  <li style="--k: {PLACE_CATEGORIES[p.category || 'otro'].color}">
                    {#if p.time}<small>{p.time}</small>{/if}
                    <span>{p.name}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="free">Sin actividades</p>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </section>



  <section class="card spend">
    <header>
      <h3>Distribución del gasto</h3>
      <a class="btn ghost sm" href={tripPath(trip.id, "gastos")}>Ver gastos <Icon name="arrow-right-01" /></a>
    </header>
    {#if topCats.length}
      <div class="stack" role="img" aria-label="Reparto de gastos por categoría">
        {#each topCats as c (c.label)}
          <span style="flex: {c.value}; background: {c.color}" title="{c.label}: {store.money(c.value)}"></span>
        {/each}
      </div>
      <ul class="legend">
        {#each topCats as c (c.label)}
          <li style="--c: {c.color}">
            <i></i>{c.label}<strong class="num">{store.money(c.value)}</strong>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">Aún no hay gastos registrados.</p>
    {/if}
  </section>
</div>

<style>
  .overview {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 1rem;
  }

  .stats {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
  }

  .stat {
    position: relative;
    min-height: 9.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.125rem 1.25rem;

    & .label {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      color: var(--ink-muted);
    }
    & .big-num {
      margin-top: auto;
      font-size: 2.75rem;
    }
    & .sub {
      font-size: 0.75rem;
      color: var(--ink-muted);
    }
  }


  .meter {
    height: 0.375rem;
    margin-top: 0.5rem;
    border-radius: var(--pill);
    background: var(--paper-deep);
    overflow: hidden;
    & i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--lime);
      &.over {
        background: var(--danger);
      }
    }
  }

  .card {
    padding: 1.25rem 1.375rem;

    & header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      & h3 {
        font-size: 1.25rem;
      }
    }
  }

  .itinerary,
  .journey {
    grid-column: 1 / -1;
  }

  .legs {
    display: flex;
    align-items: flex-start;
    gap: 0;
    margin: 0;
    padding: 0 0 0.25rem;
    list-style: none;
    overflow-x: auto;
  }

  .city {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    min-width: 7.5rem;
    text-align: center;

    & strong {
      font-weight: 600;
    }
    & small {
      font-size: 0.75rem;
      color: var(--ink-muted);
    }
  }

  .idx {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    background: var(--pill-on);
    color: var(--pill-on-text);
    font-family: var(--font-display);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .hop {
    flex: 1;
    min-width: 4rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    height: 2rem;
    color: var(--ink-muted);

    & .line {
      flex: 1;
      border-top: 2px dotted var(--line-strong);
    }
  }

  .days {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
    grid-auto-rows: 1fr;
    gap: 0.75rem;
    align-items: stretch;
  }

  .daycard {
    min-width: 0;
    padding: 0.875rem;
    border-radius: var(--r-lg);
    background: linear-gradient(155deg, color-mix(in oklch, var(--c) 18%, var(--glass-strong)), var(--glass-soft) 75%);
    border: 1px solid var(--glass-line);
    box-shadow: inset 0 4px 0 var(--c);

    & .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.625rem;
    }
    & .n {
      display: grid;
      place-items: center;
      flex: 0 0 2rem;
      height: 2rem;
      border-radius: 0.65rem;
      background: var(--c);
      color: white;
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 700;
      line-height: 1;
    }
    & .city-of {
      margin: -0.25rem 0 0.5rem;
      font-size: 0.75rem;
      font-weight: 550;
      color: var(--ink-soft);
      overflow-wrap: anywhere;
    }
    & .date {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--ink-soft);
    }
    & ul {
      position: relative;
      margin: 0;
      padding: 0 0 0 1.25rem;
      list-style: none;
      display: grid;
      gap: 0.75rem;

      &::before {
        content: "";
        position: absolute;
        top: 0.4rem;
        bottom: 0.4rem;
        left: 0.38rem;
        width: 2px;
        border-radius: var(--pill);
        background: color-mix(in oklch, var(--c) 55%, transparent);
      }
    }
    & li {
      position: relative;
      display: grid;
      gap: 0.125rem;
      min-width: 0;
      font-size: 0.8125rem;

      &::before {
        content: "";
        position: absolute;
        top: 0.32rem;
        left: -1.18rem;
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 50%;
        background: var(--k);
        border: 2px solid var(--glass-strong);
      }
      & span {
        min-width: 0;
        font-weight: 550;
        overflow-wrap: anywhere;
      }
      & small {
        color: var(--ink-muted);
        font-size: 0.7rem;
      }
    }
    & .free {
      display: block;
      margin-top: 0.375rem;
      font-size: 0.75rem;
      color: var(--ink-muted);
    }
  }

  .spend {
    grid-column: 1 / -1;
  }

  .stack {
    display: flex;
    gap: 3px;
    height: 1rem;
    border-radius: var(--pill);
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .legend {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    & li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
    & i {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 3px;
      background: var(--c);
    }
    & strong {
      margin-left: auto;
      font-weight: 700;
    }
  }

  @media (max-width: 60rem) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .spend {
      grid-column: 1 / -1;
    }
  }
</style>
