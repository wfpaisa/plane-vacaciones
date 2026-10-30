<!--
  Un campo de contraseña con sugerencia: muestra una contraseña generada que
  se puede regenerar, copiar o reemplazar escribiendo otra.
-->
<script lang="ts">
  import { suggestPassword } from "../lib/password";
  import { toast } from "../lib/toast.svelte";
  import Icon from "./Icon.svelte";

  let {
    value = $bindable(""),
    label = "Contraseña",
    suggest = false,
    autocomplete = "new-password",
    id,
  }: { value?: string; label?: string; suggest?: boolean; autocomplete?: AutoFill; id: string } = $props();

  let visible = $state(false);
  // svelte-ignore state_referenced_locally
  if (suggest && !value) { value = suggestPassword(); visible = true; }

  async function copy() {
    try { await navigator.clipboard.writeText(value); toast.ok("Contraseña copiada."); }
    catch { toast.error("No se pudo copiar. Selecciónala y cópiala manualmente."); }
  }
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="row">
    <input {id} class="input" type={visible ? "text" : "password"} bind:value {autocomplete} minlength="10" maxlength="72" required spellcheck="false" autocapitalize="none" />
    <button type="button" class="btn icon sm" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} title={visible ? "Ocultar" : "Mostrar"} onclick={() => (visible = !visible)}>
      <Icon name={visible ? "view-off" : "view"} />
    </button>
    {#if suggest}
      <button type="button" class="btn icon sm" aria-label="Sugerir otra contraseña" title="Sugerir otra" onclick={() => { value = suggestPassword(); visible = true; }}>
        <Icon name="refresh" />
      </button>
      <button type="button" class="btn icon sm" aria-label="Copiar contraseña" title="Copiar" onclick={copy}>
        <Icon name="copy-01" />
      </button>
    {/if}
  </div>
  {#if suggest}<small class="help">Sugerida por el sistema. Puedes cambiarla; mínimo 10 caracteres.</small>{/if}
</div>

<style>
  .row { display: flex; align-items: center; gap: .375rem; }
  .row .input { flex: 1; min-width: 0; font-family: ui-monospace, monospace; }
  .help { font-size: .75rem; color: var(--ink-muted); }
</style>
