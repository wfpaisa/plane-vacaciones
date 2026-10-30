<!--
  Los viajes de la familia sobre el mapa. Abajo, una fila de tarjetas de
  vidrio; la elegida dibuja su recorrido en el mapa de fondo.
-->
<script lang="ts">
  import Avatar from "../components/Avatar.svelte";
  import Icon from "../components/Icon.svelte";
  import Modal from "../components/Modal.svelte";
  import TripForm from "../components/TripForm.svelte";
  import TripMap from "../components/ProviderMap.svelte";
  import { countdown, dateRange, toDate, today, tripLength } from "../lib/format";
  import { errorText, pb } from "../lib/pb";
  import { openMcpPanel } from "../lib/mcpPanel.svelte";
  import { tripPath } from "../lib/router.svelte";
  import { schedule, sortStops } from "../lib/stops";
  import { toast } from "../lib/toast.svelte";
  import type { Stop, Traveler, Trip, TripDraft } from "../lib/types";

  let trips = $state<Trip[]>([]);
  let travelers = $state<Traveler[]>([]);
  let stops = $state<Stop[]>([]);
  let loading = $state(true);
  let creating = $state(false);
  let busy = $state(false);
  let active = $state<string | null>(null);
  /** "ia": solo el nombre; el agente conectado por MCP arma el resto. */
  let mode = $state<"manual" | "ia">("manual");
  let aiName = $state("");

  async function load() {
    try {
      [trips, travelers, stops] = await Promise.all([
        pb.collection("trips").getFullList<Trip>({ sort: "start_date" }),
        pb.collection("travelers").getFullList<Traveler>({ sort: "created" }),
        pb.collection("stops").getFullList<Stop>({ sort: "position,created" }),
      ]);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      loading = false;
    }
  }

  load();

  const isPast = (t: Trip) => {
    const end = toDate(t.end_date) ?? toDate(t.start_date);
    return !!end && end < today();
  };
  /** Primero los próximos, luego los recuerdos. */
  const ordered = $derived([...trips.filter((t) => !isPast(t)), ...trips.filter(isPast).reverse()]);
  const current = $derived(ordered.find((t) => t.id === active) ?? ordered[0] ?? null);
  const currentLegs = $derived(current ? schedule(stops.filter((s) => s.trip === current.id)) : []);

  const familyOf = (id: string) => travelers.filter((t) => t.trip === id);
  const routeOf = (id: string) => sortStops(stops.filter((s) => s.trip === id));
  const tone = (t: Trip) => {
    const c = countdown(t.start_date, t.end_date);
    return c.tone === "now" ? "var(--leaf)" : c.tone === "soon" ? "var(--lime)" : "var(--ink-muted)";
  };

  function openCreate() {
    mode = "manual";
    aiName = "";
    creating = true;
  }

  async function createEmpty(e: SubmitEvent) {
    e.preventDefault();
    const name = aiName.trim();
    if (!name || busy) return;
    busy = true;
    try {
      const trip = await pb.collection("trips").create<Trip>({ name, currency: "COP", cover: "mar", budget: 0 });
      creating = false;
      toast.ok("Viaje creado. Conecte su agente para completarlo.");
      location.hash = tripPath(trip.id);
      openMcpPanel(trip);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      busy = false;
    }
  }

  async function create(draft: TripDraft) {
    busy = true;
    try {
      const trip = await pb.collection("trips").create<Trip>(draft.trip);
      await Promise.all([
        ...draft.travelers.map((t) => pb.collection("travelers").create({ ...t, trip: trip.id })),
        ...draft.stops.map((s) => pb.collection("stops").create({ ...s, trip: trip.id })),
      ]);
      toast.ok("Viaje creado.");
      location.hash = tripPath(trip.id, "ruta");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      busy = false;
    }
  }
</script>

<div class="stage" aria-hidden="true">
  <TripMap
      places={[]}
      legs={currentLegs}
      center={null}
      controls={false}
      useSavedZoom={false}
      maxZoom={10}
      inset={{ top: 160, right: 80, bottom: 330, left: 80 }}
    />
</div>
<div class="stage-veil"></div>

<div class="home">
  <header class="intro">
    <div>
      <p class="eyebrow">Viajes en familia</p>
      <h1>¿A dónde vamos ahora?</h1>
    </div>
    <div class="intro-actions">
      <span class="count chip" aria-pressed="true">Viajes ({trips.length})</span>
      <button class="btn blue" onclick={openCreate}><Icon name="add-01" /> Nuevo viaje</button>
    </div>
  </header>

  {#if loading}
    <div class="row">
      {#each [0, 1, 2] as i (i)}<div class="trip card skeleton"></div>{/each}
    </div>
  {:else if !trips.length}
    <div class="empty card">
      <Icon name="route-01" size={26} />
      <h2>Aún no hay viajes</h2>
      <p class="muted">Cree un viaje, elija las ciudades y agregue a los viajeros. Verá el recorrido en el mapa.</p>
      <button class="btn primary" onclick={openCreate}><Icon name="add-01" /> Nuevo viaje</button>
    </div>
  {:else}
    <div class="row">
      {#each ordered as t, i (t.id)}
        {@const c = countdown(t.start_date, t.end_date)}
        {@const route = routeOf(t.id)}
        <a
          href={tripPath(t.id)}
          class="trip card rise"
          class:on={current?.id === t.id}
          class:past={isPast(t)}
          style="animation-delay: {i * 60}ms"
          onmouseenter={() => (active = t.id)}
          onfocus={() => (active = t.id)}
        >
          <p class="eyebrow">{t.destination || route.map((s) => s.country).filter(Boolean).join(", ") || "Viaje"}</p>
          <h2>{t.name}</h2>
          <div class="mid">
            <span class="tag" style="--c: {tone(t)}">{c.label}</span>
            <p class="big-num">{tripLength(t.start_date, t.end_date) || "–"}<small>días</small></p>
          </div>
          <p class="route">
            {#if route.length}
              {#each route as s, j (s.id)}{#if j}<span class="arrow">→</span>{/if}<span>{s.name}</span>{/each}
            {:else}
              Aún no hay ciudades en la ruta
            {/if}
          </p>
          <footer>
            <span class="dates">{dateRange(t.start_date, t.end_date)}</span>
            <span class="faces">
              {#each familyOf(t.id).slice(0, 4) as f (f.id)}<Avatar traveler={f} size={24} ring />{/each}
            </span>
            <span class="go" aria-hidden="true"><Icon name="arrow-right-01" /></span>
          </footer>
        </a>
      {/each}
    </div>
  {/if}
</div>

<Modal open={creating} onClose={() => (creating = false)} title="Nuevo viaje" width="44rem">
  <div class="modes" role="group" aria-label="Cómo crear el viaje">
    <button type="button" class="chip" aria-pressed={mode === "manual"} onclick={() => (mode = "manual")}>
      <Icon name="edit-02" /> Completar yo
    </button>
    <button type="button" class="chip" aria-pressed={mode === "ia"} onclick={() => (mode = "ia")}>
      <Icon name="ai-magic" /> Con un agente IA
    </button>
  </div>
  {#if mode === "manual"}
    <TripForm creating {busy} submitLabel="Crear viaje" onSubmit={create} onCancel={() => (creating = false)} />
  {:else}
    <form class="ai-form" onsubmit={createEmpty}>
      <label class="field">
        <span>Nombre del viaje</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" bind:value={aiName} placeholder="Europa 2027" maxlength="120" required autofocus />
      </label>
      <div class="ai-steps">
        <p>Se crea un viaje vacío con este nombre. Después:</p>
        <ol>
          <li>Active el MCP y copie la configuración en su agente. Es una sola conexión para todos los viajes.</li>
          <li>Copie el mensaje para el agente: ya incluye este viaje.</li>
          <li>Converse con el agente: primero le preguntará desde dónde salen. Ciudades, lugares, gastos y checklist aparecen aquí a medida que los guarda.</li>
        </ol>
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" onclick={() => (creating = false)}>Cancelar</button>
        <button type="submit" class="btn primary" disabled={busy || !aiName.trim()}>
          {busy ? "Creando…" : "Crear y conectar agente"}
        </button>
      </div>
    </form>
  {/if}
</Modal>

<style>
  .home {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: calc(100dvh - var(--header-h));
    padding: 1rem clamp(1rem, 2.5vw, 2rem) 1.5rem;
    pointer-events: none;

    & > * {
      pointer-events: auto;
    }
  }

  .intro {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;

    & h1 {
      margin-top: 0.25rem;
      font-size: clamp(2rem, 4.5vw, 3.25rem);
      font-weight: 400;
      letter-spacing: -0.035em;
    }
  }

  .intro-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .count {
    cursor: default;
  }

  .row {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(17rem, 21rem);
    gap: 0.875rem;
    overflow-x: auto;
    padding: 1rem 0.25rem 0.5rem;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .trip {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-height: 15rem;
    padding: 1.125rem 1.25rem 1rem;
    color: inherit;
    text-decoration: none;
    scroll-snap-align: start;
    transition:
      transform 0.3s var(--ease),
      background 0.3s,
      border-color 0.3s,
      box-shadow 0.3s;

    & h2 {
      font-size: 1.25rem;
      font-weight: 450;
    }

    &:hover,
    &.on {
      transform: translateY(-6px);
      background: var(--glass-strong);
      border-color: var(--accent);
      /* El anillo suma un segundo píxel al borde sin mover el contenido. */
      box-shadow:
        0 0 0 1px var(--accent),
        var(--shadow-lg);
    }
    &.past {
      opacity: 0.8;
    }
  }

  .mid {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0.75rem 0 0.5rem;

    & .big-num {
      font-size: 3.25rem;
    }
  }

  .route {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.125rem 0.35rem;
    font-size: 0.8125rem;
    color: var(--ink-soft);

    & .arrow {
      color: var(--ink-muted);
    }
  }

  footer {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-top: auto;
    padding-top: 0.875rem;

    & .dates {
      flex: 1;
      font-size: 0.75rem;
      color: var(--ink-muted);
    }
  }

  .faces {
    display: flex;
    & :global(.avatar + .avatar) {
      margin-left: -0.35rem;
    }
  }

  .go {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--glass-soft);
    border: 1px solid var(--glass-line);
    transition:
      background 0.2s,
      color 0.2s;
  }

  .trip:hover .go,
  .trip.on .go {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }

  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .ai-form {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  .ai-steps {
    padding: 1rem;
    border: 1px solid var(--line);
    border-radius: var(--r);
    background: var(--paper);
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--ink-soft);

    & ol {
      margin: 0.5rem 0 0;
      padding-left: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
  }

  .ai-form .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }

  .skeleton {
    opacity: 0.6;
  }

  .empty {
    align-self: flex-start;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    max-width: 24rem;
    padding: 1.5rem;

    & .btn {
      margin-top: 0.5rem;
    }
  }
</style>
