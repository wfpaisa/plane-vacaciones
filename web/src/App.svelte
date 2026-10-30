<script lang="ts">
  import AccountSettings from "./components/AccountSettings.svelte";
  import McpSettings from "./components/McpSettings.svelte";
  import Modal from "./components/Modal.svelte";
  import ToastLayer from "./components/ToastLayer.svelte";
  import TopBar from "./components/TopBar.svelte";
  import { accountPanel } from "./lib/account.svelte";
  import { mcpPanel } from "./lib/mcpPanel.svelte";
  import { router } from "./lib/router.svelte";
  import { session } from "./lib/session.svelte";
  import { TripStore } from "./lib/tripStore.svelte";
  import Home from "./routes/Home.svelte";
  import Login from "./routes/Login.svelte";
  import SharedTrip from "./routes/SharedTrip.svelte";
  import TripPage from "./routes/TripPage.svelte";

  let activeTrip = $state<TripStore | null>(null);

</script>

{#if router.route.page === "shared"}
  <SharedTrip token={router.route.token} />
{:else if !session.ready}
  <p role="status">Comprobando sesión…</p>
{:else if !session.user}
  <Login />
{:else}
  <TopBar store={activeTrip} />
  <main>
    {#if router.route.page === "trip"}
      {#key router.route.id}
        <TripPage id={router.route.id} section={router.route.section} onStore={(store) => (activeTrip = store)} />
      {/key}
    {:else}
      <Home />
    {/if}
  </main>
  <Modal open={mcpPanel.open} onClose={() => (mcpPanel.open = false)} title="Agente IA · MCP" eyebrow="Todos los viajes" width="38rem">
    <McpSettings trip={mcpPanel.trip} />
  </Modal>
  <Modal open={accountPanel.open} onClose={() => (accountPanel.open = false)} title="Cuenta" eyebrow={session.user?.username ? `@${session.user.username}` : undefined} width="36rem">
    <AccountSettings />
  </Modal>
{/if}
<ToastLayer />

<style>
  main {
    position: relative;
    z-index: 2;
    padding-top: var(--header-h);
  }
</style>
