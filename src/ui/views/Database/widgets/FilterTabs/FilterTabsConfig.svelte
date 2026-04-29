<script lang="ts">
  /**
   * FilterTabsConfig — editor for FilterTabsWidget.
   * User picks a field to filter by + optionally defines manual tabs.
   * When tabs[] is empty, widget auto-extracts unique values at runtime.
   */
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { FilterTabConfig, FilterTabsConfig } from "../../types";
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import WidgetConfigShell from "../_shared/WidgetConfigShell.svelte";

  export let config: Record<string, unknown> = {};
  export let fields: DataField[] = [];
  /** Post-pipeline source; used to show unique-value preview to the user. */
  export let source: DataFrame | null = null;

  const dispatch = createEventDispatcher<{
    change: Record<string, unknown>;
    close: void;
  }>();

  $: field = (config["field"] as string) ?? "";
  $: tabs = ((config["tabs"] as FilterTabConfig[] | undefined) ?? []).slice();
  $: showAll = (config["showAll"] as boolean) ?? true;
  $: fieldNames = fields.map((f) => f.name);

  $: preview = source && field ? extractUnique(source, field) : [];

  function extractUnique(df: DataFrame, f: string): string[] {
    const seen = new Set<string>();
    for (const r of df.records) {
      const v = r.values[f];
      if (v != null && v !== "") seen.add(String(v));
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 16);
  }

  function emit(next: Partial<FilterTabsConfig>) {
    dispatch("change", { ...config, field, tabs, showAll, ...next });
  }

  function addTab(value: string = "") {
    const id = `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    emit({ tabs: [...tabs, { id, label: value || "Tab", field, value }] });
  }
  function updateTab(idx: number, patch: Partial<FilterTabConfig>) {
    emit({ tabs: tabs.map((t, i) => (i === idx ? { ...t, ...patch } : t)) });
  }
  function removeTab(idx: number) {
    emit({ tabs: tabs.filter((_, i) => i !== idx) });
  }
  function seedTabsFromUnique() {
    const seeded: FilterTabConfig[] = preview.map((v, i) => ({
      id: `tab_${i}_${Date.now()}`,
      label: v,
      field,
      value: v,
    }));
    emit({ tabs: seeded });
  }

  function inputVal(e: Event): string {
    return (e.currentTarget as HTMLInputElement).value;
  }
  function checkVal(e: Event): boolean {
    return (e.currentTarget as HTMLInputElement).checked;
  }
</script>

<WidgetConfigShell
  title={$i18n.t("views.database.filter-tabs.config.title", { defaultValue: "Filter tabs" })}
  subtitle={$i18n.t("views.database.filter-tabs.config.subtitle", { defaultValue: "Pick a field — the widget auto-builds tabs from unique values. Or define tabs manually for a fixed set." })}
  on:close={() => dispatch("close")}
>
  <div class="ppp-cfg-row">
    <label>
      {$i18n.t("views.database.filter-tabs.config.field", { defaultValue: "Filter field" })}
      <input
        type="text"
        list="ppp-ft-fields"
        value={field}
        on:input={(e) => emit({ field: inputVal(e) })}
      />
    </label>

    <label class="ppp-ft-showall">
      <input
        type="checkbox"
        checked={showAll}
        on:change={(e) => emit({ showAll: checkVal(e) })}
      />
      <span>{$i18n.t("views.database.filter-tabs.config.show-all", { defaultValue: "Include \"All\" tab" })}</span>
    </label>
  </div>

  {#if field && preview.length > 0 && tabs.length === 0}
    <div class="ppp-ft-preview">
      <div class="ppp-ft-preview-head">
        <span>
          {$i18n.t("views.database.filter-tabs.config.auto", { defaultValue: "Auto-detected values" })}
          ({preview.length})
        </span>
        <button
          type="button"
          class="ppp-ft-seed"
          on:click={seedTabsFromUnique}
          title={$i18n.t("views.database.filter-tabs.config.seed-tip", { defaultValue: "Copy values into editable tabs" })}
        >
          {$i18n.t("views.database.filter-tabs.config.seed", { defaultValue: "Use as tabs" })}
        </button>
      </div>
      <div class="ppp-ft-chips">
        {#each preview as v (v)}
          <span class="ppp-ft-chip">{v}</span>
        {/each}
      </div>
    </div>
  {/if}

  {#if tabs.length > 0}
    <div class="ppp-cfg-list">
      {#each tabs as t, idx (t.id)}
        <div class="ppp-cfg-item">
          <label>
            {$i18n.t("views.database.filter-tabs.config.tab-label", { defaultValue: "Label" })}
            <input
              type="text"
              value={t.label}
              on:input={(e) => updateTab(idx, { label: inputVal(e) })}
            />
          </label>
          <label>
            {$i18n.t("views.database.filter-tabs.config.tab-value", { defaultValue: "Value" })}
            <input
              type="text"
              value={t.value}
              on:input={(e) => updateTab(idx, { value: inputVal(e) })}
            />
          </label>
          <button
            type="button"
            class="ppp-cfg-remove"
            on:click={() => removeTab(idx)}
            aria-label={$i18n.t("common.remove", { defaultValue: "Remove" })}
            title={$i18n.t("common.remove", { defaultValue: "Remove" })}
          >✕</button>
        </div>
      {/each}
    </div>
  {/if}

  <button type="button" class="ppp-cfg-add" on:click={() => addTab("")}>
    + {$i18n.t("views.database.filter-tabs.config.add", { defaultValue: "Add tab" })}
  </button>

  <datalist id="ppp-ft-fields">
    {#each fieldNames as name (name)}
      <option value={name} />
    {/each}
  </datalist>
</WidgetConfigShell>

<style>
  .ppp-ft-showall {
    flex: 0 0 auto !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 0.3rem !important;
    white-space: nowrap;
  }
  .ppp-ft-preview {
    padding: 0.375rem 0.5rem;
    background: var(--background-modifier-hover);
    border-radius: var(--radius-s, 0.25rem);
  }
  .ppp-ft-preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }
  .ppp-ft-seed {
    padding: 0.125rem 0.5rem;
    font-size: var(--font-ui-smaller, 0.75rem);
    background: var(--interactive-normal);
    color: var(--text-normal);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }
  .ppp-ft-seed:hover {
    background: var(--interactive-hover);
  }
  .ppp-ft-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .ppp-ft-chip {
    padding: 0.125rem 0.375rem;
    font-size: var(--font-ui-smaller, 0.75rem);
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    color: var(--text-muted);
    white-space: nowrap;
  }
</style>
