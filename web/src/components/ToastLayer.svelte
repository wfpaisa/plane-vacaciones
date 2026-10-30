<!-- Los avisos, apilados arriba a la derecha y por encima de todo. -->
<script lang="ts">
  import { fly } from "svelte/transition";

  import { toasts } from "../lib/toast.svelte";
  import Icon from "./Icon.svelte";

  const ICONS = { error: "cancel-circle", success: "checkmark-circle-02", info: "information-circle" };
</script>

<div class="toasts" aria-live="polite">
  {#each toasts.items as t (t.id)}
    <div class="toast {t.kind}" role={t.kind === "error" ? "alert" : "status"} transition:fly={{ x: 24, duration: 220 }}>
      <Icon name={ICONS[t.kind]} size={18} />
      <p>{t.text}</p>
      <button type="button" class="btn ghost icon sm" aria-label="Cerrar aviso" onclick={() => toasts.dismiss(t.id)}>
        <Icon name="cancel-01" size={12} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: 1rem;
    right: 1rem;
    left: 1rem;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    max-width: 24rem;
    padding: 0.5rem 0.5rem 0.5rem 0.875rem;
    border-radius: var(--pill);
    background: var(--pill-on);
    color: var(--pill-on-text);
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
    font-size: 0.875rem;

    & p {
      flex: 1;
    }
    & .btn {
      color: inherit;
      opacity: 0.7;
    }
    &.success :global(i:first-child) {
      color: oklch(0.8 0.14 150);
    }
    &.error :global(i:first-child) {
      color: oklch(0.75 0.16 25);
    }
  }
</style>
