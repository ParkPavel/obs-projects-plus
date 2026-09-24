<!--
  WidgetHeaderBadges — what a widget header says about its content: the
  inline badges (#034.3) and, while another widget's selection narrows this
  one, the selection pill (#044.5) whose ✕ ends the selection for the canvas.
  Filled into WidgetShell's `badges` slot by WidgetHost.
-->
<script lang="ts">
  import { getContext, onDestroy } from "svelte";
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { DataTableConfig, WidgetDefinition } from "../../types";
  import {
    EMPTY_SELECTION,
    SELECTION_CONTEXT_KEY,
    type SelectionState,
    type SelectionStore,
  } from "../../canvasSelectionStore";
  import WidgetInlineBadges from "./WidgetInlineBadges.svelte";
  import SelectionBadge, { shouldShowSelectionBadge } from "./SelectionBadge.svelte";

  export let widget: WidgetDefinition;
  export let frame: DataFrame;
  export let tableConfig: DataTableConfig | undefined = undefined;

  const selectionStore: SelectionStore | undefined = getContext(SELECTION_CONTEXT_KEY);
  let selection: SelectionState = EMPTY_SELECTION;
  const unsubscribe = selectionStore ? selectionStore.subscribe((v) => (selection = v)) : () => {};
  onDestroy(unsubscribe);
</script>

<WidgetInlineBadges {widget} {frame} {tableConfig} />
{#if selectionStore && selection.field !== null && shouldShowSelectionBadge(widget, selection)}
  <SelectionBadge
    field={selection.field}
    values={selection.values}
    on:clear={() => selectionStore?.clearSelection()}
  />
{/if}
