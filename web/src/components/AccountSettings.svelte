<script lang="ts">
  import { onMount } from "svelte";
  import type { Account } from "../lib/account.svelte";
  import { errorText, pb } from "../lib/pb";
  import { toast } from "../lib/toast.svelte";
  import Icon from "./Icon.svelte";
  import PasswordInput from "./PasswordInput.svelte";

  let tab = $state<"me" | "family">("me");
  let me = $state<Account | null>(null);
  let users = $state<Account[]>([]);
  let loading = $state(true);
  let error = $state("");

  // Cambiar la propia contraseña.
  let current = $state("");
  let next = $state("");
  let confirm = $state("");
  let saving = $state(false);

  // Crear una cuenta o restablecer una contraseña: el formulario abierto y el resultado para compartir.
  let creating = $state(false);
  let newName = $state("");
  let newUsername = $state("");
  let newPassword = $state("");
  let resetting = $state<string | null>(null);
  let resetPassword = $state("");
  let busy = $state(false);
  let credentials = $state<{ title: string; username: string; password: string } | null>(null);

  const usernameValid = $derived(/^[a-z0-9._-]{3,30}$/.test(newUsername.trim().toLowerCase()));
  const initial = (a: Account) => (a.name || a.username).slice(0, 1).toUpperCase();
  const shareText = $derived(credentials ? `Vacaciones: ${location.origin}\nUsuario: ${credentials.username}\nContraseña: ${credentials.password}\nPuedes cambiar la contraseña en Cuenta → Mi cuenta.` : "");

  async function load() {
    loading = true; error = "";
    try {
      const data = await pb.send<{ me: Account; users: Account[] }>("/api/vacaciones/accounts", { method: "GET" });
      me = data.me; users = data.users;
    } catch (err) { error = errorText(err); }
    finally { loading = false; }
  }

  async function changePassword(e: SubmitEvent) {
    e.preventDefault();
    if (next !== confirm) { toast.error("Las contraseñas nuevas no coinciden."); return; }
    saving = true;
    try {
      const auth = await pb.send<{ token: string; record: typeof pb.authStore.record }>("/api/vacaciones/account/password", { method: "POST", body: { current, password: next } });
      pb.authStore.save(auth.token, auth.record);
      current = next = confirm = "";
      toast.ok("Contraseña actualizada. Las otras sesiones se cerraron.");
    } catch (err) { toast.error(errorText(err)); }
    finally { saving = false; }
  }

  function openCreate() {
    creating = true; resetting = null; credentials = null;
    newName = newUsername = newPassword = "";
  }

  async function createAccount(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    try {
      const account = await pb.send<Account>("/api/vacaciones/accounts", { method: "POST", body: { name: newName.trim(), username: newUsername.trim().toLowerCase(), password: newPassword } });
      users = [...users, account];
      credentials = { title: `Cuenta creada para ${account.name || account.username}`, username: account.username, password: newPassword };
      creating = false;
    } catch (err) { toast.error(errorText(err)); }
    finally { busy = false; }
  }

  function openReset(id: string) {
    resetting = id; creating = false; credentials = null; resetPassword = "";
  }

  async function reset(e: SubmitEvent, account: Account) {
    e.preventDefault();
    busy = true;
    try {
      await pb.send(`/api/vacaciones/accounts/${account.id}/password`, { method: "POST", body: { password: resetPassword } });
      credentials = { title: `Nueva contraseña para ${account.name || account.username}`, username: account.username, password: resetPassword };
      resetting = null;
    } catch (err) { toast.error(errorText(err)); }
    finally { busy = false; }
  }

  async function copyCredentials() {
    try { await navigator.clipboard.writeText(shareText); toast.ok("Datos copiados."); }
    catch { toast.error("No se pudo copiar. Selecciona el texto y cópialo manualmente."); }
  }

  onMount(() => { void load(); });
</script>

<div class="account">
  {#if error}<div class="error" role="alert"><span>{error}</span><button class="btn sm" onclick={load}>Reintentar</button></div>{/if}
  {#if loading}<p class="help" role="status">Cargando cuentas…</p>{/if}

  {#if me}
    <div class="segmented" role="tablist" aria-label="Secciones de la cuenta">
      <button type="button" role="tab" aria-selected={tab === "me"} onclick={() => (tab = "me")}>Mi cuenta</button>
      <button type="button" role="tab" aria-selected={tab === "family"} onclick={() => (tab = "family")}>Cuentas de la familia</button>
    </div>

    {#if tab === "me"}
      <section class="profile">
        <span class="initial">{initial(me)}</span>
        <div>
          <strong>{me.name || me.username}</strong>
          <span class="muted">@{me.username}{me.is_admin ? " · Admin" : ""}</span>
        </div>
      </section>

      <form class="card-form" onsubmit={changePassword}>
        <div><h3>Cambiar contraseña</h3><p class="help">Al cambiarla se cierran tus sesiones en otros dispositivos.</p></div>
        <PasswordInput id="pw-current" label="Contraseña actual" autocomplete="current-password" bind:value={current} />
        <PasswordInput id="pw-next" label="Nueva contraseña" bind:value={next} />
        <PasswordInput id="pw-confirm" label="Repite la nueva contraseña" bind:value={confirm} />
        {#if confirm && next !== confirm}<p class="warn" role="alert">Las contraseñas nuevas no coinciden.</p>{/if}
        <button class="btn primary" type="submit" disabled={saving || !current || next.length < 10 || next !== confirm}>{saving ? "Guardando…" : "Cambiar contraseña"}</button>
      </form>
    {:else}
      <p class="help">Todas las cuentas ven y editan los mismos viajes. Cualquier miembro puede crear una cuenta; {me.is_admin ? "con la cuenta admin puedes restablecer la contraseña de cualquiera." : "si alguien pierde su contraseña, la cuenta admin puede restablecerla."}</p>

      {#if credentials}
        <section class="credentials" aria-live="polite">
          <div class="cred-head"><Icon name="checkmark-circle-02" size={20} /><strong>{credentials.title}</strong></div>
          <p class="help">Compártele estos datos. La contraseña no se volverá a mostrar.</p>
          <pre>{shareText}</pre>
          <div class="actions">
            <button class="btn ghost sm" onclick={() => (credentials = null)}>Listo</button>
            <button class="btn primary sm" onclick={copyCredentials}><Icon name="copy-01" /> Copiar datos</button>
          </div>
        </section>
      {/if}

      <ul class="people">
        {#each users as u (u.id)}
          <li>
            <div class="person">
              <span class="initial sm">{initial(u)}</span>
              <div class="who">
                <strong>{u.name || u.username}</strong>
                <span class="muted">@{u.username}</span>
              </div>
              {#if u.id === me.id}<span class="tag">Tú</span>{/if}
              {#if u.is_admin}<span class="tag" style="--c: var(--accent)">Admin</span>{/if}
              {#if me.is_admin && u.id !== me.id && resetting !== u.id}
                <button class="btn ghost sm" onclick={() => openReset(u.id)}><Icon name="reset-password" /> Restablecer</button>
              {/if}
            </div>
            {#if resetting === u.id}
              <form class="inline-form" onsubmit={(e) => reset(e, u)}>
                <PasswordInput id={`reset-${u.id}`} label={`Nueva contraseña para @${u.username}`} suggest bind:value={resetPassword} />
                <p class="help">Sus sesiones abiertas se cerrarán.</p>
                <div class="actions">
                  <button type="button" class="btn ghost sm" onclick={() => (resetting = null)}>Cancelar</button>
                  <button type="submit" class="btn primary sm" disabled={busy || resetPassword.length < 10}>{busy ? "Guardando…" : "Restablecer contraseña"}</button>
                </div>
              </form>
            {/if}
          </li>
        {/each}
      </ul>

      {#if creating}
        <form class="card-form" onsubmit={createAccount}>
          <div><h3>Nueva cuenta</h3><p class="help">Elige el usuario con el que entrará. La contraseña es una sugerencia que puedes cambiar.</p></div>
          <label class="field"><span>Nombre <em>(opcional)</em></span><input class="input" bind:value={newName} maxlength="80" placeholder="Ana María" /></label>
          <label class="field">
            <span>Usuario</span>
            <input class="input" bind:value={newUsername} maxlength="30" placeholder="ana" autocapitalize="none" spellcheck="false" autocomplete="off" required />
            <small class="help">{newUsername && !usernameValid ? "De 3 a 30 letras minúsculas, números, puntos, guiones o guiones bajos, sin espacios." : "Sin espacios ni tildes. Se guarda en minúsculas."}</small>
          </label>
          <PasswordInput id="new-password" suggest bind:value={newPassword} />
          <div class="actions">
            <button type="button" class="btn ghost" onclick={() => (creating = false)}>Cancelar</button>
            <button type="submit" class="btn primary" disabled={busy || !usernameValid || newPassword.length < 10}>{busy ? "Creando…" : "Crear cuenta"}</button>
          </div>
        </form>
      {:else}
        <button class="btn" onclick={openCreate}><Icon name="user-add-01" /> Crear cuenta</button>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .account { display: flex; flex-direction: column; gap: 1.25rem; }
  h3 { font-size: 1rem; font-weight: 600; }
  .help { font-size: .8125rem; line-height: 1.5; color: var(--ink-muted); }
  .muted { font-size: .8125rem; color: var(--ink-muted); }
  .account > .btn { align-self: flex-start; }

  .segmented { display: flex; gap: .25rem; padding: .25rem; border: 1px solid var(--line); border-radius: var(--pill); background: var(--paper); }
  .segmented button { flex: 1; padding: .5rem .625rem; border: 0; border-radius: var(--pill); background: transparent; color: var(--ink-muted); font: 550 .8125rem var(--font); cursor: pointer; }
  .segmented button[aria-selected="true"] { background: var(--pill-on); color: var(--pill-on-text); }

  .profile { display: flex; align-items: center; gap: .875rem; }
  .profile div { display: flex; flex-direction: column; gap: .125rem; }
  .initial { display: grid; place-items: center; flex-shrink: 0; width: 2.75rem; height: 2.75rem; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-weight: 600; }
  .initial.sm { width: 2rem; height: 2rem; font-size: .8125rem; background: var(--accent-soft); color: var(--accent-ink); }

  .card-form, .credentials { display: flex; flex-direction: column; gap: .875rem; padding: 1rem; border: 1px solid var(--line); border-radius: var(--r); background: var(--paper); }
  .card-form > .btn { align-self: flex-start; }
  .warn { font-size: .8125rem; color: var(--danger); }
  .actions { display: flex; justify-content: flex-end; gap: .5rem; flex-wrap: wrap; }

  .credentials { border-color: var(--accent-soft); background: var(--accent-soft); }
  .cred-head { display: flex; align-items: center; gap: .5rem; color: var(--accent-ink); }
  .cred-head strong { color: var(--ink); font-size: .9375rem; }
  pre { margin: 0; padding: .75rem .875rem; border-radius: calc(var(--r) * .7); background: var(--paper-deep); font: .8125rem/1.6 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }

  .people { display: flex; flex-direction: column; padding: 0; margin: 0; list-style: none; border: 1px solid var(--line); border-radius: var(--r); background: var(--paper); }
  .people > li + li { border-top: 1px solid var(--line); }
  .person { display: flex; align-items: center; gap: .625rem; padding: .75rem .875rem; flex-wrap: wrap; }
  .who { display: flex; flex-direction: column; flex: 1; min-width: 8rem; }
  .who strong { font-size: .875rem; }
  .inline-form { display: flex; flex-direction: column; gap: .625rem; padding: 0 .875rem .875rem; }

  .error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: var(--danger); font-size: .8125rem; }
</style>
