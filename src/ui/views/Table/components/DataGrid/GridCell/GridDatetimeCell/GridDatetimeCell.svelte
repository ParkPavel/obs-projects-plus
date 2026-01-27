<script lang="ts">
  import DatetimeInput from "src/ui/components/DatetimeInput.svelte";
  // import { DatetimeInput } from "obsidian-svelte";
  import type { Optional, DataValue } from "src/lib/dataframe/dataframe";
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
  
  // Format datetime according to project settings
  $: formattedDatetime = (() => {
    // If we have invalid raw value, show it as-is
    if (hasInvalidRawValue) return String(rawValue);
    if (!value) return "";
    const date = dayjs(value);
    if (!date.isValid()) {
      return String(value);
    }
    const project = $projectStore;
    const dateFormatted = project 
      ? (formatDateForDisplay(date, project) ?? date.format('YYYY-MM-DD'))
      : date.format('YYYY-MM-DD');
    const timeFormatted = date.format('HH:mm');
    return `${dateFormatted} ${timeFormatted}`;
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
      navigator.clipboard.writeText(formattedDatetime);
    }
  }}
>
  <svelte:fragment slot="read">
    {#if value || hasInvalidRawValue}
      <TextLabel value={formattedDatetime} />
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
