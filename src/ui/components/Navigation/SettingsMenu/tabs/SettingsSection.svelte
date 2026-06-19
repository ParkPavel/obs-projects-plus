<script lang="ts">
  /**
   * SettingsSection (#093 slice 4) — collapsible accordion section for the
   * NOTION_GRADE_PIPELINE §3 panel anatomy: a section header with a chevron and
   * a body that can start collapsed for "advanced" groups (progressive
   * disclosure). Purely presentational; content goes in the default slot.
   */
  import { Icon } from "obsidian-svelte";

  export let title: string;
  /** Start collapsed — use for advanced / secondary groups. */
  export let collapsed = false;

  let open = !collapsed;
</script>

<div class="settings-section">
  <button
    type="button"
    class="settings-section-header"
    aria-expanded={open}
    on:click={() => (open = !open)}
  >
    <span class="settings-section-caret" aria-hidden="true">
      <Icon name={open ? "chevron-down" : "chevron-right"} size="xs" />
    </span>
    <span class="settings-section-title">{title}</span>
  </button>
  {#if open}
    <div class="settings-section-body">
      <slot />
    </div>
  {/if}
</div>

<style>
  .settings-section {
    border-top: 1px solid var(--background-modifier-border);
    margin-top: 0.5rem;
    padding-top: 0.5rem;
  }
  .settings-section-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.25rem 0;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-normal);
    font-weight: 600;
    font-size: 0.8125rem;
    text-align: left;
  }
  .settings-section-caret {
    display: inline-flex;
    color: var(--text-muted);
  }
  .settings-section-body {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding-top: 0.5rem;
  }
</style>
