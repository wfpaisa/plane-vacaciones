<!--
  Una tarjeta centrada sobre el resto, con el fondo oscurecido. Se cierra con
  la equis, con escape o con un clic fuera. Adaptada del `PanelModal` de Planer.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { portal } from "../lib/portal";
  import Icon from "./Icon.svelte";

  let {
    open,
    onClose,
    title,
    eyebrow,
    width = "34rem",
    children,
    footer,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    eyebrow?: string;
    width?: string;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

{#if open}
  <div use:portal class="layer" role="dialog" aria-modal="true" aria-label={title}>
    <button type="button" class="backdrop" aria-label="Cerrar" onclick={onClose}></button>
    <div class="sheet" style="max-width: {width}">
      <header>
        <div>
          {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
          <h2>{title}</h2>
        </div>
        <button type="button" class="btn ghost icon sm round" aria-label="Cerrar" onclick={onClose}>
          <Icon name="cancel-01" />
        </button>
      </header>
      <div class="body">
        {@render children()}
      </div>
      {#if footer}
        <footer>{@render footer()}</footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: oklch(0.2 0.01 100 / 0.25);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    cursor: default;
    animation: fade 0.2s ease both;
  }

  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: calc(100dvh - 2rem);
    background: var(--glass-strong);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    border: 1px solid var(--glass-line);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow-lg);
    animation: pop 0.32s var(--ease) both;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.25rem 0.5rem 1.5rem;

    & h2 {
      font-size: 1.5rem;
      font-weight: 450;
    }
  }

  .body {
    padding: 0.75rem 1.5rem 1.25rem;
    overflow: auto;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    border-top: 1px solid var(--line);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(14px) scale(0.98);
    }
  }
</style>
