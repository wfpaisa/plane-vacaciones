<!--
  Un icono de Hugeicons (la fuente de /iconos). Hereda el color del texto y,
  sin `size`, mide lo mismo que la letra que lo rodea.
-->
<script lang="ts">
  import { cx } from "../lib/cx";

  let {
    name,
    size,
    class: className,
    color,
  }: { name: string; size?: number; class?: string; color?: string } = $props();
</script>

<i
  aria-hidden="true"
  class={cx("icon", `icon-${name}`, "icon-glyph", className)}
  style="{size === undefined ? '' : `font-size: ${size}px;`}{color ? ` color: ${color};` : ''}"
></i>
