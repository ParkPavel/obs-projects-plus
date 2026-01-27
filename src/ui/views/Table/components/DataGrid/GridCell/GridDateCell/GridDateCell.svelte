<script lang="ts">
  // import { DateInput } from "obsidian-svelte";
  import { isDate, type DataValue } from "src/lib/dataframe/dataframe";
  import DateInput from "src/ui/components/DateInput.svelte";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import dayjs from "dayjs";
  import { getContext } from "svelte";
  import { formatDateForDisplay } from "src/lib/helpers";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { Writable } from "svelte/store";

  import { GridCell } from "..";
  import { TextLabel } from "..";
  import type { GridColDef } from "../../dataGrid";

  export let value: Optional<Date>;
  // Raw value for displaying invalid non-date values (e.g., string "2" in a date field)
  export let rawValue: Optional<DataValue> = null;
  let cachedValue: Optional<Date> = value; // store the proposing value
  export let onChange: (value: Optional<Date>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit = false;
  
  // Get project store from context for date formatting (reactive)
  const projectStore = getContext<Writable<ProjectDefinition>>("project");
  
  // Check if we have an invalid raw value (non-date value in a date field)
  $: hasInvalidRawValue = rawValue !== null && rawValue !== undefined;
  
  // Validate date - check if the raw value can be parsed as a valid date
  $: isValidDate = (() => {
    // If we have a raw value that couldn't be parsed as Date, it's invalid
    if (hasInvalidRawValue) return false;
    if (!value) return true; // Empty is valid
    // If it's not a proper Date object or dayjs can't parse it, it's invalid
    const date = dayjs(value);
    return date.isValid();
  })();
  
  // Format date according to project settings (reactive via store subscription)
  $: formattedDate = (() => {
    // If we have invalid raw value, show it as-is
    if (hasInvalidRawValue) return String(rawValue);
    if (!value) return "";
    const date = dayjs(value);
    if (!date.isValid()) {
      return String(value); // Show raw invalid value
    }
    const project = $projectStore;
    if (!project) {
      return date.format('YYYY-MM-DD');
    }
    return formatDateForDisplay(date, project) ?? date.format('YYYY-MM-DD');
  })();
</script>

<GridCell
  {selected}
  {rowindex}
  {colindex}
  {edit}
  error={!isValidDate}
  onEditChange={(mode) => {
    edit = mode;
  }}
  {column}
  on:mousedown
  on:navigate
  onCopy={() => {
    if (value || hasInvalidRawValue) {
      navigator.clipboard.writeText(formattedDate);
    }
  }}
>
  <svelte:fragment slot="read">
    {#if value || hasInvalidRawValue}
      <TextLabel value={formattedDate} />
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
