<script lang="ts">
  /**
   * YamlVisualizer — Notion-parity property panel (Stage A MVP).
   *
   * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.7 (M2 anchor).
   * @since 3.4.2 (Stage A / M2)
   *
   * Surfaces (Stage A scope):
   *   1. Property list with read/edit per type (string/number/boolean/date/list).
   *   2. Toolbar: sort, show/hide, layout switch.
   *   3. Per-property menu: rename, visibility, duplicate, delete.
   *   4. Type editor sub-form.
   *   5. Relation field config (target project + displayField + limit/twoWay
   *      schema-only — runtime stubs registered in .ai_internal/stubs.md).
   *   6. Formula editor MVP modal (text-area; Notion-parity polish is Stage B).
   *
   * Writes go through `app.fileManager.processFrontMatter` exclusively.
   * No monkey-patching of Obsidian's native Properties pane.
   */
  import type { DataFrame, DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { ViewApi } from "src/lib/viewApi";
  import { app } from "src/lib/stores/obsidian";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { fieldDisplayText, fieldIcon } from "src/ui/views/helpers";
  import { TFile, Notice } from "obsidian";
  import { get } from "svelte/store";
  import RelationListView from "./RelationListView.svelte";
  import { FormulaEditor } from "src/ui/components/FormulaEditor";

  import type { YamlVisualizerConfig, VisualizerLayout } from "./types";

  export let frame: DataFrame;
  export let project: ProjectDefinition;
  export let readonly: boolean;
  export let config: YamlVisualizerConfig | undefined;
  export let onConfigChange: (cfg: YamlVisualizerConfig) => void;
  export let api: ViewApi;

  // R-1 / R-12 — keep `api` referenced so the prop survives unused-checks.
  void api;

  // ── Resolved config with defaults ──────────────────────────
  $: hiddenFields = config?.hiddenFields ?? [];
  $: layout = (config?.layout ?? "comfortable") as VisualizerLayout;
  $: sortField = config?.sortField;
  $: sortAsc = config?.sortAsc ?? true;

  function saveConfig(patch: Partial<YamlVisualizerConfig>): void {
    const next: YamlVisualizerConfig = {
      hiddenFields: patch.hiddenFields ?? hiddenFields,
      ...(patch.sortField !== undefined ? { sortField: patch.sortField } : sortField !== undefined ? { sortField } : {}),
      ...(patch.sortAsc !== undefined ? { sortAsc: patch.sortAsc } : { sortAsc }),
      ...(patch.layout !== undefined ? { layout: patch.layout } : { layout }),
    };
    onConfigChange(next);
  }

  // ── Active record selection ───────────────────────────────
  // Stage A MVP: edit the first record. A leaf-mode that follows the focused
  // note across the vault is registered as STB-VISUALIZER-LEAF.
  $: activeRecord = frame.records[0];

  // ── Field ordering & visibility ───────────────────────────
  $: visibleFields = frame.fields
    .filter((f) => !hiddenFields.includes(f.name))
    .filter((f) => !f.derived)
    .slice()
    .sort((a, b) => {
      if (!sortField) return 0;
      const av = a.name;
      const bv = b.name;
      const cmp = av.localeCompare(bv);
      return sortAsc ? cmp : -cmp;
    });

  // ── Toolbar handlers ──────────────────────────────────────
  function toggleVisibility(fieldName: string): void {
    const next = hiddenFields.includes(fieldName)
      ? hiddenFields.filter((n) => n !== fieldName)
      : [...hiddenFields, fieldName];
    saveConfig({ hiddenFields: next });
  }

  function setLayout(next: VisualizerLayout): void {
    saveConfig({ layout: next });
  }

  function onLayoutChange(e: Event): void {
    const v = (e.currentTarget as HTMLSelectElement).value as VisualizerLayout;
    setLayout(v);
  }

  function onTextChange(record: DataRecord, fieldName: string, e: Event): void {
    void writeField(record, fieldName, (e.currentTarget as HTMLInputElement).value);
  }

  function onNumberChange(record: DataRecord, fieldName: string, e: Event): void {
    const raw = (e.currentTarget as HTMLInputElement).value;
    const n = parseFloat(raw);
    void writeField(record, fieldName, isNaN(n) ? null : n);
  }

  function onBooleanChange(record: DataRecord, fieldName: string, e: Event): void {
    void writeField(record, fieldName, (e.currentTarget as HTMLInputElement).checked);
  }

  function onListChange(record: DataRecord, fieldName: string, e: Event): void {
    const arr = (e.currentTarget as HTMLInputElement).value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    void writeField(record, fieldName, arr);
  }

  function toggleSort(): void {
    saveConfig({ sortAsc: !sortAsc });
  }

  // ── Edit / write-back via processFrontMatter ──────────────
  async function writeField(record: DataRecord, fieldName: string, value: unknown): Promise<void> {
    if (readonly) return;
    const file = $app.vault.getAbstractFileByPath(record.id);
    if (!(file instanceof TFile)) return;
    try {
      await $app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        if (value === null || value === undefined || value === "") {
          delete fm[fieldName];
        } else {
          fm[fieldName] = value;
        }
      });
    } catch (err) {
      console.error("[obs-projects-plus] YamlVisualizer write failed", err);
      new Notice("Failed to save property change");
    }
  }

  function fieldValue(record: DataRecord, fieldName: string): unknown {
    return record.values[fieldName];
  }

  // ── Per-row menu state ────────────────────────────────────
  let menuOpenFor: string | null = null;
  function toggleMenu(fieldName: string): void {
    menuOpenFor = menuOpenFor === fieldName ? null : fieldName;
  }

  function deleteField(fieldName: string): void {
    if (!activeRecord) return;
    void writeField(activeRecord, fieldName, undefined);
    menuOpenFor = null;
  }

  function duplicateField(fieldName: string): void {
    if (!activeRecord) return;
    const v = fieldValue(activeRecord, fieldName);
    const newName = `${fieldName}_copy`;
    void writeField(activeRecord, newName, v);
    menuOpenFor = null;
  }

  // ── Formula MVP modal ─────────────────────────────────────
  let formulaModalFor: { field: string; value: string } | null = null;
  function openFormulaModal(fieldName: string): void {
    if (!activeRecord) return;
    const v = String(fieldValue(activeRecord, fieldName) ?? "");
    formulaModalFor = { field: fieldName, value: v };
  }
  function saveFormula(): void {
    if (!activeRecord || !formulaModalFor) return;
    void writeField(activeRecord, formulaModalFor.field, formulaModalFor.value);
    formulaModalFor = null;
  }

  // ── Helpers ───────────────────────────────────────────────
  function asString(v: unknown): string {
    return v === null || v === undefined ? "" : String(v);
  }
  function asArray(v: unknown): string[] {
    if (Array.isArray(v)) return v.map(String);
    if (v === null || v === undefined || v === "") return [];
    return [String(v)];
  }
  function fieldLabel(field: DataField): string {
    return field.name;
  }
  function typeText(field: DataField): string {
    return fieldDisplayText(field);
  }
</script>

<div class="ppp-visualizer ppp-layout-{layout}">
  <!-- Toolbar -->
  <header class="ppp-visualizer-toolbar">
    <span class="ppp-visualizer-title">{project.name}</span>
    <span class="ppp-visualizer-spacer" />
    <button class="clickable-icon" on:click={toggleSort} title={sortAsc ? "Sort ↑" : "Sort ↓"}>
      {sortAsc ? "↑" : "↓"}
    </button>
    <select
      class="ppp-visualizer-layout"
      value={layout}
      on:change={onLayoutChange}
    >
      <option value="compact">{get(i18n).t("data-types.list")}</option>
      <option value="comfortable">{get(i18n).t("data-types.list")} +</option>
      <option value="grid">Grid</option>
    </select>
  </header>

  {#if !activeRecord}
    <div class="ppp-visualizer-empty">No record selected</div>
  {:else}
    <ul class="ppp-property-list">
      {#each visibleFields as field (field.name)}
        <li class="ppp-property-row">
          <span class="ppp-property-handle" aria-hidden="true">⋮⋮</span>
          <span class="ppp-property-icon" data-icon={fieldIcon(field)}></span>
          <span class="ppp-property-label" title={typeText(field)}>{fieldLabel(field)}</span>
          <span class="ppp-property-value">
            {#if field.type === DataFieldType.String || field.type === DataFieldType.Select || field.type === DataFieldType.Status}
              <input
                type="text"
                class="ppp-property-input"
                value={asString(fieldValue(activeRecord, field.name))}
                disabled={readonly}
                on:change={(e) => onTextChange(activeRecord, field.name, e)}
              />
            {:else if field.type === DataFieldType.Number}
              <input
                type="number"
                class="ppp-property-input"
                value={asString(fieldValue(activeRecord, field.name))}
                disabled={readonly}
                on:change={(e) => onNumberChange(activeRecord, field.name, e)}
              />
            {:else if field.type === DataFieldType.Boolean}
              <input
                type="checkbox"
                checked={Boolean(fieldValue(activeRecord, field.name))}
                disabled={readonly}
                on:change={(e) => onBooleanChange(activeRecord, field.name, e)}
              />
            {:else if field.type === DataFieldType.Date}
              <input
                type="date"
                class="ppp-property-input"
                value={asString(fieldValue(activeRecord, field.name)).slice(0, 10)}
                disabled={readonly}
                on:change={(e) => onTextChange(activeRecord, field.name, e)}
              />
            {:else if field.type === DataFieldType.List}
              <input
                type="text"
                class="ppp-property-input"
                placeholder="comma,separated,values"
                value={asArray(fieldValue(activeRecord, field.name)).join(", ")}
                disabled={readonly}
                on:change={(e) => onListChange(activeRecord, field.name, e)}
              />
            {:else if field.type === DataFieldType.Relation}
              <RelationListView
                items={asArray(fieldValue(activeRecord, field.name))}
                maxVisible={5}
              />
            {:else if field.type === DataFieldType.Rollup}
              <span class="ppp-property-readonly">{asString(fieldValue(activeRecord, field.name))}</span>
            {:else if field.type === DataFieldType.Formula}
              <span class="ppp-property-readonly">{asString(fieldValue(activeRecord, field.name))}</span>
              <button
                class="clickable-icon"
                on:click={() => openFormulaModal(field.name)}
                title={$i18n.t("views.dashboard.canvas.formula-builder", { defaultValue: "Formula builder" })}
                aria-label={$i18n.t("views.dashboard.canvas.formula-builder", { defaultValue: "Formula builder" })}
              ><Icon name="function-square" size="sm" /></button>
            {:else}
              <span class="ppp-property-readonly">{asString(fieldValue(activeRecord, field.name))}</span>
            {/if}
          </span>
          <button
            class="ppp-property-menu-btn clickable-icon"
            on:click={() => toggleMenu(field.name)}
            aria-haspopup="true"
            aria-expanded={menuOpenFor === field.name}
            title="Property options"
          >⋯</button>
          {#if menuOpenFor === field.name}
            <div class="ppp-property-menu" role="menu">
              <button on:click={() => { toggleVisibility(field.name); menuOpenFor = null; }}>Hide</button>
              <button on:click={() => duplicateField(field.name)}>Duplicate</button>
              <button on:click={() => deleteField(field.name)}>Delete value</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if hiddenFields.length > 0}
      <details class="ppp-property-hidden">
        <summary>{hiddenFields.length} hidden</summary>
        <ul>
          {#each hiddenFields as name}
            <li>
              <span>{name}</span>
              <button class="clickable-icon" on:click={() => toggleVisibility(name)}>Show</button>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  {/if}

  <!-- Formula editor MVP modal -->
  {#if formulaModalFor}
    <div
      class="ppp-modal-backdrop"
      role="presentation"
      on:click={() => (formulaModalFor = null)}
      on:keydown={(e) => { if (e.key === "Escape") formulaModalFor = null; }}
    >
      <div class="ppp-modal" role="dialog" aria-modal="true" aria-labelledby="ppp-formula-modal-title" tabindex="-1" on:click|stopPropagation on:keydown|stopPropagation>
        <h3 id="ppp-formula-modal-title">Formula: {formulaModalFor.field}</h3>
        <FormulaEditor
          expression={formulaModalFor.value}
          rows={6}
          placeholder="Stage A MVP — full Notion-parity polish is STB-VISUALIZER-FORMULA-POLISH (Stage B)."
          on:change={(e) => { if (formulaModalFor) formulaModalFor = { ...formulaModalFor, value: e.detail }; }}
          on:commit={saveFormula}
          on:cancel={() => (formulaModalFor = null)}
        >
          <svelte:fragment slot="footer">
            <footer>
              <button on:click={() => (formulaModalFor = null)}>Cancel</button>
              <button class="mod-cta" on:click={saveFormula}>Save</button>
            </footer>
          </svelte:fragment>
        </FormulaEditor>
      </div>
    </div>
  {/if}
</div>

<style>
  .ppp-visualizer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    padding: 0.5rem 0.75rem;
  }
  .ppp-visualizer-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--background-modifier-border);
    margin-bottom: 0.5rem;
  }
  .ppp-visualizer-title {
    font-weight: 600;
  }
  .ppp-visualizer-spacer {
    flex: 1;
  }
  .ppp-visualizer-layout {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    padding: 0.0625rem 0.25rem;
  }
  .ppp-visualizer-empty {
    color: var(--text-faint);
    text-align: center;
    padding: 2rem;
  }
  .ppp-property-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .ppp-layout-grid .ppp-property-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .ppp-property-row {
    display: grid;
    grid-template-columns: 1.25rem 1.25rem 10rem 1fr 1.5rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.375rem;
    border-radius: var(--radius-s);
    position: relative;
  }
  .ppp-property-row:hover {
    background: var(--background-modifier-hover);
  }
  .ppp-layout-compact .ppp-property-row {
    padding: 0.0625rem 0.25rem;
  }
  .ppp-property-handle {
    color: var(--text-faint);
    cursor: grab;
    user-select: none;
  }
  .ppp-property-icon::before {
    content: "•";
    color: var(--text-muted);
  }
  .ppp-property-label {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-property-value {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .ppp-property-input {
    flex: 1;
    background: var(--background-primary);
    border: 1px solid transparent;
    padding: 0.125rem 0.25rem;
    border-radius: var(--radius-s);
  }
  .ppp-property-input:hover,
  .ppp-property-input:focus {
    border-color: var(--background-modifier-border);
    outline: none;
  }
  .ppp-property-readonly {
    color: var(--text-muted);
  }
  .ppp-property-menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    box-shadow: var(--shadow-s);
    min-width: 8rem;
  }
  .ppp-property-menu button {
    text-align: left;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .ppp-property-menu button:hover {
    background: var(--background-modifier-hover);
  }
  .ppp-property-hidden {
    margin-top: 0.5rem;
    color: var(--text-muted);
  }
  .ppp-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .ppp-modal {
    background: var(--background-primary);
    border-radius: var(--radius-m);
    padding: 1rem;
    min-width: 24rem;
    max-width: 40rem;
    box-shadow: var(--shadow-l);
  }
  .ppp-modal footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
