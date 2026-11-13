<script lang="ts">
  import WidgetSettingsPopup from "../WidgetSettingsPopup.svelte";
  import PipelineEditor from "../PipelineEditor.svelte";
  import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  export let pipeline: TransformPipeline = {steps:[{type:"compute",columns:[{name:"total",expression:"price * 2",formulaVersion:"unified-v1"}]}]};
  let open = true;
  let editor: PipelineEditor | undefined;
  let writes = 0;
  const fields = [{name:"price",type:DataFieldType.Number,repeated:false,identifier:false,derived:false}];
</script>
<section class="ppp-widget-host">
  <button aria-haspopup="menu" on:click={() => open = true}>Reopen</button>
  {#if open}
    <WidgetSettingsPopup label="Pipeline" beforeClose={() => editor?.flushPending() ?? true} on:close={() => open = false}>
      <PipelineEditor bind:this={editor} {pipeline} {fields} on:apply={event => {pipeline=event.detail;writes++;}} />
    </WidgetSettingsPopup>
  {/if}
</section>
<output data-writes={writes}>{JSON.stringify(pipeline)}</output>
