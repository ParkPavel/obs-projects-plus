<script lang="ts">
  /**
   * #051 — DataTableContent: Table view tab inside database-call block.
   *
   * Wraps DataTableWidget in a self-contained overflow context so the table's
   * virtual scroll is contained within the block (no global overflow leak).
   * CSS custom property --ppp-dt-columns is set on this container so header
   * and row cells share a single Grid context — fixes column alignment.
   */
  import type { DataFrame, DataRecord, DataField } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { DataTableConfig, FieldPreset } from "../../types";
  import type { ProjectDefinition } from "src/settings/settings";
  import DataTableWidget from "../DataTable/DataTableWidget.svelte";
  import { createEventDispatcher } from "svelte";

  export let frame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let fields: DataField[];
  export let config: DataTableConfig | undefined;
  export let fieldPresets: FieldPreset[] = [];
  export let activeFieldPresetId: string | undefined = undefined;
  export let project: ProjectDefinition | undefined = undefined;

  const dispatch = createEventDispatcher<{
    configChange: DataTableConfig;
    fieldPresetsChange: FieldPreset[];
  }>();
</script>

<div class="ppp-dt-content">
  <DataTableWidget
    {frame}
    {api}
    {readonly}
    {getRecordColor}
    {fields}
    {config}
    {fieldPresets}
    {activeFieldPresetId}
    {project}
    on:configChange={(e) => dispatch("configChange", e.detail)}
    on:fieldPresetsChange={(e) => dispatch("fieldPresetsChange", e.detail)}
  />
</div>

<style>
  .ppp-dt-content {
    /* Self-contained scroll context — no overflow leak out of the block */
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    /* --ppp-dt-columns is consumed by the DataTable grid context */
    --ppp-dt-columns: auto;
    container-type: inline-size;
    container-name: db-table;
  }
</style>
