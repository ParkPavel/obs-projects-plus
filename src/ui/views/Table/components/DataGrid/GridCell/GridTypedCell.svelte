<script lang="ts">
  import {
    isOptionalBoolean,
    isOptionalDate,
    isOptionalList,
    isOptionalNumber,
    isOptionalString,
    type Optional,
    type DataValue,
  } from "src/lib/dataframe/dataframe";

  import GridCell from "./GridCell.svelte";

  import type { GridColDef } from "../dataGrid";
  import { GridBooleanCell } from "./GridBooleanCell";
  import { GridDateCell } from "./GridDateCell";
  import { GridDatetimeCell } from "./GridDatetimeCell";
  import { GridNumberCell } from "./GridNumberCell";
  import { GridTextCell } from "./GridTextCell";
  import { GridListCell } from "./GridListCell";
  import { GridSelectCell } from "./GridSelectCell";
  import { GridRelationCell } from "./GridRelationCell";
  import { GridRollupCell } from "./GridRollupCell";

  export let value: Optional<DataValue>;
  export let onChange: (value: Optional<DataValue>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;
</script>

{#if column.repeated && isOptionalList(value)}
  <GridListCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "string" && isOptionalString(value)}
  <GridTextCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "boolean" && isOptionalBoolean(value)}
  <GridBooleanCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "number" && isOptionalNumber(value)}
  <GridNumberCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "date"}
  {#if column.typeConfig?.time}
    <GridDatetimeCell
      {selected}
      {rowindex}
      {colindex}
      value={isOptionalDate(value) ? value : null}
      rawValue={!isOptionalDate(value) ? value : null}
      {onChange}
      {column}
      on:mousedown
      on:navigate
    />
  {:else}
    <GridDateCell
      {selected}
      {rowindex}
      {colindex}
      value={isOptionalDate(value) ? value : null}
      rawValue={!isOptionalDate(value) ? value : null}
      {onChange}
      {column}
      on:mousedown
      on:navigate
    />
  {/if}
{:else if (column.type === "select" || column.type === "status") && isOptionalString(value)}
  <GridSelectCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "relation"}
  <GridRelationCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "rollup"}
  <GridRollupCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {column}
    on:mousedown
    on:navigate
  />
{:else}
  <GridCell
    {rowindex}
    {selected}
    {colindex}
    {column}
    on:mousedown
    on:navigate
  />
{/if}
