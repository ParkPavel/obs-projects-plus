<script lang="ts">
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import {
    getOptionColor,
    isSelectConfig,
    isStatusConfig,
    type ExtendedFieldTypeConfig,
    type SelectOption,
  } from "src/ui/views/Database/fieldTypes";

  import { copyToClipboard } from "src/lib/helpers/clipboard";

  export let value: Optional<string>;
  export let onChange: (value: Optional<string>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit: boolean = false;

  $: extConfig = column.typeConfig as unknown as ExtendedFieldTypeConfig | undefined;
  $: options = getOptions(extConfig);
  $: color = value && extConfig ? getOptionColor(extConfig, value) : null;

  function getOptions(cfg: ExtendedFieldTypeConfig | undefined): SelectOption[] {
    if (!cfg) return [];
    if (isSelectConfig(cfg)) return cfg.options;
    if (isStatusConfig(cfg)) return cfg.groups.map((g) => ({ name: g.name, color: g.color }));
    return [];
  }
</script>

<GridCell
  bind:edit
  bind:selected
  {column}
  {rowindex}
  {colindex}
  on:mousedown
  on:navigate
  onCopy={() => {
    copyToClipboard(value?.toString() || "");
  }}
>
  <span
    slot="read"
    class="ppp-select-badge"
    class:ppp-select-badge--empty={!value}
    style:--badge-color={color || "var(--text-muted)"}
  >
    {#if color}
      <span class="ppp-select-dot" style:background-color={color}></span>
    {/if}
    {value || ""}
  </span>

  <svelte:fragment slot="edit">
    <select
      class="ppp-select-dropdown"
      value={value || ""}
      on:change={(e) => {
        const target = e.currentTarget;
        if (target instanceof HTMLSelectElement) {
          onChange(target.value || null);
          edit = false;
        }
      }}
      on:blur={() => { edit = false; }}
    >
      <option value="">—</option>
      {#each options as opt}
        <option value={opt.name}>
          {opt.name}
        </option>
      {/each}
    </select>
  </svelte:fragment>
</GridCell>

<style>
  .ppp-select-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-s, 4px);
    font-size: var(--font-ui-small);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .ppp-select-badge--empty {
    color: var(--text-faint);
  }

  .ppp-select-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ppp-select-dropdown {
    width: 100%;
    padding: 0.25rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }
</style>
