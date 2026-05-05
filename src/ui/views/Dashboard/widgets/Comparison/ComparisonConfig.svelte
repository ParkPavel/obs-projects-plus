<script lang="ts">
  /**
   * ComparisonConfig — editor for ComparisonWidget metrics and layout.
   * Supports migration from legacy metricA/metricB to metrics[] on first save.
   */
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { ComparisonConfig, ComparisonMetric } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import WidgetConfigShell from "../_shared/WidgetConfigShell.svelte";

  export let config: Record<string, unknown> = {};
  export let fields: DataField[] = [];

  const dispatch = createEventDispatcher<{
    change: Record<string, unknown>;
    close: void;
  }>();

  /** Migrate legacy {metricA, metricB} to metrics[] */
  function normalizeMetrics(cfg: Record<string, unknown>): ComparisonMetric[] {
    const arr = cfg["metrics"] as ComparisonMetric[] | undefined;
    if (Array.isArray(arr) && arr.length > 0) return arr.slice();
    const metricA = String(cfg["metricA"] ?? "");
    const metricB = String(cfg["metricB"] ?? "");
    const out: ComparisonMetric[] = [];
    if (metricA) out.push({ field: metricA });
    if (metricB) out.push({ field: metricB });
    return out;
  }

  $: metrics = normalizeMetrics(config);
  $: mode = (config["mode"] as ComparisonConfig["mode"]) ?? "absolute";
  $: orientation = (config["orientation"] as ComparisonConfig["orientation"]) ?? "horizontal";
  $: showDelta = (config["showDelta"] as boolean) ?? false;
  $: fieldNames = fields.map((f) => f.name);

  function emit(next: Partial<ComparisonConfig> & { metrics?: ComparisonMetric[] }) {
    // Drop legacy keys once user saves a modern config
    const { metricA: _a, metricB: _b, ...rest } = config as Record<string, unknown>;
    dispatch("change", { ...rest, metrics, mode, orientation, showDelta, ...next });
  }

  function addMetric() {
    const first = fields[0]?.name ?? "";
    emit({ metrics: [...metrics, { field: first }] });
  }
  function updateMetric(idx: number, patch: Partial<ComparisonMetric>) {
    emit({ metrics: metrics.map((m, i) => (i === idx ? { ...m, ...patch } : m)) });
  }
  function removeMetric(idx: number) {
    emit({ metrics: metrics.filter((_, i) => i !== idx) });
  }

  function inputVal(e: Event): string {
    return (e.currentTarget as HTMLInputElement).value;
  }
  function selectVal(e: Event): string {
    return (e.currentTarget as HTMLSelectElement).value;
  }
  function checkVal(e: Event): boolean {
    return (e.currentTarget as HTMLInputElement).checked;
  }

  function onModeChange(e: Event) {
    const v = selectVal(e);
    emit({ mode: v === "absolute" || v === "percentage" || v === "normalized" ? v : "absolute" });
  }
  function onOrientationChange(e: Event) {
    const v = selectVal(e);
    emit({ orientation: v === "horizontal" || v === "vertical" ? v : "horizontal" });
  }
</script>

<WidgetConfigShell
  title={$i18n.t("views.dashboard.comparison.config.title", { defaultValue: "Comparison metrics" })}
  subtitle={$i18n.t("views.dashboard.comparison.config.subtitle", { defaultValue: "Each metric sums one numeric field across all records. Add two or more to compare." })}
  on:close={() => dispatch("close")}
>
  <div class="ppp-cfg-row">
    <label>
      {$i18n.t("views.dashboard.comparison.config.mode", { defaultValue: "Mode" })}
      <select value={mode} on:change={onModeChange}>
        <option value="absolute">{$i18n.t("views.dashboard.comparison.config.mode-absolute", { defaultValue: "Absolute" })}</option>
        <option value="percentage">{$i18n.t("views.dashboard.comparison.config.mode-percentage", { defaultValue: "Percentage" })}</option>
        <option value="normalized">{$i18n.t("views.dashboard.comparison.config.mode-normalized", { defaultValue: "Normalized" })}</option>
      </select>
    </label>

    <label>
      {$i18n.t("views.dashboard.comparison.config.orientation", { defaultValue: "Orientation" })}
      <select value={orientation} on:change={onOrientationChange}>
        <option value="horizontal">{$i18n.t("views.dashboard.comparison.config.orient-horizontal", { defaultValue: "Horizontal" })}</option>
        <option value="vertical">{$i18n.t("views.dashboard.comparison.config.orient-vertical", { defaultValue: "Vertical" })}</option>
      </select>
    </label>

    <label class="ppp-cmp-delta">
      <input
        type="checkbox"
        checked={showDelta}
        on:change={(e) => emit({ showDelta: checkVal(e) })}
      />
      <span>{$i18n.t("views.dashboard.comparison.config.show-delta", { defaultValue: "Show delta" })}</span>
    </label>
  </div>

  {#if metrics.length === 0}
    <p class="ppp-cmp-hint">
      {$i18n.t("views.dashboard.comparison.config.empty", { defaultValue: "No metrics yet. Add one to pick a numeric field to compare." })}
    </p>
  {/if}

  <div class="ppp-cfg-list">
    {#each metrics as m, idx (idx)}
      <div class="ppp-cfg-item">
        <label>
          {$i18n.t("views.dashboard.comparison.config.field", { defaultValue: "Field" })}
          <input
            type="text"
            list="ppp-cmp-fields"
            value={m.field}
            on:input={(e) => updateMetric(idx, { field: inputVal(e) })}
          />
        </label>
        <label>
          {$i18n.t("views.dashboard.comparison.config.label", { defaultValue: "Label" })}
          <input
            type="text"
            value={m.label ?? ""}
            placeholder={m.field}
            on:input={(e) => {
              const v = inputVal(e);
              updateMetric(idx, v ? { label: v } : { label: "" });
            }}
          />
        </label>
        <label class="ppp-cmp-color">
          {$i18n.t("views.dashboard.comparison.config.color", { defaultValue: "Color" })}
          <input
            type="color"
            value={m.color ?? "#6a6a8f"}
            on:input={(e) => updateMetric(idx, { color: inputVal(e) })}
          />
        </label>
        <button
          type="button"
          class="ppp-cfg-remove"
          on:click={() => removeMetric(idx)}
          aria-label={$i18n.t("common.remove", { defaultValue: "Remove" })}
          title={$i18n.t("common.remove", { defaultValue: "Remove" })}
        >✕</button>
      </div>
    {/each}
  </div>

  <button type="button" class="ppp-cfg-add" on:click={addMetric}>
    + {$i18n.t("views.dashboard.comparison.config.add", { defaultValue: "Add metric" })}
  </button>

  <datalist id="ppp-cmp-fields">
    {#each fieldNames as name (name)}
      <option value={name} />
    {/each}
  </datalist>
</WidgetConfigShell>

<style>
  .ppp-cmp-hint {
    margin: 0;
    padding: 0.375rem 0.5rem;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
    background: var(--background-modifier-hover);
    border-radius: var(--radius-s, 0.25rem);
  }
  .ppp-cmp-delta {
    flex: 0 0 auto !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 0.3rem !important;
    white-space: nowrap;
  }
  .ppp-cmp-color {
    flex: 0 0 5rem !important;
  }
  .ppp-cmp-color input[type="color"] {
    width: 100%;
    height: 1.75rem;
    padding: 0.125rem;
    cursor: pointer;
  }
</style>
