<!--
  El anillo del presupuesto: cada categoría ocupa su tramo, con su color, sobre
  el total disponible. Si se pasan del presupuesto, el anillo se cierra en rojo.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    segments,
    total,
    size = 200,
    stroke = 18,
    children,
  }: {
    segments: { value: number; color: string; label: string }[];
    total: number;
    size?: number;
    stroke?: number;
    children?: Snippet;
  } = $props();

  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const sum = $derived(segments.reduce((a, s) => a + s.value, 0));
  const base = $derived(Math.max(total, sum, 1));
  const over = $derived(total > 0 && sum > total);

  const arcs = $derived.by(() => {
    let offset = 0;
    // Con puntas redondas, cada tramo se recorta media punta por lado más un respiro.
    const gap = segments.filter((s) => s.value > 0).length > 1 ? stroke + 5 : 0;
    return segments
      .filter((s) => s.value > 0)
      .map((s) => {
        const len = (s.value / base) * c;
        const arc = { ...s, dash: Math.max(0.01, len - gap), offset: offset + gap / 2 };
        offset += len;
        return arc;
      });
  });
</script>

<div class="ring" style="width: {size}px; height: {size}px">
  <svg viewBox="0 0 {size} {size}" role="img" aria-label="Presupuesto usado por categoría">
    <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--paper-deep)" stroke-width={stroke} />
    {#if over}
      <circle cx={size / 2} cy={size / 2} r={r + stroke / 2 + 4} fill="none" stroke="var(--danger)" stroke-width="2" stroke-dasharray="4 5" />
    {/if}
    <g transform="rotate(-90 {size / 2} {size / 2})">
      {#each arcs as a (a.label)}
        <circle
          class="arc"
          cx={size / 2}
          cy={size / 2}
          {r}
          fill="none"
          stroke={a.color}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray="{a.dash} {c}"
          stroke-dashoffset={-a.offset}
        >
          <title>{a.label}</title>
        </circle>
      {/each}
    </g>
  </svg>
  <div class="center">{@render children?.()}</div>
</div>

<style>
  .ring {
    position: relative;
    flex-shrink: 0;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .arc {
    transition:
      stroke-dasharray 0.8s var(--ease),
      stroke-dashoffset 0.8s var(--ease);
  }

  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
</style>
