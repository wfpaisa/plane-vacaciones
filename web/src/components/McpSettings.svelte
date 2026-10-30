<script lang="ts">
  import { onMount } from "svelte";
  import { pb, errorText } from "../lib/pb";
  import { toast } from "../lib/toast.svelte";
  import type { Trip } from "../lib/types";
  import Icon from "./Icon.svelte";
  /** La conexión es global; con un viaje, el mensaje inicial se enfoca en él. */
  let { trip }: { trip?: Trip | null } = $props();
  let token = $state("");
  let enabled = $state(false);
  let toggling = $state(false);
  let path = $state("/api/vacaciones/mcp");
  let loading = $state(true);
  let error = $state("");
  let renewing = $state(false);
  let confirmRenew = $state(false);
  let reveal = $state(false);
  let copied = $state("");
  type Client = "claude" | "json" | "manual";
  let client = $state<Client>("claude");
  const CLIENTS: { key: Client; label: string }[] = [
    { key: "claude", label: "Claude Code" },
    { key: "json", label: "Otro cliente" },
    { key: "manual", label: "URL y token" },
  ];

  const url = $derived(`${location.origin}${path}`);
  const shown = $derived(reveal ? token : token.slice(0, 8) + "•".repeat(16));
  const command = (t: string) => `claude mcp add --transport http --scope user vacaciones ${url} --header "Authorization: Bearer ${t}"`;
  const config = (t: string) => JSON.stringify({ mcpServers: { vacaciones: { type: "http", url, headers: { Authorization: `Bearer ${t}` } } } }, null, 2);

  const ASK = "Antes de proponer nada, pregúntame desde qué ciudad salimos (lugar de origen) y guárdalo en el viaje; luego destino, fechas, presupuesto, moneda, viajeros y preferencias.";
  const allPrompt = `Conecta con Vacaciones y consulta get_context y list_trips. Ayúdame con mis viajes: puedes consultarlos, crear viajes nuevos y editar los existentes. Para un viaje nuevo: ${ASK} Propón la ruta desde el origen, noches por ciudad, transporte de ida y regreso, lugares por día, gastos estimados y checklist. Verifica coordenadas con search_locations y aclara qué es estimado. Elimina elementos solo si te lo pido.`;
  const tripPrompt = $derived(trip ? `Conecta con Vacaciones y trabaja sobre el viaje «${trip.name}» (trip_id: ${trip.id}), que ya existe: no crees otro. Consulta get_context y get_trip. ${trip.origin ? `Salimos desde ${trip.origin}; confírmamelo.` : ASK} Completa o corrige el viaje: ruta desde el origen, noches por ciudad, transporte de ida y regreso, lugares por día, gastos estimados y checklist. Verifica coordenadas con search_locations y aclara qué es estimado. Elimina elementos solo si te lo pido.` : "");
  let target = $state<"trip" | "all">("trip");
  const prompt = $derived(trip && target === "trip" ? tripPrompt : allPrompt);

  const CAN = [
    { icon: "view", title: "Ver", text: "Todos los viajes y su contenido." },
    { icon: "add-01", title: "Crear", text: "Viajes completos en un paso." },
    { icon: "pencil-edit-02", title: "Editar", text: "Ciudades, lugares, gastos y checklist." },
    { icon: "delete-02", title: "Quitar", text: "Elementos, solo si se lo pides." },
  ];

  async function load(renew = false) {
    loading = !renew; renewing = renew; error = "";
    try {
      const data = await pb.send<{ token: string; path: string; enabled: boolean }>(renew ? "/api/vacaciones/mcp/token" : "/api/vacaciones/mcp/settings", { method: renew ? "POST" : "GET" });
      token = data.token; path = data.path; enabled = data.enabled; confirmRenew = false;
      if (renew) toast.ok("Token renovado. Actualiza la conexión de tu agente.");
    } catch (err) { error = errorText(err); }
    finally { loading = false; renewing = false; }
  }
  async function toggleEnabled() {
    if (toggling || renewing) return;
    toggling = true; error = "";
    try {
      const data = await pb.send<{ enabled: boolean }>("/api/vacaciones/mcp/settings", { method: "POST", body: { enabled: !enabled } });
      enabled = data.enabled;
      confirmRenew = false;
      toast.ok(enabled ? "MCP activado." : "MCP desactivado. Las conexiones del agente quedan bloqueadas.");
    } catch (err) { error = errorText(err); }
    finally { toggling = false; }
  }
  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      copied = key;
      setTimeout(() => { if (copied === key) copied = ""; }, 1800);
    } catch { toast.error("No se pudo copiar. Selecciona el texto y cópialo manualmente."); }
  }
  onMount(() => { void load(); });
</script>

{#snippet copyButton(key: string, value: string, label = "Copiar")}
  <button type="button" class="btn sm copy" onclick={() => copy(key, value)}>
    <Icon name={copied === key ? "tick-02" : "copy-01"} /> {copied === key ? "Copiado" : label}
  </button>
{/snippet}

<div class="mcp">
  {#if error}<div class="error" role="alert"><span>{error}</span><button class="btn sm" onclick={() => load()}>Reintentar</button></div>{/if}
  {#if loading}<p class="help" role="status">Cargando conexión…</p>{/if}

  {#if token}
    <section class="status" class:on={enabled}>
      <span class="badge"><Icon name="ai-magic" size={20} /></span>
      <div class="status-text">
        <strong id="mcp-enabled-label">{enabled ? "Conexión activa" : "Conexión desactivada"}</strong>
        <p id="mcp-enabled-help">
          {enabled ? "Tu agente IA puede consultar, crear y editar todos los viajes de la familia." : "Actívala para que un asistente como Claude planifique tus viajes por ti."}
        </p>
      </div>
      <button class="switch" class:on={enabled} role="switch" aria-checked={enabled} aria-labelledby="mcp-enabled-label" aria-describedby="mcp-enabled-help" disabled={toggling || renewing} onclick={toggleEnabled}><span></span></button>
    </section>

    {#if !enabled}
      <section class="intro">
        <h3>¿Qué es esto?</h3>
        <p>MCP es la forma en que un asistente de IA se conecta con esta aplicación. Le pides en lenguaje natural algo como «planea una semana en Cartagena» y el agente guarda aquí la ruta, los lugares, los gastos y el checklist. Tú ves los cambios en tiempo real y puedes ajustarlos cuando quieras.</p>
      </section>
    {:else}
      <ol class="steps">
        <li>
          <div class="step-head"><span class="num">1</span><div><h3>Conecta tu agente</h3><p class="help">Es una sola conexión para todos los viajes. Hazlo una vez.</p></div></div>
          <div class="segmented" role="tablist" aria-label="Cliente del agente">
            {#each CLIENTS as c (c.key)}
              <button type="button" role="tab" aria-selected={client === c.key} onclick={() => (client = c.key)}>{c.label}</button>
            {/each}
          </div>
          {#if client === "claude"}
            <p class="help">Ejecuta este comando en tu terminal y abre una sesión nueva de Claude Code.</p>
            <pre><code>{command(shown)}</code></pre>
            {@render copyButton("command", command(token), "Copiar comando")}
          {:else if client === "json"}
            <p class="help">Pega esta configuración en un cliente compatible con MCP por HTTP y token Bearer. Los nombres de los campos pueden variar.</p>
            <pre><code>{config(shown)}</code></pre>
            {@render copyButton("config", config(token), "Copiar configuración")}
          {:else}
            <div class="kv">
              <span class="k">URL del servidor</span>
              <div class="v"><code>{url}</code>{@render copyButton("url", url)}</div>
              <span class="k">Token</span>
              <div class="v"><code>{shown}</code>{@render copyButton("token", token)}</div>
            </div>
            <p class="help">Envía el token en la cabecera <code>Authorization: Bearer TOKEN</code>.</p>
          {/if}
          <button type="button" class="link" onclick={() => (reveal = !reveal)}>
            <Icon name={reveal ? "view-off" : "view"} /> {reveal ? "Ocultar token" : "Mostrar token"}
          </button>
        </li>

        <li>
          <div class="step-head"><span class="num">2</span><div><h3>Pídele lo que necesites</h3><p class="help">Copia este mensaje para empezar, o escríbele con tus palabras.</p></div></div>
          {#if trip}
            <div class="targets" role="group" aria-label="Sobre qué trabajará el agente">
              <button type="button" class="chip" aria-pressed={target === "trip"} onclick={() => (target = "trip")}>Solo «{trip.name}»</button>
              <button type="button" class="chip" aria-pressed={target === "all"} onclick={() => (target = "all")}>Todos los viajes</button>
            </div>
          {/if}
          <blockquote class="prompt">{prompt}</blockquote>
          {@render copyButton("prompt", prompt, "Copiar mensaje")}
          <p class="note"><Icon name="location-01" /> El agente siempre pregunta primero desde qué ciudad salen, para planear la ida y el regreso.</p>
        </li>
      </ol>
    {/if}

    <section>
      <h3 class="small">Qué puede hacer el agente</h3>
      <ul class="can">
        {#each CAN as c (c.title)}
          <li><Icon name={c.icon} size={18} /><div><strong>{c.title}</strong><span>{c.text}</span></div></li>
        {/each}
      </ul>
      <p class="help">No hace reservas ni pagos y nunca borra viajes completos. Los precios y horarios que propone son estimados.</p>
    </section>

    {#if enabled}
      <section class="security">
        <Icon name="shield-key" size={18} />
        <div>
          <strong>Seguridad</strong>
          <p class="help">El token da acceso a todos los viajes. Compártelo solo con tu agente. Si se filtró, renuévalo: el anterior deja de funcionar al instante.</p>
          {#if confirmRenew}
            <div class="renew-confirm">
              <span>¿Renovar? Tendrás que actualizarlo en tu agente.</span>
              <button class="btn ghost sm" disabled={renewing || toggling} onclick={() => (confirmRenew = false)}>Cancelar</button>
              <button class="btn danger sm" disabled={renewing || toggling} onclick={() => load(true)}>{renewing ? "Renovando…" : "Renovar token"}</button>
            </div>
          {:else}
            <button class="btn ghost sm" onclick={() => (confirmRenew = true)}>Renovar token</button>
          {/if}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .mcp { display: flex; flex-direction: column; gap: 1.5rem; }
  section, .steps > li { display: flex; flex-direction: column; gap: .625rem; }
  h3 { font-size: 1rem; font-weight: 600; }
  h3.small { font-size: .8125rem; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-muted); }
  p { font-size: .875rem; line-height: 1.55; color: var(--ink-soft); }
  .help { font-size: .8125rem; line-height: 1.5; color: var(--ink-muted); }
  code { font-family: ui-monospace, monospace; font-size: .75rem; }

  .status { flex-direction: row; align-items: center; gap: .875rem; padding: 1rem; border: 1px solid var(--line); border-radius: var(--r); background: var(--paper); }
  .status.on { border-color: var(--accent-soft); background: var(--accent-soft); }
  .badge { display: grid; place-items: center; flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 50%; background: var(--line); color: var(--ink-muted); }
  .status.on .badge { background: var(--accent); color: var(--on-accent); }
  .status-text { flex: 1; min-width: 0; }
  .status-text strong { font-size: .9375rem; }
  .status-text p { margin-top: .125rem; font-size: .8125rem; }

  .switch { flex-shrink: 0; width: 3rem; height: 1.75rem; padding: .1875rem; border: 1px solid var(--line-strong); border-radius: var(--pill); background: var(--line-strong); cursor: pointer; transition: background .2s; }
  .switch.on { background: var(--accent); border-color: var(--accent); }
  .switch span { display: block; width: 1.25rem; height: 1.25rem; border-radius: 50%; background: white; box-shadow: 0 1px 4px rgb(0 0 0 / .2); transition: translate .2s; }
  .switch.on span { translate: 1.25rem 0; }
  .switch:disabled { opacity: .5; cursor: wait; }
  .switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

  .steps { display: flex; flex-direction: column; gap: 1.5rem; padding: 0; margin: 0; list-style: none; }
  .step-head { display: flex; gap: .75rem; align-items: flex-start; }
  .num { display: grid; place-items: center; flex-shrink: 0; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--pill-on); color: var(--pill-on-text); font-size: .8125rem; font-weight: 600; }
  .step-head .help { margin-top: .125rem; }
  .steps > li > :not(.step-head) { margin-left: 2.5rem; }

  .segmented { display: flex; gap: .25rem; padding: .25rem; border: 1px solid var(--line); border-radius: var(--pill); background: var(--paper); }
  .segmented button { flex: 1; padding: .5rem .625rem; border: 0; border-radius: var(--pill); background: transparent; color: var(--ink-muted); font: 550 .8125rem var(--font); cursor: pointer; white-space: nowrap; }
  .segmented button[aria-selected="true"] { background: var(--pill-on); color: var(--pill-on-text); }

  pre { margin: 0; padding: .875rem 1rem; background: var(--paper-deep); border: 1px solid var(--line); border-radius: var(--r); overflow: auto; color: var(--ink); line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
  .kv { display: grid; grid-template-columns: auto 1fr; gap: .5rem .875rem; align-items: center; }
  .k { font-size: .8125rem; color: var(--ink-muted); }
  .v { display: flex; align-items: center; gap: .5rem; min-width: 0; }
  .v code { flex: 1; min-width: 0; padding: .5rem .625rem; background: var(--paper-deep); border: 1px solid var(--line); border-radius: calc(var(--r) * .7); overflow-x: auto; white-space: nowrap; }
  .copy { align-self: flex-start; flex-shrink: 0; }
  .link { align-self: flex-start; display: inline-flex; align-items: center; gap: .375rem; padding: 0; border: 0; background: none; color: var(--accent-ink); font: 550 .8125rem var(--font); cursor: pointer; }

  .targets { display: flex; flex-wrap: wrap; gap: .375rem; }
  .prompt { margin: 0; padding: .875rem 1rem; border-left: 3px solid var(--accent); border-radius: 0 var(--r) var(--r) 0; background: var(--paper); font-size: .8125rem; line-height: 1.6; color: var(--ink-soft); max-height: 11rem; overflow: auto; }
  .note { display: flex; align-items: center; gap: .5rem; font-size: .8125rem; color: var(--ink-muted); }

  .can { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; padding: 0; margin: 0; list-style: none; }
  .can li { display: flex; gap: .625rem; align-items: flex-start; padding: .75rem; border: 1px solid var(--line); border-radius: var(--r); background: var(--paper); color: var(--accent-ink); }
  .can div { display: flex; flex-direction: column; gap: .125rem; }
  .can strong { font-size: .8125rem; color: var(--ink); }
  .can span { font-size: .75rem; line-height: 1.4; color: var(--ink-muted); }

  .security { flex-direction: row; align-items: flex-start; gap: .75rem; padding-top: 1.25rem; border-top: 1px solid var(--line); color: var(--ink-muted); }
  .security > div { display: flex; flex-direction: column; gap: .375rem; align-items: flex-start; }
  .security strong { font-size: .875rem; color: var(--ink); }
  .renew-confirm { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; font-size: .8125rem; color: var(--ink-soft); }

  .error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: var(--danger); font-size: .8125rem; }

  @media (max-width: 32rem) {
    .steps > li > :not(.step-head) { margin-left: 0; }
    .can { grid-template-columns: 1fr; }
    .kv { grid-template-columns: 1fr; }
  }
</style>
