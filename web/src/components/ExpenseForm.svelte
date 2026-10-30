<!-- Un gasto: qué, cuánto, quién lo pagó y entre quiénes se reparte. -->
<script lang="ts">
  import { EXPENSE_CATEGORIES } from "../lib/catalog";
  import { fromInput, toInput } from "../lib/format";
  import type { Expense, ExpenseCategory, Stop, Traveler } from "../lib/types";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";

  let {
    initial,
    travelers,
    stops = [],
    currency,
    busy = false,
    onSubmit,
    onCancel,
    onDelete,
  }: {
    initial: Partial<Expense>;
    travelers: Traveler[];
    stops?: Stop[];
    currency: string;
    busy?: boolean;
    onSubmit: (data: Partial<Expense>) => void;
    onCancel: () => void;
    onDelete?: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const init = initial;
  let title = $state(init.title ?? "");
  let category = $state<ExpenseCategory>((init.category as ExpenseCategory) || "comida");
  let amount = $state<number | null>(init.amount || null);
  // El monto se escribe con puntos de miles y coma decimal (es-CO): 1.250.000,50.
  let amountText = $state(init.amount ? new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(init.amount) : "");
  const symbol = $derived(new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "COP" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "");
  let date = $state(toInput(init.date));
  let status = $state(init.status || "planeado");
  /** En «¿Quién lo pagó?», cada viajero pagó su parte por aparte. */
  const INDIVIDUAL = "__individual";
  let paidBy = $state(init.paid_individually ? INDIVIDUAL : (init.paid_by ?? ""));
  let stop = $state(init.stop ?? "");
  let notes = $state(init.notes ?? "");
  // svelte-ignore state_referenced_locally
  let split = $state<string[]>(init.split?.length ? [...init.split] : travelers.map((t) => t.id));

  const each = $derived(split.length && amount ? amount / split.length : 0);

  const money = (n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);

  /** Reescribe el monto con puntos de miles y deja el cursor tras el mismo dígito. */
  function typeAmount(e: Event & { currentTarget: HTMLInputElement }) {
    const el = e.currentTarget;
    const caret = el.selectionStart ?? el.value.length;
    const keep = (v: string) => v.replace(/[^\d,]/g, "");
    const before = keep(el.value.slice(0, caret)).length;
    const raw = keep(el.value);
    const [whole, ...rest] = raw.split(",");
    const int = whole.replace(/^0+(?=\d)/, "");
    const dec = rest.join("").slice(0, 2);
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    amountText = raw.includes(",") ? `${grouped || "0"},${dec}` : grouped;
    amount = int || dec ? Number(`${int || "0"}.${dec || "0"}`) : null;
    el.value = amountText;
    let pos = 0;
    for (let seen = 0; pos < amountText.length && seen < before; pos++) if (/[\d,]/.test(amountText[pos])) seen++;
    el.setSelectionRange(pos, pos);
  }

  function toggle(id: string) {
    split = split.includes(id) ? split.filter((x) => x !== id) : [...split, id];
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const all = split.length === travelers.length;
    onSubmit({
      title: title.trim(),
      category,
      amount: amount ?? 0,
      date: fromInput(date),
      status,
      paid_by: status === "pagado" && paidBy !== INDIVIDUAL ? paidBy : "",
      paid_individually: status === "pagado" && paidBy === INDIVIDUAL,
      stop,
      split: all ? [] : split,
      notes: notes.trim(),
    });
  }
</script>

<form onsubmit={submit} class="expense-form">
  <div class="amount">
    <label for="expense-amount">Monto</label>
    <div class="amount-row">
      {#if symbol && symbol !== currency}<span class="symbol">{symbol}</span>{/if}
      <input
        id="expense-amount"
        class="num"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        value={amountText}
        oninput={typeAmount}
        placeholder="0"
        required
        style="width: {Math.max(amountText.length, 1) + 0.6}ch"
      />
      <span class="code">{currency}</span>
    </div>
  </div>

  <label class="field">
    <span>Concepto</span>
    <input class="input" bind:value={title} required maxlength="160" placeholder="Vuelo Bogotá – Madrid" />
  </label>

  <fieldset class="field">
    <span>Categoría</span>
    <div class="cats">
      {#each Object.entries(EXPENSE_CATEGORIES) as [key, c] (key)}
        <label class="cat" style="--c: {c.color}">
          <input type="radio" name="category" value={key} bind:group={category} class="sr-only" />
          <Icon name={c.icon} size={18} />
          <small>{c.label}</small>
        </label>
      {/each}
    </div>
  </fieldset>

  <div class="grid-2">
    <fieldset class="field">
      <span>Estado</span>
      <div class="seg" role="radiogroup">
        <label><input type="radio" bind:group={status} value="planeado" class="sr-only" /> Planeado</label>
        <label><input type="radio" bind:group={status} value="pagado" class="sr-only" /> Pagado</label>
      </div>
    </fieldset>
    <label class="field">
      <span>Fecha</span>
      <input class="input" type="date" bind:value={date} />
    </label>
  </div>

  {#if stops.length > 1}
    <label class="field">
      <span>Ciudad</span>
      <select class="select" bind:value={stop}>
        <option value="">No corresponde a una ciudad</option>
        {#each stops as s, i (s.id)}<option value={s.id}>{i + 1}. {s.name}</option>{/each}
      </select>
    </label>
  {/if}

  {#if status === "pagado"}
    <label class="field">
      <span>¿Quién lo pagó?</span>
      <select class="select" bind:value={paidBy} required>
        <option value="" disabled>Seleccione un viajero</option>
        <option value={INDIVIDUAL}>Pagado individualmente</option>
        <optgroup label="Lo pagó una persona">
          {#each travelers as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
        </optgroup>
      </select>
      {#if paidBy === INDIVIDUAL}
        <small class="hint">Cada viajero que comparte el gasto pagó su parte por aparte{each ? ` (${money(each)} ${currency} cada uno)` : ""}. No genera deudas entre ustedes.</small>
      {/if}
    </label>
  {/if}

  {#if travelers.length}
    <fieldset class="field">
      <span>Viajeros que comparten el gasto {each ? `· ${money(each)} por persona` : ""}</span>
      <div class="split">
        {#each travelers as t (t.id)}
          <button type="button" class="who" aria-pressed={split.includes(t.id)} onclick={() => toggle(t.id)}>
            <Avatar traveler={t} size={26} />
            {t.name}
          </button>
        {/each}
      </div>
    </fieldset>
  {/if}

  <label class="field">
    <span>Nota <em class="optional">(opcional)</em></span>
    <textarea class="input" bind:value={notes} rows="2" maxlength="2000" placeholder="Por ejemplo: incluye desayuno; se reembolsa la mitad"></textarea>
  </label>

  <div class="actions">
    {#if onDelete}
      <button type="button" class="btn danger sm" onclick={onDelete}><Icon name="delete-02" /> Borrar</button>
    {/if}
    <span class="spacer"></span>
    <button type="button" class="btn ghost" onclick={onCancel}>Cancelar</button>
    <button type="submit" class="btn primary" disabled={busy || !split.length}>{busy ? "Guardando…" : "Guardar gasto"}</button>
  </div>
</form>

<style>
  .expense-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }

  .amount {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.875rem 1rem 1rem;
    border: 1px solid var(--line);
    border-radius: var(--r);
    background: var(--paper);
    transition: border-color 0.15s, box-shadow 0.15s;

    &:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent);
    }
    & label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
  }

  .amount-row {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.375rem;
    max-width: 100%;

    & input {
      min-width: 2ch;
      max-width: 100%;
      padding: 0;
      border: 0;
      background: none;
      text-align: center;
      font-size: 2.5rem;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      color: var(--ink);
      &:focus {
        outline: none;
      }
      &::placeholder {
        color: var(--line-strong);
      }
    }
    & .symbol {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--ink-muted);
    }
    & .code {
      align-self: center;
      padding: 0.2rem 0.5rem;
      border-radius: var(--pill);
      background: var(--paper-deep);
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ink-muted);
    }
  }

  .optional {
    font-style: normal;
    font-weight: 500;
    color: var(--ink-muted);
  }

  textarea {
    resize: vertical;
    min-height: 3.75rem;
    line-height: 1.5;
  }

  .hint {
    font-size: 0.75rem;
    line-height: 1.45;
    color: var(--ink-muted);
  }

  .cats {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.375rem;
  }

  .cat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.5rem 0.125rem;
    border: 1px solid var(--line);
    border-radius: var(--r);
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 0.15s;

    & small {
      font-size: 0.68rem;
      font-weight: 600;
    }
    &:hover {
      color: var(--c);
      border-color: var(--c);
    }
    &:has(input:checked) {
      border-color: var(--c);
      background: color-mix(in oklch, var(--c) 14%, transparent);
      color: color-mix(in oklch, var(--c) 85%, var(--ink));
    }
  }

  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0.25rem;
    height: 2.625rem;
    border-radius: var(--r);
    background: var(--paper-deep);

    & label {
      display: grid;
      place-items: center;
      border-radius: var(--r-sm);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--ink-muted);
      cursor: pointer;
      transition: all 0.15s;
    }
    & label:has(input:checked) {
      background: var(--surface);
      color: var(--ink);
      box-shadow: var(--shadow-sm);
    }
    & label:has(input:focus-visible) {
      outline: 2px solid var(--accent);
    }
  }

  .split {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .who {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.75rem 0.2rem 0.2rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--pill);
    background: var(--surface);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    opacity: 0.5;
    transition: all 0.15s;

    &[aria-pressed="true"] {
      opacity: 1;
      border-color: var(--ink);
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

  @media (max-width: 34rem) {
    .cats {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
