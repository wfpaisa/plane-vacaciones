<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import Logo from "../components/Logo.svelte";
  import { errorText } from "../lib/pb";
  import { session } from "../lib/session.svelte";

  let username = $state("");
  let password = $state("");
  let busy = $state(false);
  let error = $state("");

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = "";
    try {
      await session.login(username, password);
    } catch (err) {
      error = errorText(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="login">
  <section class="panel">
    <form onsubmit={submit}>
      <Logo size={32} />
      <div class="head">
        <h1>Iniciar sesión</h1>
        <p class="muted">Planeación de viajes de la familia.</p>
      </div>

      <label class="field">
        <span>Usuario</span>
        <input class="input" autocomplete="username" autocapitalize="none" spellcheck="false" bind:value={username} required />
      </label>
      <label class="field">
        <span>Contraseña</span>
        <input class="input" type="password" autocomplete="current-password" bind:value={password} required />
      </label>

      {#if error}<p class="error" role="alert"><Icon name="alert-02" /> {error}</p>{/if}

      <button class="btn primary" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
    </form>
  </section>

  <section class="aside" aria-hidden="true">
    <svg class="route" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="oklch(1 0 0 / 0.06)" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="600" height="600" fill="url(#grid)" />
      <path
        d="M90 470 C 170 380, 200 330, 250 300 S 360 300, 390 220 S 470 140, 520 110"
        fill="none"
        stroke="oklch(1 0 0 / 0.55)"
        stroke-width="2"
        stroke-dasharray="3 7"
        stroke-linecap="round"
      />
      {#each [[90, 470], [250, 300], [390, 220], [520, 110]] as [x, y], i (i)}
        <circle cx={x} cy={y} r="14" fill="oklch(1 0 0 / 0.12)" />
        <circle cx={x} cy={y} r="5" fill="oklch(1 0 0 / 0.9)" />
      {/each}
    </svg>
    <div class="copy">
      <p class="eyebrow">Itinerario · Mapa · Presupuesto</p>
      <h2>Todo el viaje, en un solo lugar.</h2>
      <p>Paradas, lugares por día, rutas en el mapa y un plan de gastos compartido entre todos.</p>
    </div>
  </section>
</div>

<style>
  .login {
    display: grid;
    grid-template-columns: minmax(22rem, 1fr) 1.15fr;
    min-height: 100dvh;
    background: var(--surface);
  }

  .panel {
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    max-width: 21rem;

    & .head {
      margin: 1.25rem 0 0.5rem;
    }
    & h1 {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
    }
    & .btn {
      height: 2.5rem;
      margin-top: 0.5rem;
    }
  }

  .error {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: var(--r);
    background: var(--danger-soft);
    color: var(--danger);
    font-size: 0.8125rem;
  }

  .aside {
    position: relative;
    overflow: hidden;
    background: linear-gradient(160deg, oklch(0.36 0.07 235), oklch(0.24 0.04 255));
    color: oklch(0.98 0 0);
  }

  .route {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .copy {
    position: absolute;
    left: 3rem;
    right: 3rem;
    bottom: 3rem;
    max-width: 28rem;

    & .eyebrow {
      color: oklch(1 0 0 / 0.65);
    }
    & h2 {
      margin: 0.5rem 0 0.75rem;
      font-size: 2rem;
      line-height: 1.15;
    }
    & p:last-child {
      color: oklch(1 0 0 / 0.75);
      font-size: 0.9375rem;
    }
  }

  @media (max-width: 52rem) {
    .login {
      grid-template-columns: 1fr;
    }
    .aside {
      display: none;
    }
  }
</style>
