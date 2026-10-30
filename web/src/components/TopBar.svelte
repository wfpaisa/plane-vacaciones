<script lang="ts">
  import { session } from "../lib/session.svelte";
  import { theme } from "../lib/theme.svelte";
  import { exchangeSource } from "../lib/exchange";
  import { accountPanel } from "../lib/account.svelte";
  import { openMcpPanel } from "../lib/mcpPanel.svelte";
  import type { TripStore } from "../lib/tripStore.svelte";
  import Icon from "./Icon.svelte";
  import Logo from "./Logo.svelte";

  let { store = null }: { store?: TripStore | null } = $props();
  const trip = $derived(store?.trip);
  const primary = $derived(trip?.currency || "COP");
  const quote = $derived.by(() => {
    const rate = store?.exchange;
    const secondary = trip?.secondary_currency;
    if (!rate || !secondary) return null;
    const inverse = primary === "COP" && secondary !== "COP";
    return {
      from: inverse ? secondary : primary,
      to: inverse ? primary : secondary,
      amount: inverse ? 1 / rate.rate : rate.rate,
    };
  });
</script>

<header class="topbar" class:trip-map={!!store}>
  <a href="#/" class="home" aria-label="Viajes"><Logo /></a>
  <nav>
    <a href="#/" class="btn sm">Viajes</a>
    {#if trip?.secondary_currency && trip.secondary_currency !== primary}
      <div class="currency" aria-label="Moneda del viaje">
        <div class="currency-switch" role="group" aria-label="Moneda para mostrar importes">
          <button type="button" class:active={store?.currentCurrency === primary} aria-pressed={store?.currentCurrency === primary} onclick={() => store?.chooseCurrency(primary)}>{primary}</button>
          <button type="button" class:active={store?.currentCurrency === trip.secondary_currency} aria-pressed={store?.currentCurrency === trip.secondary_currency} disabled={!store?.exchange} onclick={() => store?.chooseCurrency(trip.secondary_currency)}>{trip.secondary_currency}</button>
        </div>
        <button type="button" class="rate-trigger" aria-label="Ver tasa de cambio" aria-describedby="currency-rate-tooltip">ⓘ</button>
        <div class="rate-tooltip" id="currency-rate-tooltip">
          {#if store?.exchange && quote}
            1 {quote.from} ≈ {quote.amount.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {quote.to} · {store.exchange.date} ·
            <a href={exchangeSource(store.exchange).url} target="_blank" rel="noopener noreferrer">{store.exchange.source === "trm" ? "TRM oficial" : "Rates By Exchange Rate API"}</a>
            {#if store.exchange.expires === 0} · Tasa guardada{/if}
          {:else if store?.rateLoading}
            Consultando tasa de cambio…
          {:else}
            {store?.rateError || "Tasa no disponible."} <button type="button" onclick={() => store?.refreshRate()}>Reintentar</button>
          {/if}
        </div>
      </div>
    {/if}
    <button type="button" class="btn sm" title="Conectar un agente IA por MCP" onclick={() => openMcpPanel(trip ?? null)}>
      <Icon name="ai-magic" /> <span class="agent-label">Agente IA</span>
    </button>
    <button
      type="button"
      class="btn icon sm round"
      aria-label={theme.dark ? "Usar tema claro" : "Usar tema oscuro"}
      title={theme.dark ? "Tema claro" : "Tema oscuro"}
      onclick={() => theme.toggle()}
    >
      <Icon name={theme.dark ? "sun-03" : "moon-02"} />
    </button>
    <button type="button" class="btn icon sm round" aria-label="Cuenta y contraseñas" title="Cuenta" onclick={() => (accountPanel.open = true)}>
      <Icon name="user-circle" />
    </button>
    <button type="button" class="btn icon sm round" aria-label="Salir" title="Salir" onclick={() => session.logout()}>
      <Icon name="logout-01" />
    </button>
  </nav>
</header>

<style>
  .topbar {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-h);
    padding: 0 clamp(1rem, 2.5vw, 2rem);
    pointer-events: none;

    & > * {
      pointer-events: auto;
    }

    /* Lo que se desplaza por debajo se esfuma y desenfoca en vez de chocar con la barra. */
    &::before {
      content: "";
      position: absolute;
      inset: 0 0 -1.25rem 0;
      z-index: -1;
      pointer-events: none;
      background: linear-gradient(180deg, color-mix(in oklch, var(--canvas) 85%, transparent), transparent);
    }
  }

  .topbar.trip-map::before { display: none; }

  .home {
    text-decoration: none;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .currency {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    margin-right: 0.25rem;
    pointer-events: auto;
  }

  .currency-switch {
    display: flex;
    align-items: stretch;
    gap: 0.125rem;
    height: 2rem;
    padding: 0.125rem;
    border: 1px solid var(--glass-line);
    border-radius: var(--pill);
    background: var(--glass);
  }

  .currency-switch button {
    padding: 0 0.625rem;
    border: 0;
    border-radius: var(--pill);
    background: transparent;
    color: var(--ink-soft);
    font: 550 0.75rem/1 var(--font-display);
    cursor: pointer;
  }

  .currency-switch button.active { background: var(--pill-on); color: var(--pill-on-text); }
  .currency-switch button:disabled { opacity: 0.45; cursor: wait; }

  .rate-trigger {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--glass-line);
    border-radius: 50%;
    background: var(--glass);
    color: var(--ink-soft);
    cursor: help;
    font-size: 0.875rem;
  }

  .rate-tooltip {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 1000;
    width: max-content;
    max-width: min(25rem, calc(100vw - 2rem));
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--glass-line);
    border-radius: var(--r);
    background: var(--glass-strong);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    box-shadow: var(--shadow);
    color: var(--ink);
    font-size: 0.75rem;
    line-height: 1.45;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-0.25rem);
    transition: opacity 0.15s, transform 0.15s, visibility 0.15s;
  }

  .currency:hover .rate-tooltip,
  .currency:focus-within .rate-tooltip {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0);
  }

  .rate-tooltip a, .rate-tooltip button { color: inherit; text-decoration: underline; }
  .rate-tooltip button { padding: 0; border: 0; background: none; cursor: pointer; }

  @media (max-width: 32rem) { nav > a, .agent-label { display: none; } }
</style>
