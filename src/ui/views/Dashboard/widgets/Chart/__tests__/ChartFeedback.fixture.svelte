<script lang="ts">
  import { setContext } from "svelte";
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ChartConfig as Config } from "../../../types";
  import { SELECTION_CONTEXT_KEY, type SelectionStore } from "../../../canvasSelectionStore";
  import { getConfigPanel } from "../../configPanelRegistry";
  import ChartConfig from "../ChartConfig.svelte";
  import ChartWidget from "../ChartWidget.svelte";
  export let source: DataFrame;
  export let config: Config = getConfigPanel("chart").initDefaults(source.fields) as unknown as Config;
  export let selection: SelectionStore | undefined = undefined;
  if (selection) setContext(SELECTION_CONTEXT_KEY, selection);
</script>
<ChartConfig {config} fields={source.fields} on:change={(e) => { config = e.detail; }} />
<ChartWidget {config} {source} widgetId="test-chart" />
