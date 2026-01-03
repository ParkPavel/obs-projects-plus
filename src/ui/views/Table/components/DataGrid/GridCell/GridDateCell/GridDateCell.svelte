<script lang="ts">
  // import { DateInput } from "obsidian-svelte";
  import { isDate } from "src/lib/dataframe/dataframe";
  import DateInput from "src/ui/components/DateInput.svelte";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import dayjs from "dayjs";
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
      navigator.clipboard.writeText(formatDate(value, preferences));
    }
  }}
>
  <svelte:fragment slot="read">
    {#if value}
      <TextLabel value={formatDate(value, preferences)} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="edit">
    <DateInput
      value={value ?? null}
      on:change={({ detail }) => (cachedValue = detail)}
      on:blur={() => {
        edit = false;
        if (!cachedValue || !isDate(value)) {
          onChange(cachedValue);
          return;
        }
        const cachedDate = dayjs(cachedValue);
        const newDatetime = dayjs(value)
          .set("year", cachedDate.year())
          .set("month", cachedDate.month())
          .set("date", cachedDate.date());
        onChange(newDatetime.toDate());
      }}
      embed
    />
  </svelte:fragment>
</GridCell>
