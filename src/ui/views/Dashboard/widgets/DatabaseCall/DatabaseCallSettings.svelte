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
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { WidgetSourceConfig, LinkedSelectionConfig } from "../../types";

  export let sourceConfig: WidgetSourceConfig | undefined = undefined;
  export let availableSources: Array<{ id: string; name: string }> = [];
  export let availableWidgets: Array<{ id: string; title: string }> = [];
  export let fields: DataField[] = [];
  export let linkedSelection: LinkedSelectionConfig | undefined = undefined;

  const dispatch = createEventDispatcher<{
    change: WidgetSourceConfig;
    close: void;
    linkedSelectionChange: LinkedSelectionConfig | undefined;
  }>();

  $: currentProjectId = sourceConfig?.projectId ?? "";
  $: currentLinkedId = linkedSelection?.sourceWidgetId ?? "";
  $: currentRelationField = linkedSelection?.relationField ?? "";

  function handleSourceChange(e: Event) {
    const projectId = (e.currentTarget as HTMLSelectElement).value;
    dispatch("change", { projectId });
  }

  function handleLinkedBlockChange(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value;
    if (!id) { dispatch("linkedSelectionChange", undefined); return; }
    dispatch("linkedSelectionChange", { sourceWidgetId: id, relationField: currentRelationField });
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
            — {$i18n.t("views.dashboard.database-call.settings.source-inherit", {
              defaultValue: "inherit from view",
            })} —
          </option>
          {#each availableSources as src (src.id)}
            <option value={src.id}>{src.name}</option>
          {/each}
        </select>
      </label>
    </div>
    <div class="ppp-cfg-item">
      <label class="ppp-dbc-settings__field">
        {$i18n.t("views.dashboard.database-call.settings.link-to", { defaultValue: "Link to block" })}
        <select value={currentLinkedId} on:change={handleLinkedBlockChange}>
          <option value="">— {$i18n.t("views.dashboard.database-call.settings.standalone", { defaultValue: "standalone" })} —</option>
          {#each availableWidgets as w (w.id)}
            <option value={w.id}>{w.title || w.id}</option>
          {/each}
        </select>
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
</style>
