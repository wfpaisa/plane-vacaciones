<!--
  Los viajeros del viaje y sus documentos.
-->
<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import Modal from "../components/Modal.svelte";
  import TripDocuments from "../components/TripDocuments.svelte";
  import { SWATCHES } from "../lib/catalog";
  import { AVATAR_GROUPS, avatarsForGroup, genericAvatarFor } from "../lib/genericAvatars";
  import { errorText, pb } from "../lib/pb";
  import { balances } from "../lib/settle";
  import { toast } from "../lib/toast.svelte";
  import type { TripStore } from "../lib/tripStore.svelte";
  import type { Traveler } from "../lib/types";

  let { store }: { store: TripStore } = $props();

  const money = (n: number) => store.money(n);
  const stats = $derived(new Map(balances(store.expenses, store.travelers).map((b) => [b.traveler.id, b])));

  let newName = $state("");
  let portraitTarget = $state<Traveler | null>(null);
  let portraitFile = $state<File | null>(null);
  let sourcePreview = $state("");
  let savingPortrait = $state(false);
  let avatarTarget = $state<Traveler | null>(null);
  let savingAvatar = $state(false);

  function selectPortrait(t: Traveler, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Elija una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 10 MB.");
      return;
    }
    closePreview();
    portraitTarget = t;
    portraitFile = file;
    sourcePreview = URL.createObjectURL(file);
  }

  function closePreview() {
    if (sourcePreview) URL.revokeObjectURL(sourcePreview);
    sourcePreview = "";
    portraitFile = null;
    portraitTarget = null;
  }

  async function savePortrait() {
    if (!portraitTarget || !portraitFile) return;
    savingPortrait = true;
    try {
      await store.saveTraveler({ portrait: portraitFile }, portraitTarget.id);
      toast.ok("Foto guardada.");
      closePreview();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      savingPortrait = false;
    }
  }

  async function removePortrait(t: Traveler) {
    try {
      await store.saveTraveler({ portrait: "" }, t.id);
      toast.info("Foto quitada.");
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function chooseAvatar(variant: string) {
    if (!avatarTarget || savingAvatar) return;
    savingAvatar = true;
    try {
      await store.saveTraveler({ avatar_variant: variant }, avatarTarget.id);
      avatarTarget = null;
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      savingAvatar = false;
    }
  }

  async function add(e: SubmitEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const n = store.travelers.length;
    try {
      await store.saveTraveler({ name, color: SWATCHES[n % SWATCHES.length] });
      newName = "";
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function patch(t: Traveler, data: Partial<Traveler>) {
    try {
      await store.saveTraveler(data, t.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function remove(t: Traveler) {
    if (!confirm(`¿Quitar a ${t.name} del viaje?`)) return;
    try {
      await store.deleteTraveler(t.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  }
</script>

<div class="family">
  <section>
    <h3>Viajeros</h3>
    <div class="grid">
      {#each store.travelers as t, i (t.id)}
        {@const b = stats.get(t.id)}
        <article class="person card rise" style="--c: {t.color}; animation-delay: {i * 50}ms">
          <div class={t.portrait ? "portrait" : "portrait tinted-portrait"}>
            {#if t.portrait}
              <img src={pb.files.getURL(t, t.portrait, { thumb: "320x400" })} alt="Foto de {t.name}" />
            {:else}
              <img src={genericAvatarFor(t).src} alt="Avatar low poly de {t.name}" />
            {/if}
          </div>
          <input
            class="name"
            value={t.name}
            aria-label="Nombre de {t.name}"
            onchange={(e) => patch(t, { name: e.currentTarget.value.trim() || t.name })}
          />
          <div class="photo-actions">
            <label class="btn sm" aria-label="{t.portrait ? 'Cambiar' : 'Agregar'} foto de {t.name}">
              <Icon name="camera-01" /> {t.portrait ? "Cambiar foto" : "Agregar foto"}
              <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onchange={(event) => selectPortrait(t, event)} />
            </label>
            {#if t.portrait}
              <button class="btn ghost sm" onclick={() => removePortrait(t)}>Quitar foto</button>
            {/if}
          </div>
          {#if !t.portrait}
            <button class="btn sm avatar-select" onclick={() => (avatarTarget = t)}>Elegir avatar</button>
          {/if}
          <span class="color-caption">Color de identificación</span>
          <div class="swatches" role="radiogroup" aria-label="Color de identificación de {t.name}">
            {#each SWATCHES as s, j (s)}
              <button
                role="radio"
                aria-checked={t.color === s}
                aria-label="Color {j + 1}"
                style="--s: {s}"
                onclick={() => patch(t, { color: s })}
              ></button>
            {/each}
          </div>
          <dl>
            <div><dt>Ha puesto</dt><dd class="num">{money(b?.paid ?? 0)}</dd></div>
            <div><dt>Le toca</dt><dd class="num">{money(b?.share ?? 0)}</dd></div>
          </dl>
          <button class="btn ghost sm danger remove" onclick={() => remove(t)} aria-label="Quitar a {t.name} del viaje"><Icon name="delete-02" /> Quitar</button>
        </article>
      {/each}

      <form class="person add card" onsubmit={add}>
        <span class="plus"><Icon name="user-add-01" size={20} /></span>
        <label for="new-traveler-name">Nuevo viajero</label>
        <input id="new-traveler-name" class="input" bind:value={newName} placeholder="Nombre" maxlength="80" />
        <button class="btn primary sm" type="submit" disabled={!newName.trim()}>Agregar viajero</button>
      </form>
    </div>
  </section>

  <TripDocuments {store} />
</div>

<Modal open={!!portraitTarget} onClose={closePreview} title="Vista previa de la foto" eyebrow={portraitTarget?.name} width="28rem">
  {#if portraitTarget && sourcePreview}
    <div class="portrait-preview">
      <img src={sourcePreview} alt="Foto seleccionada para {portraitTarget.name}" />
    </div>
    <div class="preview-actions">
      <button class="btn ghost" onclick={closePreview} disabled={savingPortrait}>Cancelar</button>
      <button class="btn primary" onclick={savePortrait} disabled={savingPortrait}>{savingPortrait ? "Guardando…" : "Guardar foto"}</button>
    </div>
  {/if}
</Modal>

<Modal open={!!avatarTarget} onClose={() => { if (!savingAvatar) avatarTarget = null; }} title="Elegir avatar" eyebrow={avatarTarget?.name} width="50rem">
  {#if avatarTarget}
    <div class="avatar-gallery" style="--c: {avatarTarget.color}">
      {#each AVATAR_GROUPS as group}
        <section aria-label={group}>
          <h3>{group}</h3>
          <div class="avatar-options">
            {#each avatarsForGroup(group) as avatar (avatar.id)}
              <button
                class="avatar-option"
                class:chosen={genericAvatarFor(avatarTarget).id === avatar.id}
                aria-label="{avatar.label} para {avatarTarget.name}"
                aria-pressed={genericAvatarFor(avatarTarget).id === avatar.id}
                disabled={savingAvatar}
                onclick={() => chooseAvatar(avatar.id)}
              >
                <span class="avatar-thumb tinted-portrait"><img src={avatar.src} alt="" /></span>
                <span>{avatar.label}</span>
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</Modal>

<style>
  .family {
    & h3 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
    gap: 1rem;
  }

  .person {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    padding: 1.25rem 1rem 1rem;
    overflow: hidden;
    text-align: center;

    &:hover .remove {
      opacity: 1;
    }
  }

  .portrait {
    width: 100%;
    aspect-ratio: 4 / 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    overflow: hidden;
    border-radius: 1rem;
    background: var(--c);
    color: white;
    font-size: 0.78rem;

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .photo-actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    width: 100%;

    & label {
      cursor: pointer;
    }
  }

  .avatar-select {
    width: 100%;
  }

  .avatar-gallery {
    display: grid;
    gap: 1.25rem;

    & h3 {
      margin: 0 0 0.6rem;
      font-size: 1rem;
    }
  }

  .avatar-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.75rem;
  }

  .avatar-option {
    display: grid;
    gap: 0.4rem;
    padding: 0.3rem;
    border: 2px solid transparent;
    border-radius: 0.85rem;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
    text-align: center;
    font: inherit;
    font-size: 0.72rem;
    line-height: 1.25;

    &:hover,
    &:focus-visible {
      background: var(--surface);
    }

    &.chosen {
      border-color: var(--accent);
    }

    &:disabled {
      cursor: wait;
    }
  }

  .avatar-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 5;
    border-radius: 0.65rem;

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .portrait-preview {
    & img {
      width: 100%;
      aspect-ratio: 4 / 5;
      border-radius: 1rem;
      object-fit: cover;
    }
  }

  .preview-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }

  .name {
    width: 100%;
    border: 0;
    border-bottom: 1px dashed transparent;
    background: none;
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    &:hover,
    &:focus {
      outline: none;
      border-bottom-color: var(--line-strong);
    }
  }

  .swatches {
    display: flex;
    gap: 0.25rem;

    & button {
      width: 1rem;
      height: 1rem;
      padding: 0;
      border-radius: 50%;
      border: 2px solid var(--surface);
      background: var(--s);
      cursor: pointer;
      box-shadow: 0 0 0 1px var(--line);
      &[aria-checked="true"] {
        box-shadow: 0 0 0 2px var(--ink);
      }
    }
  }

  .color-caption {
    color: var(--ink-muted);
    font-size: 0.72rem;
  }

  dl {
    display: grid;
    gap: 0.375rem;
    width: 100%;
    margin: 0.25rem 0 0;
    padding-top: 0.625rem;
    border-top: 1px solid var(--line);

    & > div {
      min-width: 0;
      padding: 0.5rem 0.625rem;
      border-radius: var(--r-sm);
      background: var(--glass-soft);
      text-align: left;
    }
    & dt {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    & dd {
      margin: 0.15rem 0 0;
      font-weight: 700;
      font-size: clamp(0.78rem, 0.85vw, 0.95rem);
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
  }

  .remove {
    opacity: 0;
    transition: opacity 0.15s;
  }

  .add {
    justify-content: center;
    gap: 0.75rem;
    padding: 1.5rem 1rem;
    border: 1px dashed var(--line-strong);
    background: var(--glass-strong);

    & label {
      font-weight: 600;
    }

    & .btn {
      width: 100%;
    }
  }

  .plus {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-ink);
  }

  @media (max-width: 60rem) {
    .remove {
      opacity: 1;
    }
  }
</style>
