<!--
  FieldPresetMenu — dropdown for DataTable column-layout presets.

  Phase 2b — a preset is a snapshot of field-scoped DataTableConfig state
  only (fieldConfig, orderFields, sortCriteria, freezeUpTo, groupBy,
  rowHeight, wrapText). It does NOT carry `view.filter` or
  `config.widgets` — those belong to the enclosing Database view.

  UX: one button that opens a popover listing presets; each row has
  "apply" and "delete". A "save current layout" row at the top captures
  the current `config.table` into a new preset.
-->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { FieldPreset, DataTableConfig } from "src/ui/views/Dashboard/types";
  import { snapshotFromTable, applyPresetToTable } from "./fieldPreset";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";

  // ── Props ──────────────────────────────────────────────────
  export let presets: FieldPreset[] = [];
  export let activeId: string | undefined = undefined;
  export let currentTable: DataTableConfig;
  export let readonly: boolean = false;

  const dispatch = createEventDispatcher<{
    apply: { nextTable: DataTableConfig; activeId: string | undefined };
    save: {
      presets: FieldPreset[];
      activeId: string | undefined;
    };
  }>();

  let open = false;
  let triggerEl: HTMLButtonElement | null = null;

  function toggle() {
    if (readonly) return;
    open = !open;
  }

  function close() {
    open = false;
  }

  function handleApply(preset: FieldPreset) {
    const nextTable = applyPresetToTable(currentTable, preset);
    dispatch("apply", { nextTable, activeId: preset.id });
    close();
  }

  function handleClearActive() {
    dispatch("apply", { nextTable: currentTable, activeId: undefined });
    close();
  }

  function handleSaveNew() {
    const label = window
      .prompt($i18n.t("views.dashboard.field-presets.prompt-new"), "")
      ?.trim();
    if (!label) {
      close();
      return;
    }
    const id = `fp-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const preset: FieldPreset = {
      id,
      label,
      ...snapshotFromTable(currentTable),
    };
    dispatch("save", { presets: [...presets, preset], activeId: id });
    close();
  }

  function handleRename(preset: FieldPreset) {
    const label = window
      .prompt($i18n.t("views.dashboard.field-presets.prompt-rename"), preset.label)
      ?.trim();
    if (!label || label === preset.label) return;
    const next = presets.map((p) =>
      p.id === preset.id ? { ...p, label } : p,
    );
    dispatch("save", { presets: next, activeId });
  }

  function handleDelete(preset: FieldPreset) {
    const ok = window.confirm(
      $i18n.t("views.dashboard.field-presets.confirm-delete", {
        defaultValue: `Delete preset "${preset.label}"?`,
      }),
    );
    if (!ok) return;
    const next = presets.filter((p) => p.id !== preset.id);
    const nextActive = activeId === preset.id ? undefined : activeId;
    dispatch("save", { presets: next, activeId: nextActive });
  }
</script>

<div class="ppp-fp-root">
  <button
    bind:this={triggerEl}
    type="button"
    class="ppp-fp-trigger"
    class:ppp-fp-trigger--active={activeId !== undefined}
    on:click={toggle}
    disabled={readonly}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={$i18n.t("views.dashboard.field-presets.aria-label")}
    title={$i18n.t("views.dashboard.field-presets.title")}
  >
    <span aria-hidden="true">⋮⋮</span>
    <span class="ppp-fp-trigger-label">
      {activeId
        ? presets.find((p) => p.id === activeId)?.label ??
          $i18n.t("views.dashboard.field-presets.label")
        : $i18n.t("views.dashboard.field-presets.label")}
    </span>
  </button>

  <FloatingPopup
    {triggerEl}
    bind:open
    placement="bottom-end"
    role="menu"
    ariaLabel={$i18n.t("views.dashboard.field-presets.aria-label")}
  >
    <button
      type="button"
      class="ppp-fp-row ppp-fp-row--new"
      role="menuitem"
      on:click={handleSaveNew}
    >
      <span aria-hidden="true">＋</span>
      {$i18n.t("views.dashboard.field-presets.save-current")}
    </button>

    {#if presets.length > 0}
      <div class="ppp-fp-sep" role="separator"></div>
      {#each presets as preset (preset.id)}
        <div class="ppp-fp-row" role="menuitem">
          <button
            type="button"
            class="ppp-fp-row-apply"
            class:ppp-fp-row-apply--active={preset.id === activeId}
            on:click={() => handleApply(preset)}
            title={$i18n.t("views.dashboard.field-presets.apply")}
          >
            <span class="ppp-fp-row-dot" aria-hidden="true">
              {preset.id === activeId ? "●" : "○"}
            </span>
            <span class="ppp-fp-row-label">{preset.label}</span>
          </button>
          <button
            type="button"
            class="ppp-fp-row-action"
            on:click={() => handleRename(preset)}
            title={$i18n.t("views.dashboard.field-presets.rename")}
            aria-label={$i18n.t("views.dashboard.field-presets.rename")}
          >
            <span aria-hidden="true">✎</span>
          </button>
          <button
            type="button"
            class="ppp-fp-row-action ppp-fp-row-action--danger"
            on:click={() => handleDelete(preset)}
            title={$i18n.t("views.dashboard.field-presets.delete")}
            aria-label={$i18n.t("views.dashboard.field-presets.delete")}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      {/each}

      {#if activeId !== undefined}
        <div class="ppp-fp-sep" role="separator"></div>
        <button
          type="button"
          class="ppp-fp-row ppp-fp-row--new"
          role="menuitem"
          on:click={handleClearActive}
        >
          {$i18n.t("views.dashboard.field-presets.detach")}
        </button>
      {/if}
    {/if}
  </FloatingPopup>
</div>

<style>
  .ppp-fp-root {
    position: relative;
    display: inline-flex;
  }

  .ppp-fp-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--size-2-1, 0.25rem);
    padding: var(--size-2-1, 0.25rem) var(--size-2-2, 0.5rem);
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
    line-height: 1;
  }

  .ppp-fp-trigger:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-fp-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ppp-fp-trigger--active {
    color: var(--text-accent);
    border-color: var(--interactive-accent);
  }

  .ppp-fp-trigger-label {
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-fp-row {
    display: flex;
    align-items: center;
    gap: var(--size-2-1, 0.25rem);
    padding: var(--size-2-1, 0.25rem) var(--size-2-2, 0.5rem);
    background: transparent;
    border: 0;
    border-radius: var(--radius-s);
    color: var(--text-normal);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
    text-align: left;
    width: 100%;
  }

  .ppp-fp-row:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-fp-row--new {
    color: var(--text-accent);
    font-weight: 500;
  }

  .ppp-fp-row-apply {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: var(--size-2-2, 0.5rem);
    background: transparent;
    border: 0;
    padding: var(--size-2-1, 0.25rem) var(--size-2-2, 0.5rem);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
    text-align: left;
    min-width: 0;
  }

  .ppp-fp-row-apply:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-fp-row-apply--active {
    color: var(--text-accent);
    font-weight: 500;
  }

  .ppp-fp-row-dot {
    width: 0.75rem;
    text-align: center;
  }

  .ppp-fp-row-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .ppp-fp-row-action {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
  }

  .ppp-fp-row-action:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-fp-row-action--danger:hover {
    color: var(--text-error);
  }

  .ppp-fp-sep {
    height: 1px;
    background: var(--background-modifier-border);
    margin: var(--size-2-1, 0.25rem) 0;
  }
</style>
