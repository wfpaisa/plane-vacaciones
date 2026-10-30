<script lang="ts">
  import { onMount, tick, type ComponentProps } from "svelte";
  import Icon from "./Icon.svelte";
  import { mapFullscreen } from "../lib/mapFullscreen";
  import { pb } from "../lib/pb";
  import { loadGoogleMaps } from "../lib/googleMaps";
  import GoogleTripMap from "./GoogleTripMap.svelte";
  import TripMap from "./TripMap.svelte";

  let props: ComponentProps<typeof TripMap> = $props();
  let provider = $state<"loading" | "google" | "current">("loading");
  let mobile = $state(window.matchMedia("(max-width: 60rem)").matches);
  let fullscreen = $state(false);
  let toggle: HTMLButtonElement | undefined = $state();
  const canExpand = $derived(props.interactive !== false && props.controls !== false);
  const mapProps = $derived({
    ...props,
    controls: mobile ? fullscreen && props.controls !== false : props.controls,
    ...(mobile ? { inset: fullscreen ? { top: 80, right: 24, bottom: 100, left: 24 } : { top: 190, right: 24, bottom: Math.round(window.innerHeight * .4), left: 24 } } : {}),
    ...(props.onMapClick ? { onMapClick: (lat: number, lng: number) => { if (fullscreen) void setFull(false); props.onMapClick?.(lat, lng); } } : {}),
  });
  let returnFocus: HTMLElement | null = null;
  export function openFullscreen() {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (mobile && canExpand) void setFull(true);
  }
  async function setFull(value: boolean) {
    fullscreen = value;
    await tick();
    window.dispatchEvent(new Event("resize"));
    if (value) toggle?.focus();
    else returnFocus?.focus({ preventScroll: true });
  }
  $effect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && !node.classList.contains("provider-map"));
    const inert = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    return () => {
      document.body.style.overflow = previous;
      background.forEach((node, index) => { node.inert = inert[index]; });
    };
  });
  onMount(() => {
    const query = window.matchMedia("(max-width: 60rem)");
    const change = () => { mobile = query.matches; if (!mobile && fullscreen) void setFull(false); };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  });
  onMount(() => {
    let disposed = false;
    const fallback = () => { if (!disposed) provider = "current"; };
    window.addEventListener("vacaciones-google-error", fallback);
    void (async () => {
      try {
        const reservation = await pb.send<{ provider: string; key?: string }>("/api/vacaciones/google/map", { method: "POST" });
        if (disposed) return;
        if (reservation.provider !== "google" || !reservation.key) return fallback();
        await loadGoogleMaps(reservation.key);
        if (!disposed) provider = "google";
      } catch { fallback(); }
    })();
    return () => { disposed = true; window.removeEventListener("vacaciones-google-error", fallback); };
  });
</script>

<svelte:window onkeydown={(event) => { if (fullscreen && event.key === "Escape") { event.preventDefault(); void setFull(false); } }} />

<div class="provider-map" class:fullscreen use:mapFullscreen={fullscreen} role={fullscreen ? "dialog" : undefined} aria-modal={fullscreen ? true : undefined} aria-label={fullscreen ? "Mapa a pantalla completa" : undefined}>
  {#if provider === "google"}
    <GoogleTripMap {...mapProps} />
  {:else if provider === "current"}
    <TripMap {...mapProps} />
  {:else}
    <div class="loading" role="status">Cargando mapa…</div>
  {/if}
  {#if mobile && canExpand && fullscreen}
    <button class="map-toggle glass" class:back={fullscreen} bind:this={toggle} aria-expanded={fullscreen} onclick={() => setFull(!fullscreen)}>
      <Icon name={fullscreen ? "arrow-left-02" : "arrow-expand-01"} size={18} />
      {fullscreen ? "Volver" : "Ver mapa completo"}
    </button>
  {/if}
</div>

<style>
  .provider-map { position: relative; width: 100%; height: 100%; border-radius: inherit; }
  .provider-map.fullscreen { position: fixed; inset: 0; width: 100%; height: 100dvh; z-index: 1200; border-radius: 0; background: var(--canvas); }
  .map-toggle { position: absolute; z-index: 550; top: calc(var(--header-h) + 38dvh); left: 50%; translate: -50% 0; display: flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: .625rem 1rem; border-radius: var(--r); color: var(--ink); font: 550 .8125rem var(--font); cursor: pointer; pointer-events: auto; white-space: nowrap; }
  .map-toggle.back { top: max(1rem, env(safe-area-inset-top)); left: max(1rem, env(safe-area-inset-left)); translate: none; }
  .fullscreen :global(.controls) { top: auto !important; bottom: max(1.5rem, env(safe-area-inset-bottom)) !important; left: 50% !important; max-width: calc(100vw - 1rem); width: max-content; box-sizing: border-box; flex-wrap: nowrap; justify-content: center; gap: .5rem; }

  .fullscreen :global(.controls .detail) { flex: 0 1 auto; min-width: 0; justify-content: center; gap: .5rem; padding: 0; }
  .fullscreen :global(.controls .detail .adjust) { flex-direction: row; gap: .2rem; white-space: nowrap; }
  .fullscreen :global(.controls .detail .slider) { flex: 0 1 7rem; width: 7rem; min-width: 3rem; }

  .fullscreen :global(.controls .sep) { margin: 0; flex-shrink: 0; }

  .loading { width: 100%; height: 100%; display: grid; place-items: center; color: var(--ink-muted); background: var(--canvas); }
</style>
