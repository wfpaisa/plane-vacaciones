<!--
  El plan de gastos: cuánto hay, cuánto se piensa gastar y en qué, lo que ya
  se pagó y quién le debe a quién para quedar a paz y salvo.
-->
<script lang="ts">
  import Avatar from "../components/Avatar.svelte";
  import BudgetRing from "../components/BudgetRing.svelte";
  import ExpenseForm from "../components/ExpenseForm.svelte";
  import Icon from "../components/Icon.svelte";
  import Modal from "../components/Modal.svelte";
  import { EXPENSE_CATEGORIES } from "../lib/catalog";
  import { shortDate, toDate } from "../lib/format";
  import { errorText } from "../lib/pb";
  import { balances, settleUp } from "../lib/settle";
  import { schedule, sortStops } from "../lib/stops";
  import { toast } from "../lib/toast.svelte";
  import type { TripStore } from "../lib/tripStore.svelte";
  import type { Expense, ExpenseCategory } from "../lib/types";

  let { store }: { store: TripStore } = $props();

  const trip = $derived(store.trip!);
  const money = (n: number) => store.money(n);

  const planned = $derived(store.expenses.reduce((a, e) => a + (e.amount || 0), 0));
  const paid = $derived(store.expenses.filter((e) => e.status === "pagado").reduce((a, e) => a + e.amount, 0));
  const left = $derived(trip.budget - planned);
  const perPerson = $derived(store.travelers.length ? planned / store.travelers.length : 0);
  const placesCost = $derived(store.places.reduce((a, p) => a + (p.cost || 0), 0));

  const byCategory = $derived(
    (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((key) => {
      const list = store.expenses.filter((e) => (e.category || "otros") === key);
      return {
        key,
        ...EXPENSE_CATEGORIES[key],
        planned: list.reduce((a, e) => a + e.amount, 0),
        paid: list.filter((e) => e.status === "pagado").reduce((a, e) => a + e.amount, 0),
        cap: trip.category_budgets?.[key] ?? 0,
        count: list.length,
      };
    }),
  );
  const maxCat = $derived(Math.max(1, ...byCategory.map((c) => Math.max(c.planned, c.cap))));

  const legs = $derived(schedule(store.stops));
  const byCity = $derived(
    legs.map((l) => {
      const total = store.expenses.filter((e) => e.stop === l.stop.id).reduce((a, e) => a + e.amount, 0);
      return { leg: l, total, perNight: l.stop.nights ? total / l.stop.nights : 0 };
    }),
  );
  const general = $derived(store.expenses.filter((e) => !e.stop).reduce((a, e) => a + e.amount, 0));
  const maxCity = $derived(Math.max(1, ...byCity.map((c) => c.total), general));
  const stopName = (id: string) => store.stops.find((s) => s.id === id)?.name ?? "";

  const people = $derived(balances(store.expenses, store.travelers));
  const transfers = $derived(settleUp(people));

  // ——— Filtros de la lista ———
  let cat = $state<ExpenseCategory | "">("");
  let status = $state<"" | "planeado" | "pagado">("");
  const list = $derived(
    store.expenses
      .filter((e) => (!cat || e.category === cat) && (!status || e.status === status))
      .sort((a, b) => (b.date || b.created).localeCompare(a.date || a.created)),
  );

  // ——— Formularios ———
  let form = $state<{ initial: Partial<Expense>; id?: string } | null>(null);
  let busy = $state(false);

  async function save(data: Partial<Expense>) {
    if (!form) return;
    busy = true;
    try {
      await store.saveExpense(data, form.id);
      toast.ok(form.id ? "Gasto actualizado." : "Gasto registrado.");
      form = null;
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!form?.id) return;
    const id = form.id;
    form = null;
    try {
      await store.deleteExpense(id);
      toast.info("Gasto borrado.");
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function togglePaid(e: Expense) {
    if (e.status !== "pagado" && !e.paid_by && !e.paid_individually) {
      form = { initial: { ...e, status: "pagado" }, id: e.id };
      return;
    }
    try {
      await store.saveExpense({ status: e.status === "pagado" ? "planeado" : "pagado" }, e.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  // ——— Presupuestos editables en su sitio ———
  let editing = $state<string | null>(null);
  let draft = $state<number | null>(null);

  function startEdit(key: string, value: number) {
    editing = key;
    draft = value || null;
  }

  async function commitEdit() {
    const key = editing;
    editing = null;
    if (!key) return;
    const value = Math.max(0, Number(draft) || 0);
    try {
      if (key === "total") await store.updateTrip({ budget: value });
      else await store.updateTrip({ category_budgets: { ...(trip.category_budgets ?? {}), [key]: value } });
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  const travelerName = (id: string) => store.travelers.find((t) => t.id === id);
</script>

{#snippet editable(key: string, value: number, label: string)}
  {#if editing === key}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="input num inline"
      type="number"
      min="0"
      step="any"
      autofocus
      bind:value={draft}
      onblur={commitEdit}
      onkeydown={(e) => {
        if (e.key === "Enter") commitEdit();
        if (e.key === "Escape") editing = null;
      }}
      aria-label={`${label} en ${trip.currency}`}
    />
  {:else}
    <button class="editable num" title="Cambiar {label.toLowerCase()} en {trip.currency}" onclick={() => startEdit(key, value)}>
      {value ? money(value) : "Definir"}
      <Icon name="pencil-edit-02" />
    </button>
  {/if}
{/snippet}

<div class="expenses">
  {#if store.currentCurrency !== trip.currency}<p class="currency-note">Los importes se muestran en {store.currentCurrency}. Al editar, escriba el valor en {trip.currency}.</p>{/if}
  <section class="card overview rise">
    <BudgetRing
      total={trip.budget}
      segments={byCategory.map((c) => ({ value: c.planned, color: c.color, label: c.label }))}
      size={196}
    >
      {#if trip.budget}
        <strong class="pct" class:over={left < 0}>{Math.round((planned / trip.budget) * 100)}%</strong>
        <span class="muted">del presupuesto</span>
      {:else}
        <strong class="pct small">{money(planned)}</strong>
        <span class="muted">en gastos registrados</span>
      {/if}
    </BudgetRing>

    <div class="figures">
      <div class="fig big">
        <span class="eyebrow">Presupuesto</span>
        {@render editable("total", trip.budget, "Presupuesto total")}
      </div>
      <div class="fig">
        <span class="eyebrow">Gastos registrados</span>
        <strong class="num">{money(planned)}</strong>
      </div>
      <div class="fig">
        <span class="eyebrow">Ya pagado</span>
        <strong class="num">{money(paid)}</strong>
      </div>
      {#if trip.budget}
        <div class="fig">
          <span class="eyebrow">{left < 0 ? "Excede el presupuesto por" : "Presupuesto disponible"}</span>
          <strong class="num" class:bad={left < 0} class:good={left >= 0}>{money(Math.abs(left))}</strong>
        </div>
      {/if}
      <div class="fig">
        <span class="eyebrow">Promedio por viajero</span>
        <strong class="num">{money(perPerson)}</strong>
      </div>
      {#if placesCost}
        <p class="note">
          <Icon name="ticket-01" /> Los costos estimados de los lugares suman <strong>{money(placesCost)}</strong>. No se agregan automáticamente a los gastos.
        </p>
      {/if}
    </div>
  </section>

  <section class="card cats rise" style="animation-delay: 60ms">
    <header>
      <h3>Por categoría</h3>
      <span class="muted small">Seleccione un límite para cambiarlo</span>
    </header>
    <ul>
      {#each byCategory as c (c.key)}
        <li style="--c: {c.color}">
          <span class="ico"><Icon name={c.icon} /></span>
          <div class="row">
            <div class="labels">
              <strong>{c.label}</strong>
              <span class="num">{money(c.planned)}</span>
            </div>
            <div class="bar" title="{money(c.paid)} pagado de {money(c.planned)}">
              <span class="planned" style="width: {(c.planned / maxCat) * 100}%"></span>
              <span class="paid" style="width: {(c.paid / maxCat) * 100}%"></span>
              {#if c.cap}<span class="cap" class:over={c.planned > c.cap} style="left: {(c.cap / maxCat) * 100}%"></span>{/if}
            </div>
            <div class="sub">
              <span class="muted">{c.count} {c.count === 1 ? "gasto" : "gastos"}</span>
              <span class="cap-edit">Tope: {@render editable(c.key, c.cap, `Tope de ${c.label}`)}</span>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <section class="card settle rise" style="animation-delay: 120ms">
    <header>
      <h3>Reparto de gastos</h3>
      <span class="muted small">Solo se incluyen los gastos pagados</span>
    </header>
    {#if !store.travelers.length}
      <p class="muted">Agregue viajeros para repartir los gastos.</p>
    {:else}
      <ul class="people">
        {#each people as b (b.traveler.id)}
          <li>
            <Avatar traveler={b.traveler} size={34} />
            <div>
              <strong>{b.traveler.name}</strong>
              <small class="muted num">Pagó {money(b.paid)} · le corresponde {money(b.share)}</small>
            </div>
            <span class="net num" class:pos={b.net > 0.5} class:neg={b.net < -0.5}>
              <small>{b.net > 0.5 ? "Debe recibir" : b.net < -0.5 ? "Debe pagar" : "Saldo"}</small>
              {money(Math.abs(b.net))}
            </span>
          </li>
        {/each}
      </ul>
      {#if transfers.length}
        <div class="transfers">
          <span class="eyebrow">Transferencias para saldar cuentas</span>
          {#each transfers as t (t.from.id + t.to.id)}
            <div class="transfer">
              <Avatar traveler={t.from} size={26} />
              <span><strong>{t.from.name}</strong> debe pagar <strong class="num">{money(t.amount)}</strong> a <strong>{t.to.name}</strong></span>
              <Avatar traveler={t.to} size={26} />
            </div>
          {/each}
        </div>
      {:else if paid > 0}
        <p class="even"><Icon name="checkmark-circle-02" /> Cuentas saldadas.</p>
      {/if}
    {/if}
  </section>

  {#if legs.length > 1}
    <section class="card cities">
      <header>
        <h3>Por ciudad</h3>
        <span class="muted small">Gastos asignados a cada parada</span>
      </header>
      <table>
        <thead>
          <tr><th>Ciudad</th><th class="r">Noches</th><th class="bar-col"></th><th class="r">Total</th><th class="r">Por noche</th></tr>
        </thead>
        <tbody>
          {#each byCity as c (c.leg.stop.id)}
            <tr>
              <td><span class="idx">{c.leg.index + 1}</span> {c.leg.stop.name}</td>
              <td class="r num">{c.leg.stop.nights}</td>
              <td class="bar-col"><div class="hbar"><i style="width: {(c.total / maxCity) * 100}%"></i></div></td>
              <td class="r num strong">{money(c.total)}</td>
              <td class="r num muted">{c.perNight ? money(c.perNight) : "—"}</td>
            </tr>
          {/each}
          <tr class="general">
            <td>General (vuelos, seguros…)</td>
            <td></td>
            <td class="bar-col"><div class="hbar"><i style="width: {(general / maxCity) * 100}%"></i></div></td>
            <td class="r num strong">{money(general)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </section>
  {/if}

  <section class="card list rise" style="animation-delay: 180ms">
    <header>
      <h3>Movimientos</h3>
      <div class="list-tools">
        <select class="select sm" bind:value={cat} aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {#each Object.entries(EXPENSE_CATEGORIES) as [k, c] (k)}<option value={k}>{c.label}</option>{/each}
        </select>
        <select class="select sm" bind:value={status} aria-label="Filtrar por estado">
          <option value="">Planeados y pagados</option>
          <option value="planeado">Solo planeados</option>
          <option value="pagado">Solo pagados</option>
        </select>
        <button class="btn primary" onclick={() => (form = { initial: { status: "planeado" } })}>
          <Icon name="add-01" /> Nuevo gasto
        </button>
      </div>
    </header>

    {#if !list.length}
      <div class="empty">
        <Icon name="wallet-02" size={30} />
        <p>{store.expenses.length ? "No hay gastos que coincidan con los filtros." : "Aún no hay gastos. Agregue uno para empezar a planear el presupuesto."}</p>
      </div>
    {:else}
      <ul class="rows">
        {#each list as e (e.id)}
          {@const c = EXPENSE_CATEGORIES[e.category || "otros"]}
          {@const payer = travelerName(e.paid_by)}
          <li>
            <span class="ico" style="--c: {c.color}"><Icon name={c.icon} /></span>
            <button class="what" onclick={() => (form = { initial: e, id: e.id })}>
              <strong>{e.title}</strong>
              <small class="muted">
                {c.label}{e.stop ? ` · ${stopName(e.stop)}` : ""}{e.date ? ` · ${shortDate(toDate(e.date))}` : ""}{e.paid_individually ? " · cada uno pagó lo suyo" : payer ? ` · pagó ${payer.name}` : ""}{e.split?.length
                  ? ` · entre ${e.split.length}`
                  : ""}
              </small>
              {#if e.notes}<small class="note" title={e.notes}>{e.notes}</small>{/if}
            </button>
            <button class="state" class:paid={e.status === "pagado"} onclick={() => togglePaid(e)} title={e.status === "pagado" ? "Marcar como planeado" : "Marcar como pagado"}>
              <Icon name={e.status === "pagado" ? "checkmark-circle-02" : "clock-01"} />
              {e.status === "pagado" ? "Pagado" : "Planeado"}
            </button>
            <strong class="amount num">{money(e.amount)}</strong>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<Modal open={!!form} onClose={() => (form = null)} title={form?.id ? "Editar gasto" : "Nuevo gasto"} eyebrow="Plan de gastos">
  {#if form}
    <ExpenseForm
      initial={form.initial}
      travelers={store.travelers}
      stops={sortStops(store.stops)}
      currency={trip.currency}
      {busy}
      onSubmit={save}
      onCancel={() => (form = null)}
      onDelete={form.id ? remove : undefined}
    />
  {/if}
</Modal>

<style>
  .expenses {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 1rem;
  }

  .currency-note {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--ink-soft);
    font-size: 0.8125rem;
  }

  .card {
    padding: 1.25rem 1.375rem;

    & header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;

      & h3 {
        font-size: 1.25rem;
      }
    }
  }

  .small {
    font-size: 0.75rem;
  }

  .overview {
    grid-column: span 7;
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .pct {
    font-family: var(--font-display);
    font-size: 2.75rem;
    font-weight: 300;
    letter-spacing: -0.03em;
    line-height: 1;
    &.small {
      font-size: 1.375rem;
    }
    &.over {
      color: var(--danger);
    }
  }

  .figures {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem 1.5rem;
  }

  .fig {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;

    & strong {
      font-size: 1.125rem;
      font-weight: 700;
    }
    &.big {
      grid-column: 1 / -1;
      & .editable {
        font-family: var(--font-display);
        font-size: 2.25rem;
        font-weight: 300;
        letter-spacing: -0.03em;
      }
    }
    & .bad {
      color: var(--danger);
    }
    & .good {
      color: var(--leaf);
    }
  }

  .note {
    grid-column: 1 / -1;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: var(--r);
    background: var(--sea-soft);
    font-size: 0.8125rem;
    color: var(--ink-soft);
  }

  .editable {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    font-weight: 700;
    cursor: pointer;
    color: var(--ink);

    & :global(i) {
      font-size: 0.8em;
      color: var(--ink-muted);
      opacity: 0;
      transition: opacity 0.15s;
    }
    &:hover :global(i) {
      opacity: 1;
    }
  }

  .inline {
    height: 2.25rem;
    max-width: 12rem;
  }

  .cats {
    grid-column: span 5;
    grid-row: span 2;

    & ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    & li {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }
  }

  .ico {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    flex-shrink: 0;
    border-radius: var(--r);
    background: color-mix(in oklch, var(--c) 18%, transparent);
    /* Los tonos claros (ámbar, lima) se oscurecen un poco para que el icono se lea. */
    color: color-mix(in oklch, var(--c) 75%, var(--ink));
    font-size: 1.1rem;
  }

  .row {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .labels,
  .sub {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .labels strong {
    font-weight: 600;
  }

  .labels .num {
    font-weight: 700;
  }

  .sub {
    font-size: 0.75rem;
    align-items: center;

    & .cap-edit {
      display: inline-flex;
      gap: 0.3rem;
      align-items: center;
      color: var(--ink-muted);
    }
    & .editable {
      font-weight: 600;
      font-size: 0.75rem;
    }
    & .inline {
      height: 1.75rem;
      max-width: 8rem;
      font-size: 0.8rem;
    }
  }

  .bar {
    position: relative;
    height: 0.625rem;
    border-radius: var(--pill);
    background: var(--paper-deep);

    & span {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: inherit;
      transition: width 0.6s var(--ease);
    }
    & .planned {
      background: color-mix(in oklch, var(--c) 30%, transparent);
    }
    & .paid {
      background: linear-gradient(90deg, color-mix(in oklch, var(--c) 65%, white), var(--c));
      box-shadow: 0 2px 10px -2px color-mix(in oklch, var(--c) 60%, transparent);
    }
    & .cap {
      top: -3px;
      bottom: -3px;
      width: 2px;
      border-radius: 1px;
      background: var(--ink);
      &.over {
        background: var(--danger);
      }
    }
  }

  .settle {
    grid-column: span 7;
  }

  .people {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem 1.25rem;

    & li {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0;
    }
    & div {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    & small {
      font-size: 0.72rem;
    }
  }

  .net {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    font-weight: 700;
    font-size: 0.875rem;
    color: var(--ink-muted);
    & small {
      font-weight: 400;
      white-space: nowrap;
    }
    &.pos {
      color: var(--leaf);
    }
    &.neg {
      color: var(--danger);
    }
  }

  .transfers {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.875rem;
    border-top: 1px solid var(--line);
  }

  .transfer {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--r);
    background: var(--paper);
    font-size: 0.875rem;

    & span {
      flex: 1;
    }
  }

  .even {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.75rem;
    color: var(--leaf);
    font-weight: 600;
  }

  .list {
    grid-column: 1 / -1;
  }

  .cities {
    grid-column: span 7;

    & table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }
    & th {
      padding: 0 0.5rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--ink-muted);
      text-align: left;
    }
    & td {
      padding: 0.5rem;
      border-top: 1px solid var(--line);
    }
    & .r {
      text-align: right;
    }
    & .strong {
      font-weight: 600;
    }
    & .bar-col {
      width: 30%;
    }
    & .general td {
      color: var(--ink-soft);
    }
  }

  .idx {
    display: inline-grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    margin-right: 0.375rem;
    border-radius: 50%;
    background: var(--ink);
    color: var(--surface);
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .hbar {
    height: 0.375rem;
    border-radius: var(--pill);
    background: var(--paper-deep);
    & i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }
  }

  .list-tools {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;

    & .select {
      width: auto;
      height: 2.5rem;
      font-size: 0.8125rem;
    }
  }

  .rows {
    margin: 0;
    padding: 0;
    list-style: none;

    & li {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.625rem 0;
      border-top: 1px solid var(--line);
    }
  }

  .what {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;

    & strong {
      font-weight: 600;
    }
    & small {
      font-size: 0.75rem;
    }
    &:hover strong {
      color: var(--accent-ink);
    }
    & .note {
      margin-top: 0.125rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ink-soft);
      font-style: italic;
    }
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--pill);
    background: var(--surface);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--ink-muted);
    cursor: pointer;

    &.paid {
      border-color: transparent;
      background: var(--leaf-soft);
      color: var(--leaf);
    }
  }

  .amount {
    min-width: 7rem;
    text-align: right;
    font-weight: 700;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--ink-muted);
    text-align: center;
  }

  @media (max-width: 64rem) {
    .overview,
    .cats,
    .settle,
    .cities {
      grid-column: 1 / -1;
      grid-row: auto;
    }
  }

  @media (max-width: 40rem) {
    .overview {
      flex-direction: column;
    }
    .people {
      grid-template-columns: 1fr;
    }
    .state {
      display: none;
    }
    .amount {
      min-width: 0;
    }
  }
</style>
