<!--
  Un viaje: la postal de portada con la cuenta regresiva y las cuatro
  secciones (resumen, lugares y mapa, gastos y familia).
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import Avatar from "../components/Avatar.svelte";
  import Icon from "../components/Icon.svelte";
  import Modal from "../components/Modal.svelte";
  import TripForm from "../components/TripForm.svelte";
  import TripMap from "../components/ProviderMap.svelte";
  import { COVERS } from "../lib/catalog";
  import { countdown, dateRange, tripLength } from "../lib/format";
  import { errorText, pb } from "../lib/pb";
  import ShareSettings from "../components/ShareSettings.svelte";
  import { openMcpPanel } from "../lib/mcpPanel.svelte";
  import { type Section, tripPath } from "../lib/router.svelte";
  import { toast } from "../lib/toast.svelte";
  import { schedule, sortStops } from "../lib/stops";
  import { TripStore } from "../lib/tripStore.svelte";
  import type { Trip, TripDraft } from "../lib/types";
  import ExpensesView from "./ExpensesView.svelte";
  import ChecklistView from "./ChecklistView.svelte";
  import FamilyView from "./FamilyView.svelte";
  import OverviewView from "./OverviewView.svelte";
  import PlacesView from "./PlacesView.svelte";
  import RouteView from "./RouteView.svelte";

  let { id, section, onStore }: { id: string; section: Section; onStore: (store: TripStore | null) => void } = $props();

  // svelte-ignore state_referenced_locally
  const store = new TripStore(id);
  store.load();
  onMount(() => onStore(store));
  onDestroy(() => { onStore(null); store.destroy(); });

  const TABS: { key: Section; label: string; icon: string }[] = [
    { key: "resumen", label: "Resumen", icon: "dashboard-square-01" },
    { key: "ruta", label: "Ruta", icon: "route-01" },
    { key: "lugares", label: "Lugares y mapa", icon: "maps-location-01" },
    { key: "gastos", label: "Gastos", icon: "wallet-02" },
    { key: "checklist", label: "Checklist y notas", icon: "checkmark-circle-02" },
    { key: "familia", label: "Viajeros", icon: "user-group" },
  ];

  let editing = $state(false);
  let sharing = $state(false);
  let busy = $state(false);
  let confirmingDelete = $state(false);
  let deleting = $state(false);
  let deleteConfirmation = $state("");
  const canDelete = $derived(deleteConfirmation === "SI ELIMINAR");
  let duplicating = $state(false);
  let copying = $state(false);
  let copyName = $state("");
  function closeDuplicate() { if (!copying) duplicating = false; }
  async function duplicateTrip(event: SubmitEvent) {
    event.preventDefault();
    if (!trip || copying || !copyName.trim()) return;
    copying = true;
    try {
      const copy = await pb.send<Trip>(`/api/vacaciones/trips/${trip.id}/duplicate`, {
        method: "POST", body: { name: copyName.trim() },
      });
      duplicating = false;
      editing = false;
      toast.ok("Viaje duplicado.");
      location.hash = tripPath(copy.id, section);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      copying = false;
    }
  }
  function focusCancel(node: HTMLButtonElement) { node.focus(); }
  function openDelete() { deleteConfirmation = ""; confirmingDelete = true; }
  function closeDelete() { if (!deleting) { confirmingDelete = false; deleteConfirmation = ""; } }

  const trip = $derived(store.trip);
  const cover = $derived(COVERS[trip?.cover || "mar"]);
  const route = $derived(sortStops(store.stops));
  const legs = $derived(schedule(store.stops));
  /** Ruta y Lugares traen su propio mapa interactivo; el resto, este de fondo. */
  const ownMap = $derived(section === "ruta" || section === "lugares");
  /** Recién creado para la IA: aún no tiene ciudades, lugares ni viajeros. */
  const empty = $derived(!store.loading && !store.stops.length && !store.places.length && !store.travelers.length);
  const clock = $derived(trip ? countdown(trip.start_date, trip.end_date) : null);

  async function save(draft: TripDraft) {
    busy = true;
    try {
      await store.updateTrip(draft.trip);
      await store.syncEndDate();
      toast.ok("Viaje actualizado.");
      editing = false;
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      busy = false;
    }
  }

  async function removeTrip() {
    if (!trip || deleting || !confirmingDelete || !canDelete) return;
    deleting = true;
    try {
      await pb.collection("trips").delete(trip.id);
      confirmingDelete = false;
      editing = false;
      toast.info("Viaje borrado.");
      location.hash = "#/";
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      deleting = false;
    }
  }
</script>

{#if store.loading && !trip}
  <div class="state"><span class="loader"></span></div>
{:else if !trip}
  <div class="state">
    <Icon name="compass-01" size={40} />
    <h2>No encontramos este viaje</h2>
    <p class="muted">{store.error || "Es posible que el viaje se haya borrado."}</p>
    <a class="btn" href="#/">Volver a los viajes</a>
  </div>
{:else}
  {#if !ownMap}
    <div class="stage" aria-hidden="true">
      <TripMap
        places={store.places}
        {legs}
        center={trip.lat || trip.lng ? { lat: trip.lat, lng: trip.lng } : null}
        interactive={false}
        controls={false}
        inset={{ top: 80, right: 80, bottom: 80, left: 80 }}
      />
    </div>
    <div class="stage-veil backdrop"></div>
  {/if}

  <div class="trip" class:full={ownMap}>
    <header class="head">
      <div class="info">
        <nav class="crumbs" aria-label="Ruta de navegación"><a href="#/">Viajes</a><span>/</span><span>{trip.destination || "Viaje"}</span></nav>
        <h1>{trip.name}</h1>
        <p class="meta">
          {#if route.length || trip.origin}
            <span class="route">
              {#if trip.origin}<span class="origin">Desde {trip.origin}</span>{#if route.length}<Icon name="arrow-right-02" class="arrow" />{/if}{/if}
              {#each route as s, i (s.id)}{#if i}<Icon name="arrow-right-02" class="arrow" />{/if}{s.name}{/each}
            </span>
            <span class="sep"></span>
          {/if}
          <span>{dateRange(trip.start_date, trip.end_date)}</span>
          {#if tripLength(trip.start_date, trip.end_date)}
            <span class="sep"></span><span>{tripLength(trip.start_date, trip.end_date)} días</span>
          {/if}
        </p>
      </div>

      <nav class="tabs glass" aria-label="Secciones del viaje">
        {#each TABS as t (t.key)}
          <a href={tripPath(id, t.key)} class="tab" aria-current={section === t.key ? "page" : undefined}>
            <span>{t.label}</span>
          </a>
        {/each}
      </nav>

      <div class="side">
        {#if clock}<span class="tag" style="--c: {clock.tone === 'now' ? 'var(--leaf)' : clock.tone === 'soon' ? 'var(--lime)' : 'var(--ink-muted)'}">{clock.label}</span>{/if}
        <div class="faces">
          {#each store.travelers as t (t.id)}<Avatar traveler={t} size={30} ring />{/each}
        </div>
        <button class="btn icon round" aria-label="Compartir en solo lectura" title="Compartir" onclick={() => (sharing = true)}>
          <Icon name="share-08" />
        </button>
        <button class="btn icon round" aria-label="Ajustes del viaje" title="Ajustes" onclick={() => (editing = true)}>
          <Icon name="settings-02" />
        </button>
      </div>
    </header>

    <div class="content">
      {#if empty && section === "resumen"}
        <div class="ai-empty card">
          <Icon name="ai-magic" size={22} />
          <div>
            <strong>Este viaje está vacío</strong>
            <p class="muted">Conecte un agente IA por MCP para que proponga la ruta, los lugares, los gastos y el checklist. Los cambios aparecen aquí a medida que los guarda.</p>
          </div>
          <button class="btn primary sm" onclick={() => openMcpPanel(trip)}>Conectar agente IA</button>
        </div>
      {/if}
      {#if section === "ruta"}
        <RouteView {store} />
      {:else if section === "lugares"}
        <PlacesView {store} />
      {:else if section === "gastos"}
        <ExpensesView {store} />
      {:else if section === "checklist"}
        <ChecklistView {store} />
      {:else if section === "familia"}
        <FamilyView {store} />
      {:else}
        <OverviewView {store} />
      {/if}
    </div>
  </div>

  <Modal open={editing && !confirmingDelete && !duplicating} onClose={() => (editing = false)} title="Ajustes del viaje" eyebrow={trip.name} width="38rem">
    <div>
      <div class="duplicate-action">
        <button class="btn" onclick={() => { copyName = `${trip.name.slice(0, 111)} (copia)`; duplicating = true; }}><Icon name="copy-01" /> Duplicar viaje</button>
        <p class="muted">Crea una copia completa con otro nombre.</p>
      </div>
      <TripForm initial={trip} hasStops={store.stops.length > 0} {busy} onSubmit={save} onCancel={() => (editing = false)} onDelete={openDelete} />
    </div>
  </Modal>
  <Modal open={sharing} onClose={() => (sharing = false)} title="Compartir viaje" eyebrow={trip.name} width="32rem">
    <ShareSettings tripId={id} />
  </Modal>
  <Modal open={duplicating} onClose={closeDuplicate} title="Duplicar viaje" eyebrow={trip.name} width="30rem">
    <form class="duplicate-form" onsubmit={duplicateTrip}>
      <label class="field">
        <span>Nombre del nuevo viaje</span>
        <input class="input" bind:value={copyName} maxlength="120" required disabled={copying} />
      </label>
      <p class="delete-message">Se copiarán la ruta, los lugares, los gastos, el checklist, las notas y los viajeros con sus avatares y fotos. Se conservarán las fechas y los estados actuales.</p>
      <div class="duplicate-buttons">
        <button type="button" class="btn ghost" disabled={copying} onclick={closeDuplicate}>Cancelar</button>
        <button type="submit" class="btn primary" disabled={copying || !copyName.trim()}>{copying ? "Duplicando…" : "Duplicar viaje"}</button>
      </div>
    </form>
  </Modal>
  <Modal open={confirmingDelete} onClose={closeDelete} title="¿Borrar este viaje?" eyebrow={trip.name} width="30rem">
    <p class="delete-message">Se eliminarán el viaje, la ruta, los lugares, los gastos, el checklist y los viajeros.</p>
    <p class="delete-warning">Esta acción no se puede deshacer.</p>
    <label class="field delete-confirmation">
      <span>Escribe <strong>SI ELIMINAR</strong> para confirmar.</span>
      <input class="input" bind:value={deleteConfirmation} disabled={deleting} autocomplete="off" spellcheck={false} aria-describedby="delete-confirmation-help" />
      <small id="delete-confirmation-help" class="muted">Respeta las mayúsculas y el espacio.</small>
    </label>
    {#snippet footer()}
      <button class="btn ghost" disabled={deleting} onclick={closeDelete} use:focusCancel>Cancelar</button>
      <button class="btn danger" disabled={deleting || !canDelete} onclick={removeTrip}><Icon name="delete-02" /> {deleting ? "Borrando…" : "Borrar viaje"}</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .duplicate-action { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--line); }
  .duplicate-action p { font-size: .8125rem; }
  .duplicate-form { display: flex; flex-direction: column; gap: 1rem; }
  .duplicate-buttons { display: flex; justify-content: flex-end; gap: .5rem; padding-top: .5rem; }


  .delete-message { color: var(--ink-soft); line-height: 1.6; }
  .delete-warning { margin-top: .75rem; font-size: .8125rem; font-weight: 600; color: var(--ink); }
  .delete-confirmation { margin-top: 1.25rem; }
  .trip {
    position: relative;
    z-index: 2;
    max-width: 92rem;
    margin: 0 auto;
    padding: 0 clamp(1rem, 2.5vw, 2rem) 3rem;

    /* Con el mapa interactivo detrás, solo atrapan el puntero los paneles. */
    /* Ruta y Lugares ocupan exactamente el alto que queda: sin scroll de página. */
    &.full {
      display: flex;
      flex-direction: column;
      height: calc(100dvh - var(--header-h));
      padding-bottom: clamp(1rem, 2vw, 1.5rem);
      pointer-events: none;

      & .content {
        flex: 1;
        min-height: 0;
      }

      & .head > * {
        pointer-events: auto;
      }
    }
  }

  /* El mapa de fondo, a media luz: se funde con el lienzo y no compite con las tarjetas. */
  .stage {
    opacity: 0.6;
  }

  .backdrop {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background:
      linear-gradient(180deg, color-mix(in oklch, var(--canvas) 80%, transparent) 0%, color-mix(in oklch, var(--canvas) 35%, transparent) 30%, color-mix(in oklch, var(--canvas) 55%, transparent) 100%);
  }


  .head {
    position: relative;
    z-index: 5;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1.25rem;
    padding: 0 0 1.25rem;
  }

  .info {
    min-width: 0;

    & h1 {
      font-size: clamp(1.5rem, 2.6vw, 2.125rem);
      font-weight: 500;
      letter-spacing: -0.02em;
    }
  }

  .crumbs {
    display: flex;
    gap: 0.375rem;
    margin-bottom: 0.125rem;
    font-size: 0.6875rem;
    color: var(--ink-muted);

    & a {
      color: inherit;
      text-decoration: none;
      &:hover {
        color: var(--ink);
      }
    }
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    color: var(--ink-soft);

    & .route {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      color: var(--ink);
    }
    & :global(.arrow) {
      color: var(--ink-muted);
    }
    & .origin {
      color: var(--ink-muted);
    }
    & .sep {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--ink-muted);
    }
  }

  .side {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .side .tag {
    background: var(--glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .faces {
    display: flex;
    & :global(.avatar + .avatar) {
      margin-left: -0.4rem;
    }
  }

  /* Las secciones, como «Explore · Plan · History». */
  .tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.3rem;
    border-radius: var(--pill);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    height: 2.375rem;
    padding: 0 1.125rem;
    border-radius: var(--pill);
    font-family: var(--font-display);
    font-size: 0.875rem;
    font-weight: 450;
    color: var(--ink-soft);
    text-decoration: none;
    white-space: nowrap;
    transition:
      background 0.2s,
      color 0.2s;

    &:hover {
      background: var(--hover);
      color: var(--ink);
    }
    &[aria-current="page"] {
      background: var(--pill-on);
      color: var(--pill-on-text);
    }
  }

  /*
   * `backwards` y no `both`: si la opacidad animada queda aplicada al terminar,
   * el contenido aísla su fondo y el desenfoque de las tarjetas deja de ver el
   * mapa. Tampoco va un transform: encerraría el mapa fijo de las secciones.
   */
  .content {
    animation: fade-in 0.35s ease backwards;
  }

  .ai-empty {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 1rem 1.25rem;

    & > div {
      flex: 1;
    }
    & p {
      margin-top: 0.25rem;
      font-size: 0.8125rem;
      line-height: 1.5;
    }
  }

  @media (max-width: 34rem) {
    .ai-empty {
      flex-wrap: wrap;
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 60dvh;
    text-align: center;
  }

  .loader {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: 3px solid var(--line);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }


  @media (max-width: 72rem) {
    .head {
      grid-template-columns: 1fr auto;
    }
    .tabs {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: start;
      max-width: 100%;
    }
  }

  @media (max-width: 60rem) {
    .trip.full {
      height: auto;
    }
  }

  @media (max-width: 40rem) {
    .head {
      grid-template-columns: 1fr;
    }
    .side {
      justify-content: flex-start;
      flex-wrap: wrap;
    }
  }
</style>
