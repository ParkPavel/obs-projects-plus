<script lang="ts">
  import {
    ViewContent,
    ViewLayout,
  } from "src/ui/components/Layout";
  import type { BoardConfig } from "./types";
  import type { DataFrame } from "src/lib/dataframe/dataframe";

  export let config: BoardConfig;
  export let onConfigChange: (cfg: BoardConfig) => void;

  export let frame: DataFrame;

  // Keep onConfigChange reference to avoid unused warning
  $: void onConfigChange;

  $: ({ fields } = frame);

  $: columnWidth = config?.columnWidth ?? 270;
</script>

<!--
    @component

    BoardOptionsProvider abstracts away the scaffolding around the view.
    All settings are now managed via ViewConfigTab in the settings menu.
    Freeze button is in CompactNavBar -> ViewSpecificActions.
-->
<ViewLayout>
  <ViewContent>
    <slot
      {columnWidth}
      checkField={config.checkField ?? ""}
      customHeader={config.headerField}
      groupByField={fields.find((field) => config.groupByField === field.name)}
      includeFields={config.includeFields ?? []}
    />
  </ViewContent>
</ViewLayout>
