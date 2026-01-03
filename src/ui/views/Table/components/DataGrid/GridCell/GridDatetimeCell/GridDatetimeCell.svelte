<script lang="ts">
  import DatetimeInput from "src/ui/components/DatetimeInput.svelte";
  // import { DatetimeInput } from "obsidian-svelte";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import { settings } from "src/lib/stores/settings";
  import { formatDate } from "src/lib/helpers";

  import { GridCell } from "..";
  import { TextLabel } from "..";
  import type { GridColDef } from "../../dataGrid";

  export let value: Optional<Date>;
  let cachedValue: Optional<Date> = value; // store the proposing value
  export let onChange: (value: Optional<Date>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit = false;

  $: preferences = $settings.preferences;
</script>

<GridCell
  {selected}
  {rowindex}
  {colindex}
  {edit}
  onEditChange={(mode) => {
    edit = mode;
  }}
  {column}
  on:mousedown
  on:navigate
  onCopy={() => {
    if (value) {
      navigator.clipboard.writeText(formatDate(value, preferences, { includeTime: true }));
    }
  }}
>
  <svelte:fragment slot="read">
    {#if value}
      <TextLabel value={formatDate(value, preferences, { includeTime: true })} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="edit">
    <DatetimeInput
      value={value ?? null}
      on:input={({ detail }) => (cachedValue = detail)}
      on:blur={() => {
        edit = false;
        onChange(cachedValue);
      }}
      embed
    />
  </svelte:fragment>
</GridCell>
