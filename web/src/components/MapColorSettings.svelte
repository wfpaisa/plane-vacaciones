<script lang="ts">
  import { MAP_COLOR_OPTIONS } from "../lib/googleMapStyle";
  import { mapPreferences, MAP_LIGHT_COLORS, MAP_DARK_COLORS } from "../lib/mapPreferences.svelte";
</script>

<fieldset>
  <legend>Colores de Google Maps</legend>
  <div class="grid-2">
    {#each ["light", "dark"] as mode}
      {@const dark = mode === "dark"}
      <label class="field">
        <span>{dark ? "Modo oscuro" : "Modo claro"}</span>
        <select class="select" value={dark ? mapPreferences.dark : mapPreferences.light} onchange={(event) => mapPreferences.set(dark ? "dark" : "light", Number(event.currentTarget.value))}>
          {#each dark ? MAP_DARK_COLORS : MAP_LIGHT_COLORS as id, index}
            <option value={id}>{index + 1}. {id === 0 ? "Normal" : MAP_COLOR_OPTIONS[id]}{index === 0 ? " (predeterminado)" : ""}</option>
          {/each}
        </select>
      </label>
    {/each}
  </div>
  <p>Se aplica al instante y se recuerda en este navegador para todos los viajes. Los colores se ven en la vista Mapa.</p>
</fieldset>

<style>
  fieldset { border: 0; padding: 0; margin: 0; }
  legend { margin-bottom: .625rem; font-size: .8125rem; font-weight: 550; color: var(--ink-soft); }
  p { margin-top: .5rem; font-size: .75rem; color: var(--ink-muted); }
</style>
