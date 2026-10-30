<!--
  Los documentos del viaje: seguros, tiquetes, entradas, reservas… Cada uno es
  de un viajero o de todo el grupo. Los archivos son protegidos: se abren con un
  token temporal y no salen en el enlace de solo lectura.
-->
<script lang="ts">
  import { DOCUMENT_KINDS } from "../lib/catalog";
  import { shortDate, toDate } from "../lib/format";
  import { errorText } from "../lib/pb";
  import { toast } from "../lib/toast.svelte";
  import type { TripStore } from "../lib/tripStore.svelte";
  import type { DocumentKind, TripDocument } from "../lib/types";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  let { store }: { store: TripStore } = $props();

  const GROUP = "__grupo";
  const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
  const MAX = 20 * 1024 * 1024;

  /** "" = todos; GROUP = solo los del grupo; o el id de un viajero. */
  let owner = $state("");
  let dragging = $state(false);

  // El formulario de subir o editar.
  let form = $state<{ id?: string; current?: string } | null>(null);
  let file = $state<File | null>(null);
  let title = $state("");
  let kind = $state<DocumentKind>("otro");
  let traveler = $state(GROUP);
  let notes = $state("");
  let saving = $state(false);
  let picker: HTMLInputElement | undefined = $state();

  const travelerOf = (id: string) => store.travelers.find((t) => t.id === id);
  // Un documento de un viajero que ya no está cuenta como del grupo.
  const ownerOf = (d: TripDocument) => (d.traveler && travelerOf(d.traveler) ? d.traveler : GROUP);
  const count = (id: string) => store.documents.filter((d) => ownerOf(d) === id).length;
  const list = $derived(
    store.documents
      .filter((d) => !owner || ownerOf(d) === owner)
      .toSorted((a, b) => (ownerOf(a) === GROUP ? 0 : 1) - (ownerOf(b) === GROUP ? 0 : 1) || a.title.localeCompare(b.title, "es")),
  );

  const extension = (name: string) => (name.split(".").pop() ?? "").toUpperCase();
  const isPdf = (name: string) => /\.pdf$/i.test(name);
  const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

  /** Un primer nombre y tipo a partir del nombre del archivo; se pueden cambiar. */
  function guess(name: string) {
    const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    const n = base.toLowerCase();
    const k: DocumentKind = /segur|insur|poliz|asistencia|assist/.test(n) ? "seguro"
      : /tiquet|ticket|boarding|pase de abordar|vuelo|flight|tren|train|bus/.test(n) ? "tiquete"
      : /entrada|admission|entry|museo|museum|tour|concierto/.test(n) ? "entrada"
      : /reserv|booking|hotel|airbnb|hostal|confirmaci/.test(n) ? "reserva"
      : /pasaport|passport|visa|c[eé]dula|identidad|\bid\b/.test(n) ? "identidad"
      : "otro";
    return { title: base.charAt(0).toUpperCase() + base.slice(1), kind: k };
  }

  function valid(f: File) {
    const ok = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(f.name);
    if (!ok) toast.error("Sube un PDF o una imagen (JPG, PNG, WebP o HEIC).");
    else if (f.size > MAX) toast.error("El archivo debe pesar menos de 20 MB.");
    return ok && f.size <= MAX;
  }

  function choose(f: File) {
    if (!valid(f)) return;
    file = f;
    if (!form?.id || !title.trim()) {
      const g = guess(f.name);
      if (!form?.id) kind = g.kind;
      if (!title.trim()) title = g.title;
    }
  }

  function openNew(f?: File) {
    form = {};
    file = null;
    title = "";
    kind = "otro";
    traveler = owner && owner !== GROUP ? owner : GROUP;
    notes = "";
    if (f) choose(f);
  }

  function openEdit(d: TripDocument) {
    form = { id: d.id, current: d.file };
    file = null;
    title = d.title;
    kind = (d.kind || "otro") as DocumentKind;
    traveler = ownerOf(d);
    notes = d.notes ?? "";
  }

  function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = "";
    if (f) choose(f);
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    if (form) choose(f);
    else openNew(f);
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!form || (!form.id && !file)) return;
    saving = true;
    try {
      await store.saveDocument(
        { title: title.trim(), kind, traveler: traveler === GROUP ? "" : traveler, notes: notes.trim(), ...(file ? { file } : {}) },
        form.id,
      );
      toast.ok(form.id ? "Documento actualizado." : "Documento guardado.");
      form = null;
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!form?.id || !confirm(`¿Borrar «${title}»? El archivo se elimina para todos.`)) return;
    try {
      await store.deleteDocument(form.id);
      toast.info("Documento borrado.");
      form = null;
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  // La pestaña se abre al instante (antes del token) para que el navegador no la bloquee.
  async function open(d: TripDocument) {
    const tab = window.open("", "_blank");
    try {
      const url = await store.documentUrl(d);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      tab?.close();
      toast.error(errorText(err));
    }
  }

  async function download(d: TripDocument) {
    try {
      const a = document.createElement("a");
      a.href = await store.documentUrl(d, true);
      a.rel = "noopener";
      a.click();
    } catch (err) {
      toast.error(errorText(err));
    }
  }
</script>

<section
  class="docs"
  class:dragging
  aria-labelledby="docs-title"
  ondragover={(e) => { if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); dragging = true; } }}
  ondragleave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) dragging = false; }}
  ondrop={drop}
>
  <header class="head">
    <div>
      <h3 id="docs-title">Documentos {#if store.documents.length}<span class="count">{store.documents.length}</span>{/if}</h3>
      <p class="muted">Seguros, tiquetes, entradas y reservas a la mano. Solo los ve la familia; no salen en el enlace de solo lectura.</p>
    </div>
    <button class="btn primary sm" onclick={() => openNew()}><Icon name="upload-01" /> Subir documento</button>
  </header>

  {#if store.documents.length}
    <div class="owners" role="group" aria-label="Filtrar por dueño">
      <button type="button" class="chip" aria-pressed={owner === ""} onclick={() => (owner = "")}>Todos <span class="n">{store.documents.length}</span></button>
      <button type="button" class="chip" aria-pressed={owner === GROUP} onclick={() => (owner = owner === GROUP ? "" : GROUP)}>
        <Icon name="user-group" /> Del grupo <span class="n">{count(GROUP)}</span>
      </button>
      {#each store.travelers as t (t.id)}
        <button type="button" class="chip person" aria-pressed={owner === t.id} onclick={() => (owner = owner === t.id ? "" : t.id)}>
          <Avatar traveler={t} size={20} /> {t.name} <span class="n">{count(t.id)}</span>
        </button>
      {/each}
    </div>

    {#if list.length}
      <ul class="list card">
        {#each list as d (d.id)}
          {@const k = DOCUMENT_KINDS[(d.kind || "otro") as DocumentKind]}
          {@const who = ownerOf(d) === GROUP ? null : travelerOf(d.traveler)}
          <li>
            <span class="tile" style="--c: {k.color}">
              <Icon name={k.icon} size={20} />
              <small>{isPdf(d.file) ? "PDF" : extension(d.file)}</small>
            </span>
            <button type="button" class="what" onclick={() => open(d)} title="Abrir {d.title}">
              <strong>{d.title}</strong>
              <span class="meta">
                <span class="kind" style="--c: {k.color}">{k.label}</span>
                <span class="muted">Subido el {shortDate(toDate(d.created))}</span>
              </span>
              {#if d.notes}<span class="note">{d.notes}</span>{/if}
            </button>
            <span class="owner" class:group={!who}>
              {#if who}<Avatar traveler={who} size={22} /> {who.name}{:else}<Icon name="user-group" /> Todo el grupo{/if}
            </span>
            <div class="actions">
              <button type="button" class="btn icon sm ghost" aria-label="Abrir {d.title}" title="Abrir" onclick={() => open(d)}><Icon name="square-arrow-up-right" /></button>
              <button type="button" class="btn icon sm ghost" aria-label="Descargar {d.title}" title="Descargar" onclick={() => download(d)}><Icon name="download-01" /></button>
              <button type="button" class="btn icon sm ghost" aria-label="Editar {d.title}" title="Editar" onclick={() => openEdit(d)}><Icon name="edit-02" /></button>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted none">{owner === GROUP ? "No hay documentos del grupo." : `${travelerOf(owner)?.name ?? "Este viajero"} todavía no tiene documentos.`}</p>
    {/if}
  {:else}
    <button type="button" class="empty" onclick={() => openNew()}>
      <span class="empty-icon"><Icon name="folder-upload" size={26} /></span>
      <strong>Guarda aquí los documentos del viaje</strong>
      <span class="muted">Arrastra un PDF o una foto, o haz clic para elegirlo. Puedes asignarlo a un viajero o a todo el grupo.</span>
    </button>
  {/if}

  {#if dragging && !form}
    <div class="drop-hint" aria-hidden="true"><Icon name="upload-01" size={22} /> Suelta el archivo para subirlo</div>
  {/if}
</section>

<Modal open={!!form} onClose={() => { if (!saving) form = null; }} title={form?.id ? "Editar documento" : "Subir documento"} eyebrow="Documentos" width="36rem">
  {#if form}
    <form class="doc-form" onsubmit={save}>
      <input bind:this={picker} class="sr-only" type="file" accept={ACCEPT} onchange={picked} tabindex="-1" aria-hidden="true" />
      {#if file || form.current}
        {@const name = file?.name ?? form.current ?? ""}
        <div class="file-chip">
          <span class="tile" style="--c: {DOCUMENT_KINDS[kind].color}"><Icon name={isPdf(name) ? "pdf-01" : "image-01"} size={20} /></span>
          <div class="file-name">
            <strong>{name}</strong>
            <span class="muted">{file ? size(file.size) : "Archivo actual"}</span>
          </div>
          <button type="button" class="btn ghost sm" onclick={() => picker?.click()}>{form.id ? "Reemplazar" : "Cambiar"}</button>
        </div>
      {:else}
        <button
          type="button"
          class="dropzone"
          class:over={dragging}
          onclick={() => picker?.click()}
          ondragover={(e) => { e.preventDefault(); dragging = true; }}
          ondragleave={() => (dragging = false)}
          ondrop={drop}
        >
          <Icon name="upload-01" size={26} />
          <strong>Arrastra el archivo aquí o elígelo</strong>
          <span class="muted">PDF, JPG, PNG, WebP o HEIC · hasta 20 MB</span>
        </button>
      {/if}

      <label class="field">
        <span>Nombre</span>
        <input class="input" bind:value={title} required maxlength="160" placeholder="Seguro de viaje Assist Card" />
      </label>

      <fieldset class="field">
        <span>Tipo</span>
        <div class="kinds">
          {#each Object.entries(DOCUMENT_KINDS) as [key, k] (key)}
            <label class="kind-option" style="--c: {k.color}">
              <input type="radio" name="doc-kind" value={key} bind:group={kind} class="sr-only" />
              <Icon name={k.icon} size={18} />
              <small>{k.label}</small>
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="field">
        <span>¿De quién es?</span>
        <div class="whose">
          <label class="who">
            <input type="radio" name="doc-owner" value={GROUP} bind:group={traveler} class="sr-only" />
            <span class="group-icon"><Icon name="user-group" /></span> Todo el grupo
          </label>
          {#each store.travelers as t (t.id)}
            <label class="who">
              <input type="radio" name="doc-owner" value={t.id} bind:group={traveler} class="sr-only" />
              <Avatar traveler={t} size={24} /> {t.name}
            </label>
          {/each}
        </div>
      </fieldset>

      <label class="field">
        <span>Nota <em class="optional">(opcional)</em></span>
        <textarea class="input" bind:value={notes} rows="2" maxlength="2000" placeholder="Número de póliza, teléfono de asistencia, hora de entrada…"></textarea>
      </label>

      <div class="form-actions">
        {#if form.id}<button type="button" class="btn danger sm" onclick={remove}><Icon name="delete-02" /> Borrar</button>{/if}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" onclick={() => (form = null)} disabled={saving}>Cancelar</button>
        <button type="submit" class="btn primary" disabled={saving || !title.trim() || (!form.id && !file)}>{saving ? "Guardando…" : form.id ? "Guardar cambios" : "Guardar documento"}</button>
      </div>
    </form>
  {/if}
</Modal>

<style>
  .docs {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 2.5rem;
    border-radius: var(--r);

    &.dragging {
      outline: 2px dashed var(--accent);
      outline-offset: 0.5rem;
    }
  }

  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;

    & h3 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.25rem;
      font-size: 1.25rem;
    }
    & p {
      max-width: 40rem;
      font-size: 0.8125rem;
      line-height: 1.5;
    }
  }

  .count,
  .n {
    display: inline-grid;
    place-items: center;
    min-width: 1.375rem;
    height: 1.375rem;
    padding: 0 0.375rem;
    border-radius: var(--pill);
    background: var(--paper-deep);
    color: var(--ink-muted);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .owners {
    display: flex;
    gap: 0.375rem;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 0.125rem;
    &::-webkit-scrollbar {
      display: none;
    }
    & .chip {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
    }
    & .chip.person {
      padding-left: 0.25rem;
    }
    & .chip[aria-pressed="true"] .n {
      background: color-mix(in oklch, currentColor 18%, transparent);
      color: inherit;
    }
  }

  .list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0.25rem;
    list-style: none;

    & li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 0.875rem;
      padding: 0.75rem;
      border-radius: calc(var(--r) * 0.7);
      transition: background 0.15s;
    }
    & li + li {
      border-top: 1px solid var(--line);
    }
    & li:hover {
      background: var(--paper);
    }
  }

  .tile {
    position: relative;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 2.75rem;
    height: 3.25rem;
    border-radius: 0.625rem;
    background: color-mix(in oklch, var(--c) 16%, transparent);
    color: var(--c);

    & small {
      position: absolute;
      bottom: -0.375rem;
      right: -0.375rem;
      padding: 0.0625rem 0.3125rem;
      border-radius: 0.3rem;
      background: var(--ink);
      color: var(--canvas);
      font-size: 0.56rem;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
  }

  .what {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    & strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.9375rem;
      font-weight: 600;
    }
    &:hover strong {
      color: var(--accent-ink);
    }
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.75rem;
  }

  .kind {
    padding: 0.0625rem 0.5rem;
    border-radius: var(--pill);
    background: color-mix(in oklch, var(--c) 16%, transparent);
    color: color-mix(in oklch, var(--c) 80%, var(--ink));
    font-weight: 650;
  }

  .note {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-soft);
    font-size: 0.75rem;
    font-style: italic;
  }

  .owner {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.1875rem 0.75rem 0.1875rem 0.1875rem;
    border: 1px solid var(--line);
    border-radius: var(--pill);
    background: var(--surface);
    font-size: 0.8125rem;
    font-weight: 600;
    white-space: nowrap;

    &.group {
      padding-left: 0.625rem;
      color: var(--ink-soft);
    }
  }

  .actions {
    display: flex;
    gap: 0.125rem;
  }

  .none {
    padding: 1.5rem 0;
    text-align: center;
    font-size: 0.875rem;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.25rem 1.5rem;
    border: 1px dashed var(--line-strong);
    border-radius: var(--r);
    background: var(--glass-strong);
    color: var(--ink);
    font: inherit;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;

    &:hover {
      border-color: var(--accent);
    }
    & .muted {
      max-width: 28rem;
      font-size: 0.8125rem;
      line-height: 1.5;
    }
  }

  .empty-icon {
    display: grid;
    place-items: center;
    width: 3.25rem;
    height: 3.25rem;
    margin-bottom: 0.25rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-ink);
  }

  .drop-hint {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-radius: var(--r);
    background: color-mix(in oklch, var(--canvas) 82%, transparent);
    backdrop-filter: var(--blur);
    color: var(--accent-ink);
    font-weight: 650;
    pointer-events: none;
  }

  /* ——— Formulario ——— */
  .doc-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }

  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 1.75rem 1rem;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--r);
    background: var(--paper);
    color: var(--ink-muted);
    font: inherit;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;

    & strong {
      color: var(--ink);
      font-size: 0.9375rem;
    }
    & .muted {
      font-size: 0.75rem;
    }
    &:hover,
    &.over {
      border-color: var(--accent);
      background: var(--accent-soft);
      color: var(--accent-ink);
    }
  }

  .file-chip {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem;
    border: 1px solid var(--line);
    border-radius: var(--r);
    background: var(--paper);

    & .tile {
      width: 2.5rem;
      height: 2.75rem;
    }
  }

  .file-name {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;

    & strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.875rem;
    }
    & .muted {
      font-size: 0.75rem;
    }
  }

  .kinds {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.375rem;
  }

  .kind-option {
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
      border-color: var(--c);
      color: var(--c);
    }
    &:has(input:checked) {
      border-color: var(--c);
      background: color-mix(in oklch, var(--c) 14%, transparent);
      color: color-mix(in oklch, var(--c) 85%, var(--ink));
    }
    &:has(input:focus-visible) {
      outline: 2px solid var(--accent);
    }
  }

  .whose {
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
    transition: all 0.15s;

    &:has(input:checked) {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--on-accent);
    }
    &:has(input:focus-visible) {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .group-icon {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--paper-deep);
    color: var(--ink-soft);
  }

  .who:has(input:checked) .group-icon {
    background: color-mix(in oklch, var(--on-accent) 22%, transparent);
    color: var(--on-accent);
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

  .form-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.875rem;
    border-top: 1px solid var(--line);
  }

  .spacer {
    flex: 1;
  }

  @media (max-width: 40rem) {
    .list li {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: "tile what actions" "tile owner actions";
      row-gap: 0.5rem;
    }
    .list .tile {
      grid-area: tile;
      align-self: start;
    }
    .what {
      grid-area: what;
    }
    .owner {
      grid-area: owner;
      justify-self: start;
    }
    .actions {
      grid-area: actions;
      flex-direction: column;
    }
    .kinds {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
