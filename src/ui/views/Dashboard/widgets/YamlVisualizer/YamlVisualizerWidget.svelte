<script lang="ts">
  // R5-011 — Wrap the existing YamlVisualizer view as a Dashboard
  // widget. The visualizer edits the first record of `frame` (Stage A
  // semantics), so we forward `transformedFrame` directly. Project /
  // api / readonly come from WidgetHost props.

  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { ViewApi } from "src/lib/viewApi";
  import { setContext, createEventDispatcher } from "svelte";
  import YamlVisualizer from "src/ui/views/YamlVisualizer/YamlVisualizer.svelte";
  import type { YamlVisualizerConfig } from "src/ui/views/YamlVisualizer/types";
  import { i18n } from "src/lib/stores/i18n";

  export let config: Record<string, unknown> | undefined = undefined;
  export let source: DataFrame;
  export let project: ProjectDefinition;
  export let api: ViewApi;
  export let readonly: boolean;

  const dispatch = createEventDispatcher<{ change: YamlVisualizerConfig }>();

  // RelationListView pulls `sourcePath` from context — fall back to
  // active record id.
  $: setContext("sourcePath", source.records[0]?.id ?? "");

  $: yamlConfig = (config ?? {}) as YamlVisualizerConfig;

  function handleConfigChange(next: YamlVisualizerConfig): void {
    dispatch("change", next);
  }
</script>

{#if source.records.length === 0}
  <div class="ppp-yaml-empty">
    {$i18n.t("views.dashboard.yaml-visualizer.empty", { defaultValue: "No record to display" })}
  </div>
{:else}
  <div class="ppp-yaml-widget">
    <YamlVisualizer
      frame={source}
      {project}
      {readonly}
      config={yamlConfig}
      onConfigChange={handleConfigChange}
      {api}
    />
  </div>
{/if}

<style>
  .ppp-yaml-widget {
    height: 100%;
    overflow: auto;
  }
  .ppp-yaml-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    color: var(--text-faint);
    font-style: italic;
  }
</style>
