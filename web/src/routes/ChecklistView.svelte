<script lang="ts">
  import { onDestroy } from "svelte";
  import { flip } from "svelte/animate";
  import Avatar from "../components/Avatar.svelte";
  import Icon from "../components/Icon.svelte";
  import { errorText } from "../lib/pb";
  import { toast } from "../lib/toast.svelte";
  import type { TripStore } from "../lib/tripStore.svelte";
  import type { ChecklistItem, Traveler } from "../lib/types";

  let { store }: { store: TripStore } = $props();

  let title = $state("");
  let kind = $state<"group" | "individual">("group");
  let assignees = $state<string[]>([]);
  let busy = $state(false);
  let editing = $state<string | null>(null);
  let editTitle = $state("");
  let titleInput = $state<HTMLInputElement>();

  // svelte-ignore state_referenced_locally
  let notes = $state(store.trip?.notes ?? "");
  let saved = $state<"" | "saving" | "saved">("");
  let notesTimer: ReturnType<typeof setTimeout> | undefined;
  let notesDirty = false;

  async function saveNotes() {
    clearTimeout(notesTimer);
    if (!notesDirty) return;
    notesDirty = false;
    try {
      await store.updateTrip({ notes });
      saved = "saved";
    } catch (err) {
      saved = "";
      toast.error(errorText(err));
    }
  }

  function onNotes() {
    saved = "saving";
    notesDirty = true;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(saveNotes, 800);
  }

  // Si se cambia de sección antes de que pase la espera, lo escrito se guarda igual.
  onDestroy(saveNotes);

  const assigned = (item: ChecklistItem): Traveler[] =>
    store.travelers.filter((traveler) => item.assign_all || item.assignees?.includes(traveler.id));
  const checkedCount = (item: ChecklistItem) => assigned(item).filter((person) => item.checked_by?.includes(person.id)).length;
  const isDone = (item: ChecklistItem) => {
    if (item.kind === "group") return item.done;
    const people = assigned(item);
    return people.length > 0 && checkedCount(item) === people.length;
  };

  // Lo pendiente arriba: lo terminado baja al final de su lista.
  const pendingFirst = (items: ChecklistItem[]) => [...items].sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
  const groups = $derived(pendingFirst(store.checklist.filter((item) => item.kind === "group")));
  const individuals = $derived(pendingFirst(store.checklist.filter((item) => item.kind === "individual")));

  const completed = $derived(groups.filter((item) => item.done).length + individuals.reduce((sum, item) => sum + checkedCount(item), 0));
  const total = $derived(groups.length + individuals.reduce((sum, item) => sum + assigned(item).length, 0));
  const percent = $derived(total ? Math.round((completed / total) * 100) : 0);

  // Sin nadie elegido, la tarea es para todos los viajeros.
  function toggleAssignee(id: string) {
    assignees = assignees.includes(id) ? assignees.filter((value) => value !== id) : [...assignees, id];
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    const name = title.trim();
    if (!name || busy) return;
    if (kind === "individual" && !store.travelers.length) {
      toast.error("Agregue viajeros en la sección «Viajeros» antes de crear una tarea individual.");
      return;
    }
    const all = kind === "individual" && !assignees.length;
    busy = true;
    try {
      await store.saveChecklist({
        title: name,
        kind,
        done: false,
        assign_all: all,
        assignees: kind === "individual" && !all ? assignees : [],
        checked_by: [],
      });
      title = "";
      titleInput?.focus();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      busy = false;
    }
  }

  async function toggleGroup(item: ChecklistItem) {
    try {
      await store.saveChecklist({ done: !item.done }, item.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function togglePerson(item: ChecklistItem, travelerId: string) {
    try {
      await store.checkForTraveler(item.id, travelerId, !item.checked_by?.includes(travelerId));
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function startEdit(item: ChecklistItem) {
    editing = item.id;
    editTitle = item.title;
  }

  async function saveTitle(item: ChecklistItem) {
    if (editing !== item.id) return;
    const value = editTitle.trim();
    editing = null;
    if (!value || value === item.title) return;
    try {
      await store.saveChecklist({ title: value }, item.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function onEditKey(event: KeyboardEvent, item: ChecklistItem) {
    if (event.key === "Enter") {
      event.preventDefault();
      saveTitle(item);
    } else if (event.key === "Escape") {
      editing = null;
    }
  }

  async function remove(item: ChecklistItem) {
    if (!confirm(`¿Borrar «${item.title}» del checklist? No se puede deshacer.`)) return;
    try {
      await store.deleteChecklist(item.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }
</script>

{#snippet taskTitle(item: ChecklistItem)}
  {#if editing === item.id}
    <input
      class="input edit"
      bind:value={editTitle}
      maxlength="180"
      aria-label="Nombre de la tarea"
      use:focusOnMount
      onkeydown={(event) => onEditKey(event, item)}
      onblur={() => saveTitle(item)}
    />
  {:else}
    <strong ondblclick={() => startEdit(item)}>{item.title}</strong>
  {/if}
{/snippet}

{#snippet actions(item: ChecklistItem)}
  <div class="actions">
    <button class="btn ghost icon sm" title="Cambiar el nombre" aria-label="Cambiar el nombre de {item.title}" onclick={() => startEdit(item)}>
      <Icon name="pencil-edit-02" />
    </button>
    <button class="btn ghost icon sm danger" title="Borrar" aria-label="Borrar {item.title}" onclick={() => remove(item)}>
      <Icon name="delete-02" />
    </button>
  </div>
{/snippet}

<div class="checklist">
  <header class="intro">
    <div>
      <h2>Checklist del viaje</h2>
      <p class="muted">Las tareas grupales se marcan una sola vez. En las individuales, cada viajero marca la suya.</p>
    </div>
    {#if total}
      <div class="progress" class:complete={completed === total}>
        <span><strong>{completed}</strong> de {total} completadas</span>
        <div class="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del checklist">
          <i style="width: {percent}%"></i>
        </div>
      </div>
    {/if}
  </header>

  <form class="card creator" onsubmit={add}>
    <div class="line">
      <div class="seg" role="radiogroup" aria-label="Tipo de tarea">
        <label><input type="radio" bind:group={kind} value="group" class="sr-only" /> <Icon name="user-group" /> Grupal</label>
        <label><input type="radio" bind:group={kind} value="individual" class="sr-only" /> <Icon name="user" /> Individual</label>
      </div>
      <input
        class="input grow"
        bind:this={titleInput}
        bind:value={title}
        maxlength="180"
        aria-label="Nueva tarea"
        placeholder={kind === "group" ? "Nueva tarea grupal: reservar el tren a París…" : "Nueva tarea para cada viajero: revisar el pasaporte…"}
      />
      <button class="btn primary" type="submit" disabled={busy || !title.trim()}>
        <Icon name="add-01" />
        {busy ? "Agregando…" : "Agregar"}
      </button>
    </div>
    {#if kind === "individual"}
      <div class="for">
        <span class="muted">Para</span>
        {#if store.travelers.length}
          <button type="button" class="chip" aria-pressed={!assignees.length} onclick={() => (assignees = [])}>Todos</button>
          {#each store.travelers as person (person.id)}
            <button type="button" class="chip person" aria-pressed={assignees.includes(person.id)} onclick={() => toggleAssignee(person.id)}>
              <Avatar traveler={person} size={20} />
              {person.name}
            </button>
          {/each}
        {:else}
          <span class="muted">Agregue viajeros en la sección «Viajeros».</span>
        {/if}
      </div>
    {/if}
  </form>

  <div class="columns">
    <section class="card list">
      <header>
        <h3><Icon name="user-group" /> Grupales</h3>
        {#if groups.length}<span class="badge">{groups.filter((item) => item.done).length}/{groups.length}</span>{/if}
      </header>
      {#if !groups.length}
        <p class="muted empty">Sin tareas grupales. Úselas para lo que se hace una vez por todos, como comprar el seguro de viaje.</p>
      {/if}
      <ul>
        {#each groups as item (item.id)}
          <li class:done={item.done} animate:flip={{ duration: 250 }}>
            <label class="check">
              <input type="checkbox" class="sr-only" checked={item.done} onchange={() => toggleGroup(item)} aria-label={item.done ? `Marcar «${item.title}» como pendiente` : `Completar «${item.title}»`} />
              <span class="box" aria-hidden="true"><Icon name="tick-02" /></span>
            </label>
            <div class="body">{@render taskTitle(item)}</div>
            {@render actions(item)}
          </li>
        {/each}
      </ul>
    </section>

    <section class="card list">
      <header>
        <h3><Icon name="user" /> Individuales</h3>
        {#if individuals.length}<span class="badge">{individuals.filter(isDone).length}/{individuals.length}</span>{/if}
      </header>
      {#if !individuals.length}
        <p class="muted empty">Sin tareas individuales. Úselas para lo que cada viajero hace por su cuenta, como renovar el pasaporte.</p>
      {/if}
      <ul>
        {#each individuals as item (item.id)}
          {@const people = assigned(item)}
          {@const count = checkedCount(item)}
          <li class:done={isDone(item)} animate:flip={{ duration: 250 }}>
            <div class="body">
              <div class="title-row">
                {@render taskTitle(item)}
                <small class="muted">{count} de {people.length}</small>
              </div>
              {#if people.length}
                <div class="people">
                  {#each people as person (person.id)}
                    {@const on = item.checked_by?.includes(person.id) ?? false}
                    <button
                      type="button"
                      class="person"
                      class:on
                      aria-pressed={on}
                      title={on ? `${person.name} ya lo hizo` : `Marcar que ${person.name} lo hizo`}
                      onclick={() => togglePerson(item, person.id)}
                    >
                      <span class="avatar-wrap">
                        <Avatar traveler={person} size={22} />
                        {#if on}<span class="tick"><Icon name="tick-02" /></span>{/if}
                      </span>
                      {person.name}
                    </button>
                  {/each}
                </div>
              {:else}
                <small class="muted">Nadie tiene asignada esta tarea.</small>
              {/if}
            </div>
            {@render actions(item)}
          </li>
        {/each}
      </ul>
    </section>
  </div>

  <section class="card notes">
    <header>
      <h3><Icon name="note-edit" /> Notas del viaje</h3>
      <span class="muted save-state" role="status">
        {#if saved === "saving"}Guardando…{:else if saved === "saved"}<Icon name="tick-02" /> Guardado{/if}
      </span>
    </header>
    <textarea
      class="textarea notes-paper"
      bind:value={notes}
      oninput={onNotes}
      onblur={saveNotes}
      placeholder="Documentos, reservas, números de vuelo, contactos de emergencia…"
      aria-label="Notas del viaje"
    ></textarea>
  </section>
</div>

<style>
  .checklist {
    display: grid;
    gap: 1.25rem;
    max-width: 78rem;
    margin: 0 auto;
  }

  .intro {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 1.5rem;

    & p {
      margin: 0.25rem 0 0;
    }
  }
  h2 {
    font-size: 1.75rem;
    font-weight: 550;
  }

  .progress {
    display: grid;
    gap: 0.4rem;
    width: min(16rem, 100%);
    flex-shrink: 0;
    font-size: 0.8125rem;
    color: var(--ink-soft);
    text-align: right;

    & strong {
      color: var(--ink);
      font-weight: 650;
    }
    & .bar {
      height: 0.375rem;
      border-radius: var(--pill);
      background: var(--line-strong);
      overflow: hidden;
    }
    & i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
      transition: width 0.4s var(--ease);
    }
    &.complete i {
      background: var(--leaf);
    }
  }

  .creator {
    display: grid;
    gap: 0.75rem;
    padding: 0.875rem;
  }
  .line {
    display: flex;
    gap: 0.625rem;
    align-items: center;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    flex-shrink: 0;
    padding: 0.25rem;
    height: 2.625rem;
    border-radius: var(--r);
    background: var(--paper-deep);

    & label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0 0.75rem;
      border-radius: var(--r-sm);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--ink-muted);
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;
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
  .for {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;

    & .chip.person {
      padding-left: 0.25rem;
    }
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .list {
    padding: 1.25rem;

    & header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;

    & :global(i) {
      color: var(--ink-muted);
    }
  }
  .badge {
    padding: 0.125rem 0.5rem;
    border-radius: var(--pill);
    background: var(--hover);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .empty {
    padding: 0.75rem 0 0.25rem;
    font-size: 0.875rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    margin: 0 -0.5rem;
    padding: 0.75rem 0.5rem;
    border-radius: var(--r);
    transition: background 0.15s;

    & + li {
      box-shadow: 0 -1px 0 var(--line);
    }
    &:hover {
      background: var(--hover);
    }
    &.done strong {
      text-decoration: line-through;
      color: var(--ink-muted);
    }
  }

  .check {
    display: grid;
    padding-top: 0.0625rem;
    cursor: pointer;
  }
  .box {
    display: grid;
    place-items: center;
    width: 1.375rem;
    height: 1.375rem;
    border: 1.5px solid var(--line-strong);
    border-radius: 50%;
    color: transparent;
    font-size: 0.875rem;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }
  .check:hover .box {
    border-color: var(--accent);
  }
  .check:has(input:checked) .box {
    background: var(--leaf);
    border-color: var(--leaf);
    color: white;
  }
  .check:has(input:focus-visible) .box {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .body {
    display: grid;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    padding-top: 0.125rem;

    & strong {
      font-weight: 550;
      overflow-wrap: anywhere;
      cursor: text;
    }
  }
  .title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;

    & small {
      flex-shrink: 0;
      font-size: 0.75rem;
    }
  }
  .edit {
    height: 2rem;
    margin: -0.3rem 0;
  }

  .people {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .person {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.1875rem 0.625rem 0.1875rem 0.1875rem;
    border: 1px solid var(--line);
    border-radius: var(--pill);
    background: var(--glass-soft);
    font-size: 0.8125rem;
    color: var(--ink-soft);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;

    &:hover {
      border-color: var(--line-strong);
      color: var(--ink);
    }
    &.on {
      background: var(--leaf-soft);
      border-color: color-mix(in oklch, var(--leaf) 45%, transparent);
      color: var(--ink);
    }
  }
  .avatar-wrap {
    position: relative;
    display: grid;
  }
  .tick {
    position: absolute;
    right: -0.25rem;
    bottom: -0.25rem;
    display: grid;
    place-items: center;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 50%;
    background: var(--leaf);
    color: white;
    font-size: 0.625rem;
    box-shadow: 0 0 0 1.5px var(--glass-strong);
  }

  /* Los botones de editar y borrar aparecen al pasar por la tarea, para que la lista se lea limpia. */
  .actions {
    display: flex;
    gap: 0.125rem;
    opacity: 0;
    transition: opacity 0.15s;

    & .danger:hover {
      color: var(--danger);
    }
  }
  li:hover .actions,
  li:focus-within .actions {
    opacity: 1;
  }
  @media (hover: none) {
    .actions {
      opacity: 1;
    }
  }

  .notes {
    padding: 1.25rem;

    & header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
  }
  .save-state {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
  }
  .notes-paper {
    min-height: 14rem;
    margin-top: 0.75rem;
    line-height: 1.6;
    field-sizing: content;
  }

  @media (max-width: 55rem) {
    .columns {
      grid-template-columns: 1fr;
    }
    .intro {
      flex-direction: column;
      align-items: stretch;
    }
    .progress {
      width: 100%;
      text-align: left;
    }
  }
  @media (max-width: 40rem) {
    .line {
      flex-wrap: wrap;
    }
    .seg,
    .grow {
      flex: 1 1 100%;
    }
  }
</style>
