<script lang="ts">
  import WidgetHeaderActions from "../../widgets/WidgetHeaderActions.svelte";
  export let widget;
  export let readonly = false;
</script>
<div data-widget-id={widget.id} data-prop-count={Object.keys($$props).length}>
  <WidgetHeaderActions {widget} {readonly} hasCog={false} hasPipeline={false} />
</div>
