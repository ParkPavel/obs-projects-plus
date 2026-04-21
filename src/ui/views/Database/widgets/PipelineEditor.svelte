<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type {
    TransformPipeline,
    TransformStep,
    AggregationFunction,
    FilterStep,
    AggregateStep,
    ComputeStep,
    UnpivotStep,
  } from "../engine/transformTypes";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { FilterCondition } from "src/settings/base/settings";
  import { i18n } from "src/lib/stores/i18n";
  import { get } from "svelte/store";
  import { getOperatorsForField, operatorNeedsValue, getOperatorLabel } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";

  export let pipeline: TransformPipeline;
  export let fields: DataField[] = [];

  const dispatch = createEventDispatcher<{
    save: TransformPipeline;
    cancel: void;
  }>();

  let steps: TransformStep[] = [...pipeline.steps];
  let expandedStep: number | null = null;
  let showDiscardConfirm = false;

  $: isDirty = JSON.stringify(steps) !== JSON.stringify(pipeline.steps);
  $: fieldNames = fields.map(f => f.name);
  $: fieldMap = new Map(fields.map(f => [f.name, f]));

  const AGG_FUNCTIONS: AggregationFunction[] = [
    "SUM", "AVG", "MEDIAN", "MIN", "MAX", "RANGE",
    "COUNT", "COUNT_DISTINCT", "FIRST", "LAST",
    "STD_DEV", "PCT_EMPTY", "PCT_NOT_EMPTY",
  ];

  const STEP_TYPES: { value: TransformStep["type"]; labelKey: string; icon: string }[] = [
    { value: "filter", labelKey: "views.database.pipeline.filter", icon: "🔍" },
    { value: "group-by", labelKey: "views.database.pipeline.group-by", icon: "📊" },
    { value: "aggregate", labelKey: "views.database.pipeline.aggregate", icon: "∑" },
    { value: "compute", labelKey: "views.database.pipeline.compute", icon: "ƒ" },
    { value: "unpivot", labelKey: "views.database.pipeline.unpivot", icon: "↕" },
    { value: "pivot", labelKey: "views.database.pipeline.pivot", icon: "↔" },
    { value: "unnest", labelKey: "views.database.pipeline.unnest", icon: "⊞" },
  ];

  function addStep(type: TransformStep["type"]) {
    const newStep = createDefaultStep(type);
    if (newStep) {
      steps = [...steps, newStep];
      expandedStep = steps.length - 1;
    }
  }

  function removeStep(index: number) {
    steps = steps.filter((_, i) => i !== index);
    if (expandedStep === index) expandedStep = null;
    else if (expandedStep !== null && expandedStep > index) expandedStep--;
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const copy = [...steps];
    const temp = copy[index]!;
    copy[index] = copy[target]!;
    copy[target] = temp;
    steps = copy;
    if (expandedStep === index) expandedStep = target;
    else if (expandedStep === target) expandedStep = index;
  }

  function updateStep(index: number, step: TransformStep) {
    steps[index] = step;
    steps = [...steps];
  }

  function createDefaultStep(type: TransformStep["type"]): TransformStep | null {
    switch (type) {
      case "filter":
        return { type: "filter", conditions: { conjunction: "and", conditions: [] } };
      case "group-by":
        return { type: "group-by", fields: [] };
      case "aggregate":
        return { type: "aggregate", columns: [] };
      case "compute":
        return { type: "compute", columns: [] };
      case "unpivot":
        return { type: "unpivot", fieldGroups: [], keepFields: [] };
      case "pivot":
        return { type: "pivot", categoryField: "", valueField: "", aggregation: "SUM" };
      case "unnest":
        return { type: "unnest", field: "" };
      default:
        return null;
    }
  }

  function stepLabel(step: TransformStep): string {
    const t = get(i18n).t.bind(get(i18n));
    switch (step.type) {
      case "filter": {
        const n = step.conditions.conditions.length + (step.conditions.groups?.length ?? 0);
        return n > 0 ? `${t("views.database.pipeline.filter")} (${n})` : t("views.database.pipeline.filter");
      }
      case "group-by": return `${t("views.database.pipeline.group-by")}: ${step.fields.join(", ") || "—"}`;
      case "aggregate": return `${t("views.database.pipeline.aggregate")}: ${step.columns.length}`;
      case "compute": return `${t("views.database.pipeline.compute")}: ${step.columns.length}`;
      case "unpivot": return `${t("views.database.pipeline.unpivot")}: ${step.fieldGroups.length}`;
      case "pivot": return `${t("views.database.pipeline.pivot")}: ${step.categoryField || "—"}`;
      case "unnest": return `${t("views.database.pipeline.unnest", { defaultValue: "Unnest" })}: ${step.field || "—"}`;
      default: return "?";
    }
  }

  function stepIcon(type: string): string {
    return STEP_TYPES.find(s => s.value === type)?.icon ?? "•";
  }

  // ── Filter step helpers ──────────────────────────────────

  function addFilterCondition(stepIndex: number) {
    const step = steps[stepIndex] as FilterStep;
    const firstField = fieldNames[0] ?? "";
    const fieldType = fieldMap.get(firstField)?.type ?? "string";
    const ops = getOperatorsForField(fieldType as string);
    const newCond: FilterCondition = {
      field: firstField,
      operator: ops[0] ?? "is-empty",
      value: "",
      enabled: true,
    };
    updateStep(stepIndex, {
      ...step,
      conditions: {
        ...step.conditions,
        conditions: [...step.conditions.conditions, newCond],
      },
    });
  }

  function updateFilterField(stepIndex: number, condIndex: number, newField: string) {
    const step = steps[stepIndex] as FilterStep;
    const conds = [...step.conditions.conditions];
    const prev = conds[condIndex]!;
    const newType = fieldMap.get(newField)?.type ?? "string";
    const newOps = getOperatorsForField(newType as string);
    conds[condIndex] = { field: newField, operator: newOps[0] ?? "is-empty", value: "", enabled: prev.enabled };
    updateStep(stepIndex, { ...step, conditions: { ...step.conditions, conditions: conds } });
  }

  function updateFilterOperator(stepIndex: number, condIndex: number, op: string) {
    const step = steps[stepIndex] as FilterStep;
    const conds = [...step.conditions.conditions];
    const prev = conds[condIndex]!;
    conds[condIndex] = { field: prev.field, operator: op as FilterCondition["operator"], value: prev.value ?? "", enabled: prev.enabled };
    updateStep(stepIndex, { ...step, conditions: { ...step.conditions, conditions: conds } });
  }

  function updateFilterValue(stepIndex: number, condIndex: number, val: string) {
    const step = steps[stepIndex] as FilterStep;
    const conds = [...step.conditions.conditions];
    const prev = conds[condIndex]!;
    conds[condIndex] = { field: prev.field, operator: prev.operator, value: val, enabled: prev.enabled };
    updateStep(stepIndex, { ...step, conditions: { ...step.conditions, conditions: conds } });
    updateStep(stepIndex, {
      ...step,
      conditions: { ...step.conditions, conditions: conds },
    });
  }

  function removeFilterCondition(stepIndex: number, condIndex: number) {
    const step = steps[stepIndex] as FilterStep;
    updateStep(stepIndex, {
      ...step,
      conditions: {
        ...step.conditions,
        conditions: step.conditions.conditions.filter((_, j) => j !== condIndex),
      },
    });
  }

  // ── Aggregate step helpers ───────────────────────────────

  function addAggColumn(stepIndex: number) {
    const step = steps[stepIndex] as AggregateStep;
    const firstField = fieldNames[0] ?? "";
    updateStep(stepIndex, {
      ...step,
      columns: [...step.columns, { sourceField: firstField, function: "SUM", outputName: `${firstField}_sum` }],
    });
  }

  function updateAggColumn(stepIndex: number, colIndex: number, field: string, fn: string) {
    const step = steps[stepIndex] as AggregateStep;
    const cols = [...step.columns];
    cols[colIndex] = { sourceField: field, function: fn as AggregationFunction, outputName: `${field}_${fn.toLowerCase()}` };
    updateStep(stepIndex, { ...step, columns: cols });
  }

  function removeAggColumn(stepIndex: number, colIndex: number) {
    const step = steps[stepIndex] as AggregateStep;
    updateStep(stepIndex, {
      ...step,
      columns: step.columns.filter((_, j) => j !== colIndex),
    });
  }

  // ── Compute step helpers ─────────────────────────────────

  function addComputeColumn(stepIndex: number) {
    const step = steps[stepIndex] as ComputeStep;
    updateStep(stepIndex, {
      ...step,
      columns: [...step.columns, { name: `computed_${step.columns.length + 1}`, expression: "" }],
    });
  }

  function updateComputeColumn(stepIndex: number, colIndex: number, name: string, expression: string) {
    const step = steps[stepIndex] as ComputeStep;
    const cols = [...step.columns];
    cols[colIndex] = { name, expression };
    updateStep(stepIndex, { ...step, columns: cols });
  }

  function removeComputeColumn(stepIndex: number, colIndex: number) {
    const step = steps[stepIndex] as ComputeStep;
    updateStep(stepIndex, {
      ...step,
      columns: step.columns.filter((_, j) => j !== colIndex),
    });
  }

  // ── Unpivot step helpers ─────────────────────────────────

  function toggleUnpivotKeep(stepIndex: number, fieldName: string) {
    const step = steps[stepIndex] as UnpivotStep;
    const keeps = step.keepFields.includes(fieldName)
      ? step.keepFields.filter(f => f !== fieldName)
      : [...step.keepFields, fieldName];
    updateStep(stepIndex, { ...step, keepFields: keeps });
  }

  function addUnpivotGroup(stepIndex: number) {
    const step = steps[stepIndex] as UnpivotStep;
    updateStep(stepIndex, {
      ...step,
      fieldGroups: [...step.fieldGroups, { pattern: "", outputName: `group_${step.fieldGroups.length + 1}` }],
    });
  }

  function updateUnpivotGroup(stepIndex: number, gIndex: number, pattern: string, outputName: string) {
    const step = steps[stepIndex] as UnpivotStep;
    const groups = [...step.fieldGroups];
    groups[gIndex] = { pattern, outputName };
    updateStep(stepIndex, { ...step, fieldGroups: groups });
  }

  function removeUnpivotGroup(stepIndex: number, gIndex: number) {
    const step = steps[stepIndex] as UnpivotStep;
    updateStep(stepIndex, {
      ...step,
      fieldGroups: step.fieldGroups.filter((_, j) => j !== gIndex),
    });
  }

  // ── Pivot aggregation helper ─────────────────────────────

  function updatePivotAggregation(stepIndex: number, value: string) {
    const step = steps[stepIndex]!;
    if (step.type !== "pivot") return;
    updateStep(stepIndex, { ...step, aggregation: value as AggregationFunction });
  }

  // ── Event value helpers (Svelte 3 templates don't support `as` casts) ──

  function selectVal(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  function inputVal(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  function checkVal(e: Event): boolean {
    return (e.currentTarget as HTMLInputElement).checked;
  }

  function handleSave() {
    dispatch("save", { steps });
  }

  function handleCancel() {
    if (isDirty) {
      showDiscardConfirm = true;
    } else {
      dispatch("cancel");
    }
  }

  function confirmDiscard() {
    showDiscardConfirm = false;
    dispatch("cancel");
  }
</script>

<div class="ppp-pipeline-editor">
  {#if isDirty}
    <div class="ppp-pipeline-dirty-banner">
      <span>⚠ {$i18n.t("views.database.pipeline.unsaved-changes")}</span>
    </div>
  {/if}

  <div class="ppp-pipeline-header">
    <span class="ppp-pipeline-title">{$i18n.t("views.database.pipeline.title")}</span>
    <span class="ppp-pipeline-count">{steps.length} {$i18n.t("views.database.pipeline.steps")}</span>
  </div>

  <div class="ppp-pipeline-steps">
    {#if steps.length === 0}
      <div class="ppp-pipeline-empty">
        {$i18n.t("views.database.pipeline.empty")}
      </div>
    {/if}

    {#each steps as step, i (i)}
      <div class="ppp-pipeline-step" class:ppp-pipeline-step--expanded={expandedStep === i}>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div class="ppp-step-summary" role="button" tabindex="0" on:click={() => expandedStep = expandedStep === i ? null : i}>
          <span class="ppp-step-number">{i + 1}</span>
          <span class="ppp-step-icon">{stepIcon(step.type)}</span>
          <span class="ppp-step-label">{stepLabel(step)}</span>
          <div class="ppp-step-actions">
            <button
              class="ppp-step-btn"
              disabled={i === 0}
              title={$i18n.t("views.database.pipeline.move-up")}
              on:click|stopPropagation={() => moveStep(i, -1)}
            >↑</button>
            <button
              class="ppp-step-btn"
              disabled={i === steps.length - 1}
              title={$i18n.t("views.database.pipeline.move-down")}
              on:click|stopPropagation={() => moveStep(i, 1)}
            >↓</button>
            <button
              class="ppp-step-btn ppp-step-btn--danger"
              title={$i18n.t("views.database.pipeline.remove")}
              on:click|stopPropagation={() => removeStep(i)}
            >✕</button>
          </div>
        </div>

        {#if expandedStep === i}
          <div class="ppp-step-config">

            <!-- ═══ FILTER ═══ -->
            {#if step.type === "filter"}
              <div class="ppp-filter-conjunction">
                <span>{$i18n.t("views.database.pipeline.match", { defaultValue: "Match" })}</span>
                <select
                  value={step.conditions.conjunction ?? "and"}
                  on:change={(e) => {
                    const v = selectVal(e);
                    updateStep(i, { ...step, conditions: { ...step.conditions, conjunction: v === "or" ? "or" : "and" } });
                  }}
                >
                  <option value="and">{$i18n.t("views.database.pipeline.all-conditions", { defaultValue: "ALL conditions (AND)" })}</option>
                  <option value="or">{$i18n.t("views.database.pipeline.any-condition", { defaultValue: "ANY condition (OR)" })}</option>
                </select>
              </div>

              {#each step.conditions.conditions as cond, ci}
                {@const fieldType = (fieldMap.get(cond.field)?.type ?? "string")}
                {@const operators = getOperatorsForField(fieldType)}
                <div class="ppp-filter-row">
                  <select
                    class="ppp-filter-field-select"
                    value={cond.field}
                    on:change={(e) => updateFilterField(i, ci, selectVal(e))}
                  >
                    <option value="">{$i18n.t("views.database.pipeline.select-field", { defaultValue: "— Field —" })}</option>
                    {#each fieldNames as name}
                      <option value={name}>{name}</option>
                    {/each}
                  </select>
                  <select
                    class="ppp-filter-op-select"
                    value={cond.operator}
                    on:change={(e) => updateFilterOperator(i, ci, selectVal(e))}
                  >
                    {#each operators as op}
                      <option value={op}>{getOperatorLabel(op)}</option>
                    {/each}
                  </select>
                  {#if operatorNeedsValue(cond.operator)}
                    <input
                      class="ppp-filter-value-input"
                      type="text"
                      value={cond.value ?? ""}
                      placeholder={$i18n.t("views.database.pipeline.value", { defaultValue: "Value" })}
                      on:change={(e) => updateFilterValue(i, ci, inputVal(e))}
                    />
                  {/if}
                  <button class="ppp-step-btn ppp-step-btn--danger" on:click={() => removeFilterCondition(i, ci)}>✕</button>
                </div>
              {/each}

              <button class="ppp-add-row-btn" on:click={() => addFilterCondition(i)}>
                + {$i18n.t("views.database.pipeline.add-condition", { defaultValue: "Add condition" })}
              </button>

            <!-- ═══ GROUP-BY ═══ -->
            {:else if step.type === "group-by"}
              <label class="ppp-step-field">
                <span>{$i18n.t("views.database.pipeline.group-field", { defaultValue: "Group by field" })}</span>
                <select
                  value={step.fields[0] ?? ""}
                  on:change={(e) => {
                    const val = e.currentTarget.value;
                    updateStep(i, { ...step, fields: val ? [val] : [] });
                  }}
                >
                  <option value="">{$i18n.t("views.database.pipeline.select-field", { defaultValue: "— Select field —" })}</option>
                  {#each fieldNames as name}
                    <option value={name}>{name}</option>
                  {/each}
                </select>
              </label>

            <!-- ═══ AGGREGATE ═══ -->
            {:else if step.type === "aggregate"}
              {#each step.columns as col, ci}
                <div class="ppp-agg-row">
                  <select
                    class="ppp-agg-field-select"
                    value={col.sourceField}
                    on:change={(e) => updateAggColumn(i, ci, e.currentTarget.value, col.function)}
                  >
                    <option value="">{$i18n.t("views.database.pipeline.select-field", { defaultValue: "— Field —" })}</option>
                    {#each fieldNames as name}
                      <option value={name}>{name}</option>
                    {/each}
                  </select>
                  <select
                    class="ppp-agg-fn-select"
                    value={col.function}
                    on:change={(e) => updateAggColumn(i, ci, col.sourceField, selectVal(e))}
                  >
                    {#each AGG_FUNCTIONS as fn}
                      <option value={fn}>{fn}</option>
                    {/each}
                  </select>
                  <button class="ppp-step-btn ppp-step-btn--danger" on:click={() => removeAggColumn(i, ci)}>✕</button>
                </div>
              {/each}
              <button class="ppp-add-row-btn" on:click={() => addAggColumn(i)}>
                + {$i18n.t("views.database.pipeline.add-aggregation", { defaultValue: "Add aggregation" })}
              </button>

            <!-- ═══ COMPUTE ═══ -->
            {:else if step.type === "compute"}
              {#each step.columns as col, ci}
                <div class="ppp-compute-row">
                  <input
                    class="ppp-compute-name"
                    type="text"
                    placeholder={$i18n.t("views.database.pipeline.column-name", { defaultValue: "Column name" })}
                    value={col.name}
                    on:change={(e) => updateComputeColumn(i, ci, e.currentTarget.value, col.expression)}
                  />
                  <input
                    class="ppp-compute-expr"
                    type="text"
                    placeholder="e.g. fieldA + fieldB * 2"
                    value={col.expression}
                    on:change={(e) => updateComputeColumn(i, ci, col.name, e.currentTarget.value)}
                  />
                  <button class="ppp-step-btn ppp-step-btn--danger" on:click={() => removeComputeColumn(i, ci)}>✕</button>
                </div>
              {/each}
              <button class="ppp-add-row-btn" on:click={() => addComputeColumn(i)}>
                + {$i18n.t("views.database.pipeline.add-column", { defaultValue: "Add computed column" })}
              </button>

            <!-- ═══ PIVOT ═══ -->
            {:else if step.type === "pivot"}
              <label class="ppp-step-field">
                <span>{$i18n.t("views.database.pipeline.category-field", { defaultValue: "Category field" })}</span>
                <select
                  value={step.categoryField}
                  on:change={(e) => updateStep(i, { ...step, categoryField: e.currentTarget.value })}
                >
                  <option value="">{$i18n.t("views.database.pipeline.select-field", { defaultValue: "— Select field —" })}</option>
                  {#each fieldNames as name}
                    <option value={name}>{name}</option>
                  {/each}
                </select>
              </label>
              <label class="ppp-step-field">
                <span>{$i18n.t("views.database.pipeline.value-field", { defaultValue: "Value field" })}</span>
                <select
                  value={step.valueField}
                  on:change={(e) => updateStep(i, { ...step, valueField: e.currentTarget.value })}
                >
                  <option value="">{$i18n.t("views.database.pipeline.select-field", { defaultValue: "— Select field —" })}</option>
                  {#each fieldNames as name}
                    <option value={name}>{name}</option>
                  {/each}
                </select>
              </label>
              <label class="ppp-step-field">
                <span>{$i18n.t("views.database.pipeline.aggregation-fn", { defaultValue: "Aggregation function" })}</span>
                <select
                  value={step.aggregation}
                  on:change={(e) => updatePivotAggregation(i, selectVal(e))}
                >
                  {#each AGG_FUNCTIONS as fn}
                    <option value={fn}>{fn}</option>
                  {/each}
                </select>
              </label>

            <!-- ═══ UNPIVOT ═══ -->
            {:else if step.type === "unpivot"}
              <div class="ppp-unpivot-section">
                <span class="ppp-section-label">{$i18n.t("views.database.pipeline.keep-fields", { defaultValue: "Keep fields (ID columns)" })}</span>
                <div class="ppp-chip-list">
                  {#each fieldNames as name}
                    <button
                      class="ppp-chip"
                      class:ppp-chip--active={step.keepFields.includes(name)}
                      on:click={() => toggleUnpivotKeep(i, name)}
                    >{name}</button>
                  {/each}
                </div>
              </div>

              <div class="ppp-unpivot-section">
                <span class="ppp-section-label">{$i18n.t("views.database.pipeline.field-groups", { defaultValue: "Field groups (columns to unpivot)" })}</span>
                {#each step.fieldGroups as group, gi}
                  <div class="ppp-unpivot-row">
                    <input
                      type="text"
                      placeholder={$i18n.t("views.database.pipeline.pattern", { defaultValue: "Pattern (regex)" })}
                      value={group.pattern}
                      on:change={(e) => updateUnpivotGroup(i, gi, e.currentTarget.value, group.outputName)}
                    />
                    <input
                      type="text"
                      placeholder={$i18n.t("views.database.pipeline.output-name", { defaultValue: "Output name" })}
                      value={group.outputName}
                      on:change={(e) => updateUnpivotGroup(i, gi, group.pattern, e.currentTarget.value)}
                    />
                    <button class="ppp-step-btn ppp-step-btn--danger" on:click={() => removeUnpivotGroup(i, gi)}>✕</button>
                  </div>
                {/each}
                <button class="ppp-add-row-btn" on:click={() => addUnpivotGroup(i)}>
                  + {$i18n.t("views.database.pipeline.add-group", { defaultValue: "Add group" })}
                </button>
              </div>

            <!-- ═══ UNNEST ═══ -->
            {:else if step.type === "unnest"}
              <label class="ppp-step-field">
                <span>{$i18n.t("views.database.pipeline.source-field", { defaultValue: "Array field to expand" })}</span>
                <select
                  value={step.field}
                  on:change={(e) => updateStep(i, { ...step, field: e.currentTarget.value })}
                >
                  <option value="">{$i18n.t("views.database.pipeline.select-field", { defaultValue: "— Select field —" })}</option>
                  {#each fieldNames as name}
                    <option value={name}>{name}</option>
                  {/each}
                </select>
              </label>
              <label class="ppp-step-field">
                <span>{$i18n.t("views.database.pipeline.prefix", { defaultValue: "Prefix for extracted fields" })}</span>
                <input
                  type="text"
                  placeholder={$i18n.t("views.database.pipeline.optional", { defaultValue: "Optional" })}
                  value={step.prefix ?? ""}
                  on:change={(e) => { const v = inputVal(e); updateStep(i, v ? { ...step, prefix: v } : { ...step }); }}
                />
              </label>
              <label class="ppp-step-field ppp-step-field--row">
                <input
                  type="checkbox"
                  checked={step.keepOriginal ?? false}
                  on:change={(e) => updateStep(i, { ...step, keepOriginal: checkVal(e) })}
                />
                <span>{$i18n.t("views.database.pipeline.keep-original", { defaultValue: "Keep original array field" })}</span>
              </label>

            {:else}
              <span class="ppp-step-hint">{$i18n.t("views.database.pipeline.config-hint", { defaultValue: "No configuration available" })}</span>
            {/if}

          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="ppp-pipeline-add">
    <span class="ppp-pipeline-add-label">{$i18n.t("views.database.pipeline.add-step")}</span>
    {#each STEP_TYPES as st}
      <button
        class="ppp-pipeline-add-btn"
        on:click={() => addStep(st.value)}
        title={$i18n.t(st.labelKey)}
      >
        <span class="ppp-pipeline-add-icon">{st.icon}</span>
        {$i18n.t(st.labelKey)}
      </button>
    {/each}
  </div>

  <div class="ppp-pipeline-footer">
    <button class="ppp-btn ppp-btn--secondary" on:click={handleCancel}>
      {$i18n.t("views.database.pipeline.cancel")}
    </button>
    <button class="ppp-btn ppp-btn--primary" on:click={handleSave}>
      {$i18n.t("views.database.pipeline.save")}
    </button>
  </div>

  {#if showDiscardConfirm}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="ppp-pipeline-confirm-overlay" role="dialog" aria-modal="true" on:click|self={() => showDiscardConfirm = false}>
      <div class="ppp-pipeline-confirm">
        <p>{$i18n.t("views.database.pipeline.discard-confirm")}</p>
        <div class="ppp-pipeline-confirm-actions">
          <button class="ppp-btn ppp-btn--secondary" on:click={() => showDiscardConfirm = false}>
            {$i18n.t("views.database.pipeline.keep-editing")}
          </button>
          <button class="ppp-btn ppp-btn--danger" on:click={confirmDiscard}>
            {$i18n.t("views.database.pipeline.discard")}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .ppp-pipeline-editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 6px);
    max-width: 40rem;
  }

  .ppp-pipeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .ppp-pipeline-title {
    font-weight: 600;
    color: var(--text-normal);
  }

  .ppp-pipeline-count {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .ppp-pipeline-steps {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ppp-pipeline-empty {
    padding: 1rem;
    text-align: center;
    color: var(--text-faint);
    font-size: var(--font-ui-small);
  }

  .ppp-pipeline-step {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
  }

  .ppp-pipeline-step--expanded {
    border-color: var(--interactive-accent);
  }

  .ppp-step-summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    cursor: pointer;
    border-radius: var(--radius-s, 4px);
  }

  .ppp-step-summary:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-step-config {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem 0.625rem 2.25rem;
    border-top: 1px dashed var(--background-modifier-border);
  }

  .ppp-step-field {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .ppp-step-field--row {
    flex-direction: row;
    align-items: center;
    gap: 0.375rem;
  }

  .ppp-step-field select,
  .ppp-step-field input[type="text"] {
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-small);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
  }

  .ppp-step-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    font-style: italic;
  }

  .ppp-step-number {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
  }

  .ppp-step-icon {
    flex-shrink: 0;
    font-size: var(--font-ui-small);
  }

  .ppp-step-label {
    flex: 1;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-step-actions {
    display: flex;
    gap: 0.125rem;
  }

  .ppp-step-btn {
    padding: 0.125rem 0.375rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    border-radius: var(--radius-s, 4px);
  }

  .ppp-step-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-step-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .ppp-step-btn--danger:hover:not(:disabled) {
    color: var(--text-error);
  }

  /* ── Filter rows ── */
  .ppp-filter-conjunction {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .ppp-filter-conjunction select {
    padding: 0.125rem 0.25rem;
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
  }

  .ppp-filter-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .ppp-filter-field-select {
    min-width: 7rem;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
  }

  .ppp-filter-op-select {
    min-width: 5rem;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
  }

  .ppp-filter-value-input {
    flex: 1;
    min-width: 5rem;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
  }

  /* ── Aggregate rows ── */
  .ppp-agg-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ppp-agg-field-select,
  .ppp-agg-fn-select {
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
  }

  .ppp-agg-field-select {
    flex: 1;
    min-width: 7rem;
  }

  .ppp-agg-fn-select {
    min-width: 6rem;
  }

  /* ── Compute rows ── */
  .ppp-compute-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ppp-compute-name {
    width: 8rem;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
  }

  .ppp-compute-expr {
    flex: 1;
    min-width: 8rem;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
    font-family: var(--font-monospace);
  }

  /* ── Unpivot ── */
  .ppp-unpivot-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ppp-section-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    font-weight: 500;
  }

  .ppp-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .ppp-chip {
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .ppp-chip:hover {
    border-color: var(--interactive-accent);
    color: var(--text-normal);
  }

  .ppp-chip--active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .ppp-unpivot-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ppp-unpivot-row input {
    flex: 1;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-normal);
  }

  /* ── Add row button ── */
  .ppp-add-row-btn {
    align-self: flex-start;
    padding: 0.25rem 0.5rem;
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    background: none;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .ppp-add-row-btn:hover {
    border-color: var(--interactive-accent);
    color: var(--text-accent);
  }

  /* ── Pipeline add / footer ── */
  .ppp-pipeline-add {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: center;
  }

  .ppp-pipeline-add-label {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .ppp-pipeline-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    background: none;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .ppp-pipeline-add-btn:hover {
    border-color: var(--interactive-accent);
    color: var(--text-accent);
    background: var(--background-modifier-hover);
  }

  .ppp-pipeline-add-icon {
    font-size: var(--font-ui-small);
  }

  .ppp-pipeline-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .ppp-btn {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: var(--radius-s, 4px);
    font-size: var(--font-ui-small);
    cursor: pointer;
  }

  .ppp-btn--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-btn--primary:hover {
    background: var(--interactive-accent-hover);
  }

  .ppp-btn--secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-btn--secondary:hover {
    background: var(--background-modifier-border);
  }

  .ppp-btn--danger {
    background: var(--background-modifier-error);
    color: var(--text-on-accent);
    border: none;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-s, 4px);
    cursor: pointer;
  }

  .ppp-btn--danger:hover {
    filter: brightness(0.9);
  }

  .ppp-pipeline-dirty-banner {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: var(--background-modifier-error-hover, rgba(255, 59, 48, 0.1));
    border-radius: var(--radius-s, 4px);
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    font-weight: 500;
  }

  .ppp-pipeline-confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ppp-pipeline-confirm {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 6px);
    padding: 1.25rem;
    max-width: 24rem;
    box-shadow: var(--shadow-s);
  }

  .ppp-pipeline-confirm p {
    margin: 0 0 1rem;
    color: var(--text-normal);
  }

  .ppp-pipeline-confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
