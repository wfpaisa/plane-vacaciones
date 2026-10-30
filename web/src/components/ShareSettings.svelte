<script lang="ts">
  import { onMount } from "svelte";
  import { errorText, pb } from "../lib/pb";
  import { sharedPath } from "../lib/router.svelte";
  import { toast } from "../lib/toast.svelte";
  import Icon from "./Icon.svelte";

  let { tripId }: { tripId: string } = $props();
  let token = $state("");
  let loading = $state(true);
  let busy = $state(false);
  let confirmRevoke = $state(false);
  const link = $derived(token ? `${location.origin}${location.pathname}${sharedPath(token)}` : "");

  async function load() {
    loading = true;
    try { token = (await pb.send<{ token: string }>(`/api/vacaciones/trips/${tripId}/share`, { method: "GET" })).token; }
    catch (err) { toast.error(errorText(err)); }
    finally { loading = false; }
  }
  async function create() {
    busy = true;
    try {
      const renew = !!token;
      token = (await pb.send<{ token: string }>(`/api/vacaciones/trips/${tripId}/share`, { method: "POST" })).token;
      toast.ok(renew ? "Enlace nuevo creado. El anterior dejó de funcionar." : "Enlace creado.");
    } catch (err) { toast.error(errorText(err)); }
    finally { busy = false; }
  }
  async function revoke() {
    busy = true;
    try {
      await pb.send(`/api/vacaciones/trips/${tripId}/share`, { method: "DELETE" });
      token = ""; confirmRevoke = false;
      toast.ok("Enlace desactivado.");
    } catch (err) { toast.error(errorText(err)); }
    finally { busy = false; }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); toast.ok("Enlace copiado."); }
    catch { toast.error("No se pudo copiar. Selecciona el enlace y cópialo manualmente."); }
  }
  onMount(() => { void load(); });
</script>

<div class="share">
  <p class="lead">Quien tenga el enlace puede ver el viaje sin iniciar sesión, pero no puede cambiar nada.</p>
  <ul class="scope">
    <li><Icon name="view" /> <span><strong>Se ve:</strong> origen, ruta con fechas y noches, itinerario por día, mapa, viajeros y notas.</span></li>
    <li><Icon name="lock" /> <span><strong>Queda privado:</strong> gastos, presupuesto, costos y checklist.</span></li>
  </ul>

  {#if loading}
    <p class="help" role="status">Cargando…</p>
  {:else if token}
    <div class="field">
      <label for="share-link">Enlace de solo lectura</label>
      <div class="row">
        <input id="share-link" class="input" readonly value={link} onfocus={(e) => e.currentTarget.select()} />
        <button class="btn primary sm" onclick={copy}><Icon name="copy-01" /> Copiar</button>
      </div>
    </div>
    <div class="actions">
      <a class="btn ghost sm" href={link} target="_blank" rel="noopener"><Icon name="square-arrow-up-right" /> Abrir vista</a>
      <button class="btn ghost sm" disabled={busy} onclick={create}><Icon name="refresh" /> Crear uno nuevo</button>
      <button class="btn ghost sm danger-text" disabled={busy} onclick={() => (confirmRevoke = true)}>Desactivar</button>
    </div>
    {#if confirmRevoke}
      <div class="confirm" role="alert">
        <span>¿Desactivar el enlace? Quien lo tenga dejará de ver el viaje.</span>
        <div class="actions">
          <button class="btn ghost sm" onclick={() => (confirmRevoke = false)}>Cancelar</button>
          <button class="btn danger sm" disabled={busy} onclick={revoke}>Desactivar enlace</button>
        </div>
      </div>
    {/if}
    <p class="help">«Crear uno nuevo» anula el enlace anterior. Úsalo si lo compartiste con quien no debías.</p>
  {:else}
    <button class="btn primary" disabled={busy} onclick={create}><Icon name="link-04" /> {busy ? "Creando…" : "Crear enlace para compartir"}</button>
  {/if}
</div>

<style>
  .share { display: flex; flex-direction: column; gap: 1rem; }
  .lead { font-size: .9375rem; line-height: 1.5; }
  .help { font-size: .8125rem; line-height: 1.5; color: var(--ink-muted); }
  .scope { display: flex; flex-direction: column; gap: .5rem; padding: .875rem 1rem; margin: 0; list-style: none; border: 1px solid var(--line); border-radius: var(--r); background: var(--paper); }
  .scope li { display: flex; gap: .625rem; align-items: flex-start; font-size: .8125rem; line-height: 1.5; color: var(--ink-soft); }
  .scope :global(.icon) { margin-top: .2rem; color: var(--ink-muted); }
  .row { display: flex; gap: .5rem; align-items: center; }
  .row .input { flex: 1; min-width: 0; font-size: .8125rem; }
  .actions { display: flex; flex-wrap: wrap; gap: .5rem; }
  .share > .btn { align-self: flex-start; }
  .danger-text { color: var(--danger); }
  .confirm { display: flex; flex-direction: column; gap: .625rem; padding: .875rem 1rem; border: 1px solid var(--line); border-radius: var(--r); background: var(--paper); font-size: .8125rem; }
  .confirm .actions { justify-content: flex-end; }
</style>
