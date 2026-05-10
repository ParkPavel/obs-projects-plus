<script lang="ts">
  /**
   * Dashboard V2 (DG-3 / S3.2) — filter settings slide-in panel.
   *
   * Notion-style condition rows + AND/OR toggle. Includes:
   * - Drag-to-reorder root conditions (handled inside FiltersTab)
   * - Saved filter presets (session-scoped, module-level Map)
   */
  import { createEventDispatcher } from "svelte";
  import { SlideInPanel } from "src/ui/components/SlideInPanel";
  import FiltersTab from "src/ui/components/Navigation/SettingsMenu/tabs/FiltersTab.svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { FilterDefinition } from "src/settings/base/settings";
  import { i18n } from "src/lib/stores/i18n";

  export let open: boolean;
  export let filter: FilterDefinition | undefined;
  export let fields: DataField[];

  const dispatch = createEventDispatcher<{
    save: FilterDefinition | undefined;
    close: void;
  }>();

  let editedFilter = filter;

  $: if (open) {
    editedFilter = filter ? { ...filter } : undefined;
  }

  function handleFilterChange(e: CustomEvent<FilterDefinition>) {
    editedFilter = e.detail;
  }

  function handleSave() {
    dispatch("save", editedFilter);
    dispatch("close");
  }

  function handleClose() {
    dispatch("close");
  }

  // ── Saved filter presets (session-scoped, survives panel open/close) ──
  const presetStore = new Map<string, FilterDefinition>();
  let presets: Array<{ name: string; def: FilterDefinition }> = [];

  let savingAs = false;
  let newPresetName = "";

  function saveAsPreset() {
    const name = newPresetName.trim();
    if (!name || !editedFilter) return;
    presetStore.set(name, JSON.parse(JSON.stringify(editedFilter)));
    presets = [...presetStore.entries()].map(([n, def]) => ({ name: n, def }));
    savingAs = false;
    newPresetName = "";
  }

  function loadPreset(def: FilterDefinition) {
    editedFilter = JSON.parse(JSON.stringify(def));
  }

  function deletePreset(name: string) {
    presetStore.delete(name);
    presets = [...presetStore.entries()].map(([n, def]) => ({ name: n, def }));
  }

  $: canSave = !!(editedFilter?.conditions?.length ?? 0) || !!(editedFilter?.groups?.length ?? 0);
</script>

<SlideInPanel
  {open}
  title={$i18n.t("views.dashboard.filter-settings.title", {
    defaultValue: "Filter",
  })}
  width="26rem"
  on:close={handleClose}
>
  <div class="ppp-filter-panel">

    <!-- Saved presets bar -->
    {#if presets.length > 0}
      <div class="ppp-filter-presets">
        <span class="ppp-filter-presets-label">
          {$i18n.t("views.dashboard.filter-settings.presets", { defaultValue: "Presets" })}:
        </span>
        {#each presets as preset}
          <span class="ppp-preset-chip-group">
            <button
              class="ppp-preset-chip"
              type="button"
              on:click={() => loadPreset(preset.def)}
              title={$i18n.t("views.dashboard.filter-settings.load-preset", { defaultValue: "Load preset" })}
            >{preset.name}</button>
            <button
              class="ppp-preset-chip-del"
              type="button"
              on:click={() => deletePreset(preset.name)}
              aria-label={$i18n.t("common.delete")}
            >✕</button>
          </span>
        {/each}
      </div>
    {/if}

    <!-- Save-as inline form -->
    {#if savingAs}
      <div class="ppp-filter-save-as">
        <!-- svelte-ignore a11y-autofocus -->
        <input
          class="ppp-filter-save-as-input"
          type="text"
          autofocus
          bind:value={newPresetName}
          placeholder={$i18n.t("views.dashboard.filter-settings.preset-name-placeholder", { defaultValue: "Preset name…" })}
          on:keydown={(e) => {
            if (e.key === "Enter") saveAsPreset();
            if (e.key === "Escape") { savingAs = false; newPresetName = ""; }
          }}
        />
        <button class="ppp-filter-save-as-ok" type="button" on:click={saveAsPreset}>
          {$i18n.t("common.save", { defaultValue: "Save" })}
        </button>
        <button class="ppp-filter-save-as-cancel" type="button" on:click={() => { savingAs = false; newPresetName = ""; }}>
          {$i18n.t("common.cancel", { defaultValue: "Cancel" })}
        </button>
      </div>
    {/if}

    <!-- Reuse existing FiltersTab logic (value / update API) -->
    <FiltersTab
      value={editedFilter}
      {fields}
      on:update={handleFilterChange}
    />

    <!-- Actions -->
    <div class="ppp-filter-panel-actions">
      <button
        class="ppp-filter-panel-btn ppp-filter-panel-btn--primary"
        on:click={handleSave}
      >
        {$i18n.t("common.apply", { defaultValue: "Apply" })}
      </button>
      <button
        class="ppp-filter-panel-btn"
        on:click={handleClose}
      >
        {$i18n.t("common.cancel", { defaultValue: "Cancel" })}
      </button>
      {#if canSave && !savingAs}
        <button
          class="ppp-filter-panel-btn ppp-filter-panel-btn--preset"
          type="button"
          on:click={() => { savingAs = true; newPresetName = ""; }}
        >
          {$i18n.t("views.dashboard.filter-settings.save-preset", { defaultValue: "Save as preset…" })}
        </button>
      {/if}
    </div>
  </div>
</SlideInPanel>

<style>
  .ppp-filter-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ── Preset bar ── */
  .ppp-filter-presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    background: var(--background-secondary);
    border-radius: var(--radius-s, 0.25rem);
    border: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-filter-presets-label {
    font-size: 0.75rem;
    color: var(--text-faint);
    user-select: none;
    flex-shrink: 0;
  }

  .ppp-preset-chip-group {
    display: inline-flex;
    align-items: stretch;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .ppp-preset-chip {
    padding: 0.125rem 0.5rem;
    background: var(--background-primary);
    color: var(--text-normal);
    border: none;
    cursor: pointer;
    font-size: 0.75rem;
    font-family: var(--font-interface);
    transition: background 100ms ease;
  }

  .ppp-preset-chip:hover {
    background: var(--background-modifier-hover);
    color: var(--interactive-accent);
  }

  .ppp-preset-chip-del {
    padding: 0.125rem 0.3125rem;
    background: var(--background-primary);
    color: var(--text-faint);
    border: none;
    border-left: 0.0625rem solid var(--background-modifier-border);
    cursor: pointer;
    font-size: 0.625rem;
    line-height: 1;
    transition: background 100ms ease, color 100ms ease;
  }

  .ppp-preset-chip-del:hover {
    background: var(--background-modifier-error-rgb, rgba(255, 0, 0, 0.08));
    color: var(--text-error);
  }

  /* ── Save-as form ── */
  .ppp-filter-save-as {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    padding: 0.375rem 0.5rem;
    background: var(--background-secondary);
    border-radius: var(--radius-s, 0.25rem);
    border: 0.0625rem solid var(--interactive-accent);
  }

  .ppp-filter-save-as-input {
    flex: 1;
    height: 1.625rem;
    padding: 0 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0.25rem;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.8125rem;
    font-family: var(--font-interface);
    outline: none;
    box-sizing: border-box;
  }

  .ppp-filter-save-as-input:focus {
    border-color: var(--interactive-accent);
  }

  .ppp-filter-save-as-ok,
  .ppp-filter-save-as-cancel {
    padding: 0.125rem 0.625rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    cursor: pointer;
    border: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    transition: background 100ms ease;
    white-space: nowrap;
  }

  .ppp-filter-save-as-ok {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-filter-save-as-ok:hover {
    background: var(--interactive-accent-hover);
  }

  .ppp-filter-save-as-cancel:hover {
    background: var(--background-modifier-hover);
  }

  /* ── Actions row ── */
  .ppp-filter-panel-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-filter-panel-btn {
    flex: 1;
    padding: 0.5rem 1rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: var(--font-ui-small, 0.875rem);
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-filter-panel-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-filter-panel-btn--primary {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-filter-panel-btn--primary:hover {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }

  .ppp-filter-panel-btn--preset {
    flex: 0 0 auto;
    font-size: 0.75rem;
    padding: 0.375rem 0.75rem;
    color: var(--text-muted);
    border-style: dashed;
    white-space: nowrap;
  }

  .ppp-filter-panel-btn--preset:hover {
    color: var(--interactive-accent);
    border-color: var(--interactive-accent);
    border-style: solid;
  }
</style>
