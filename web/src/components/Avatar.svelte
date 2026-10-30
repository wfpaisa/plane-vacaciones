<!-- Retrato del viajero o un avatar low poly cuando no tiene foto. -->
<script lang="ts">
  import { genericAvatarFor } from "../lib/genericAvatars";
  import { pb } from "../lib/pb";
  import type { Traveler } from "../lib/types";

  let { traveler, size = 32, ring = false }: { traveler: Traveler; size?: number; ring?: boolean } =
    $props();

  const portraitUrl = $derived(
    traveler.portrait ? pb.files.getURL(traveler, traveler.portrait, { thumb: "64x64" }) : genericAvatarFor(traveler).src,
  );
</script>

<span
  class={traveler.portrait ? "avatar" : "avatar tinted-portrait"}
  class:ring
  title={traveler.name}
  style="--c: {traveler.color || 'var(--accent)'}; width: {size}px; height: {size}px"
>
  <img src={portraitUrl} alt="" />
</span>

<style>
  .avatar {
    display: inline-grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--c);
    color: oklch(0.99 0 0);
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1;
    user-select: none;
    overflow: hidden;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ring {
    box-shadow: 0 0 0 2px var(--surface);
  }
</style>
