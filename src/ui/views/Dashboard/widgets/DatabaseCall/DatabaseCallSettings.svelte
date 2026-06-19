<script lang="ts">
  /**
   * NPLAN-V7.1 — Settings panel for `database-call` widgets.
   *
   * Lets the user pick an independent data source (any sibling project)
   * instead of inheriting the canvas's parent frame. Opened via the widget
   * header cog button; rendered inline (not modal) per invariant §10.
   */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import WidgetConfigShell from "../_shared/WidgetConfigShell.svelte";
  import { detectArrayFields } from "../_shared/arrayFieldDetection";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { WidgetSourceConfig, LinkedSelectionConfig } from "../../types";
  import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";

  export let sourceConfig: WidgetSourceConfig | undefined = undefined;
  export let availableSources: Array<{ id: string; name: string }> = [];
  export let availableWidgets: Array<{ id: string; title: string }> = [];
  export let fields: DataField[] = [];
  export let linkedSelection: LinkedSelectionConfig | undefined = undefined;
  export let transform: TransformPipeline = { steps: [] };
  export let source: { records: Array<{ values: Record<string, unknown> }> } | null = null;

  const dispatch = createEventDispatcher<{
    change: WidgetSourceConfig;
    close: void;
    linkedSelectionChange: LinkedSelectionConfig | undefined;
    transformChange: TransformPipeline;
  }>();

  $: currentProjectId = sourceConfig?.projectId ?? "";
  $: currentLinkedId = linkedSelection?.sourceWidgetId ?? "";
  $: currentRelationField = linkedSelection?.relationField ?? "";

  // #099.3 — "Развернуть список": unnest exposed as a block property. Single
  // source of truth is widget.transform; we only surface the first array field
  // already targeted by an unnest step as active.
  $: arrayFields = detectArrayFieldsForPicker(source, fields, transform.steps);
  $: activeUnnestField = transform.steps.find((s) => s.type === "unnest")?.field ?? "";

  function detectArrayFieldsForPicker(
    src: { records: Array<{ values: Record<string, unknown> }> } | null,
    flds: DataField[],
    steps: TransformPipeline["steps"],
  ): string[] {
    // Include the already-unnested field so the picker can show the active choice.
    const detected = detectArrayFields(src, flds, []);
    const active = steps.find((s) => s.type === "unnest")?.field;
    if (active && !detected.includes(active)) detected.push(active);
    return detected;
  }

  function setUnnestField(field: string) {
    if (!field) {
      dispatch("transformChange", {
        steps: transform.steps.filter((s) => !(s.type === "unnest" && s.field === activeUnnestField)),
      });
      return;
    }
    const rest = transform.steps.filter((s) => !(s.type === "unnest" && s.field === field));
    dispatch("transformChange", { steps: [{ type: "unnest", field }, ...rest] });
  }

  function toggleUnnest(field: string, on: boolean) {
    if (on) setUnnestField(field);
    else {
      dispatch("transformChange", {
        steps: transform.steps.filter((s) => !(s.type === "unnest" && s.field === field)),
      });
    }
  }

  function handleUnnestToggle(e: Event) {
    const on = (e.currentTarget as HTMLInputElement).checked;
    toggleUnnest(on ? (activeUnnestField || arrayFields[0] || "") : activeUnnestField, on);
  }

  function handleUnnestFieldChange(e: Event) {
    setUnnestField((e.currentTarget as HTMLSelectElement).value);
  }

  function handleSourceChange(e: Event) {
    const projectId = (e.currentTarget as HTMLSelectElement).value;
    dispatch("change", { projectId });
  }

  function handleLinkedBlockChange(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value;
    if (!id) { dispatch("linkedSelectionChange", undefined); return; }
    dispatch("linkedSelectionChange", { sourceWidgetId: id, relationField: "" });
  }

  function handleRelationFieldChange(e: Event) {
    const field = (e.currentTarget as HTMLSelectElement).value;
    if (!currentLinkedId) return;
    dispatch("linkedSelectionChange", { sourceWidgetId: currentLinkedId, relationField: field });
  }
</script>

<WidgetConfigShell
  title={$i18n.t("views.dashboard.database-call.settings.title", {
    defaultValue: "Data Source",
  })}
  subtitle={$i18n.t("views.dashboard.database-call.settings.subtitle", {
    defaultValue: "Load data from a different project instead of the current view.",
  })}
  on:close={() => dispatch("close")}
>
  <div class="ppp-cfg-list">
    <div class="ppp-cfg-item">
      <label class="ppp-dbc-settings__field">
        {$i18n.t("views.dashboard.database-call.settings.source", {
          defaultValue: "Source project",
        })}
        <select value={currentProjectId} on:change={handleSourceChange}>
          <option value="">
            {$i18n.t("views.dashboard.database-call.settings.source-inherit", {
              defaultValue: "This view's data (default)",
            })}
          </option>
          {#each availableSources as src (src.id)}
            <option value={src.id}>{src.name}</option>
          {/each}
        </select>
        <span class="ppp-dbc-settings__hint">{$i18n.t("views.dashboard.database-call.settings.source-hint", { defaultValue: "By default the block shows this view's records. Pick another project to show its data instead." })}</span>
      </label>
    </div>
    <div class="ppp-cfg-item">
      <label class="ppp-dbc-settings__field">
        {$i18n.t("views.dashboard.database-call.settings.link-to", { defaultValue: "Link to block" })}
        <select value={currentLinkedId} on:change={handleLinkedBlockChange}>
          <option value="">{$i18n.t("views.dashboard.database-call.settings.standalone", { defaultValue: "No link — show all records" })}</option>
          {#each availableWidgets as w (w.id)}
            <option value={w.id}>{w.title || w.id}</option>
          {/each}
        </select>
        <span class="ppp-dbc-settings__hint">{$i18n.t("views.dashboard.database-call.settings.link-hint", { defaultValue: "Without a link the block shows all records. With a link it shows only records related to the chosen block." })}</span>
      </label>
    </div>
    {#if currentLinkedId}
    <div class="ppp-cfg-item">
      <label class="ppp-dbc-settings__field">
        {$i18n.t("views.dashboard.database-call.settings.relation-field", { defaultValue: "Filter by field" })}
        <select value={currentRelationField} on:change={handleRelationFieldChange}>
          <option value="">— {$i18n.t("views.dashboard.database-call.settings.select-field", { defaultValue: "select field" })} —</option>
          {#each fields as f (f.name)}
            <option value={f.name}>{f.name}</option>
          {/each}
        </select>
      </label>
    </div>
    {/if}
    {#if arrayFields.length > 0}
    <div class="ppp-cfg-item">
      <label class="ppp-dbc-settings__field ppp-dbc-settings__field--row">
        <input
          type="checkbox"
          checked={activeUnnestField !== ""}
          on:change={handleUnnestToggle}
        />
        <span>{$i18n.t("views.dashboard.database-call.settings.unnest-label", { defaultValue: "Expand list" })}</span>
      </label>
      <label class="ppp-dbc-settings__field">
        <span class="ppp-dbc-settings__sublabel">
          {$i18n.t("views.dashboard.database-call.settings.unnest-field", { defaultValue: "List field" })}
        </span>
        <select
          value={activeUnnestField}
          on:change={handleUnnestFieldChange}
        >
          <option value="">— {$i18n.t("views.dashboard.database-call.settings.unnest-none", { defaultValue: "none" })} —</option>
          {#each arrayFields as f (f)}
            <option value={f}>{f}</option>
          {/each}
        </select>
      </label>
      <span class="ppp-dbc-settings__hint">
        {$i18n.t("views.dashboard.database-call.settings.unnest-hint", {
          defaultValue: "Split a list field into one row per item.",
        })}
      </span>
    </div>
    {/if}
  </div>
</WidgetConfigShell>

<style>
  .ppp-dbc-settings__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    width: 100%;
  }

  .ppp-dbc-settings__field select {
    width: 100%;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-small);
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    color: var(--text-normal);
  }

  .ppp-dbc-settings__field--row {
    flex-direction: row;
    align-items: center;
    gap: 0.375rem;
  }

  .ppp-dbc-settings__sublabel {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .ppp-dbc-settings__hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
  }
</style>
