<script lang="ts">
  import { setContext } from "svelte";
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ChartConfig } from "../../types";
  import { SELECTION_CONTEXT_KEY, type SelectionStore } from "../../canvasSelectionStore";
  import ChartWidget from "../../widgets/Chart/ChartWidget.svelte";
  import StatsWidget from "../../widgets/Stats/StatsWidget.svelte";
  import DatabaseCallBlock from "../../widgets/DatabaseCall/DatabaseCallBlock.svelte";
  export let source: DataFrame;
  export let config: ChartConfig;
  export let selection: SelectionStore;
  setContext(SELECTION_CONTEXT_KEY, selection);
  const api = {} as ViewApi;
</script>
<ChartWidget {config} {source} widgetId="chart" />
<StatsWidget source={source} widgetId="kpi" config={{ columns: 2, cards: [{ id: "sum", label: "Amount", field: "amount", aggregation: "sum" }] }} />
<DatabaseCallBlock frame={source} fields={source.fields} {api} readonly getRecordColor={() => null} widgetId="rows"
  config={{ activeTabId: "table", viewTabs: [{ id: "table", label: "Rows", viewType: "table", config: {} }] }} />
