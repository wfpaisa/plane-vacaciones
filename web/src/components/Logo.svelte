<!-- La marca: dos cumbres y el nombre, como en TheTrail. -->
<script lang="ts">
  let { size = 26 }: { size?: number } = $props();
</script>

<span class="logo">
  <svg width={size} height={size * 0.62} viewBox="0 0 40 25" aria-hidden="true">
    <path d="M0 25 L12 6 L18 15 L24 0 L40 25 Z" fill="var(--ink)" />
    <path d="M12 6 L16 12.5 L13 11 L10 13 Z" fill="var(--canvas)" />
  </svg>
  <span class="word">Vacaciones</span>
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .word {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
</style>
