<script lang="ts">
  import type { Writable } from "svelte/store";
  import { i18n } from "src/lib/stores/i18n";
  export let projectId: Writable<string | undefined>;
  export let projects: readonly { id: string; name: string }[];
</script>

<div class="palette-scope">
  <label>
    <span>{$i18n.t("components.color.favorites-scope")}</span>
    <select value={$projectId ?? ""} on:change={(e) => projectId.set(e.currentTarget.value || undefined)} data-palette-scope aria-label={$i18n.t("components.color.favorites-scope")}>
      <option value="">{$i18n.t("components.color.shared-favorites")}</option>
      {#each projects as project (project.id)}
        <option value={project.id}>{project.name}</option>
      {/each}
    </select>
  </label>
  {#if $projectId}<small>{$i18n.t("components.color.project-favorites-hint")}</small>{/if}
</div>

<style>
  .palette-scope { display: grid; gap: var(--size-4-1); margin-bottom: var(--size-4-2); }
  label { display: grid; gap: var(--size-4-1); min-width: 0; }
  select { width: 100%; max-width: 100%; min-width: 0; font: inherit; }
  small { color: var(--text-muted); overflow-wrap: anywhere; }
  @media (pointer: coarse) { select { font-size: max(var(--font-ui-small), 16px); } }
</style>
