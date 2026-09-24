<script lang="ts">
  /**
   * Test-only: WidgetShell with the `badges` slot filled exactly the way
   * WidgetHost fills it (widget + transformed frame + effective table config).
   */
  import WidgetShell from "../WidgetShell.svelte";
  import WidgetInlineBadges from "../_shared/WidgetInlineBadges.svelte";
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { DataTableConfig, WidgetDefinition } from "../../types";

  export let widget: WidgetDefinition;
  export let frame: DataFrame;
  export let tableConfig: DataTableConfig | undefined = undefined;
</script>

<WidgetShell widgetId={widget.id} title={widget.title ?? ""} widgetType={widget.type}>
  <svelte:fragment slot="badges">
    <WidgetInlineBadges {widget} {frame} {tableConfig} />
  </svelte:fragment>
</WidgetShell>
