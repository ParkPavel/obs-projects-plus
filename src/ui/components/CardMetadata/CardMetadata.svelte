<script lang="ts">
  import { Icon } from "obsidian-svelte";
  import {
    DataFieldType,
    type DataField,
    type DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { setContext } from "svelte";
  import Checkbox from "./Checkbox.svelte";
  import Tags from "./Tags.svelte";
  import Text from "./Text.svelte";
  import Date from "./Date.svelte";
  import Datetime from "./Datetime.svelte";
  import Number from "./Number.svelte";

  export let fields: DataField[];
  export let record: DataRecord;

  setContext<string>("sourcePath", record.id);
</script>

{#each fields as field (field.name)}
  {@const value = record.values[field.name]}
  {#if value !== undefined && value !== null}
    <div class="field-label">
      <div class="setting-item-description" style:margin-bottom={"0.25rem"}>
        {field.name}
      </div>
      {#if field.repeated}
        {#if field.type === DataFieldType.String}
          <Tags {field} {value} />
        {/if}
      {:else if field.type === DataFieldType.Boolean}
        <Checkbox {field} {value} />
      {:else if field.type === DataFieldType.String}
        <Text {field} {value} />
      {:else if field.type === DataFieldType.Number}
        <Number {field} {value} />
      {:else if field.type === DataFieldType.Date}
        {#if field.typeConfig?.time}
          <Datetime {value} {field} />
        {:else}
          <Date {value} {field} />
        {/if}
      {:else if field.type === DataFieldType.Select || field.type === DataFieldType.Status}
        <span class="ppp-card-meta-chip" data-status={String(value).toLowerCase()}>
          {String(value)}
        </span>
      {:else if field.type === DataFieldType.Relation}
        {#if Array.isArray(value)}
          <span class="ppp-card-meta-relations">
            {#each value as item, i}
              <span class="ppp-card-meta-chip ppp-card-meta-chip--relation">
                {String(item)}
              </span>{#if i < value.length - 1}{" "}{/if}
            {/each}
          </span>
        {:else}
          <span class="ppp-card-meta-chip ppp-card-meta-chip--relation">
            {String(value)}
          </span>
        {/if}
      {:else if field.type === DataFieldType.Formula || field.type === DataFieldType.Rollup}
        <span class="ppp-card-meta-derived" title={field.type}>
          <span class="ppp-card-meta-derived-icon" aria-hidden="true">ƒ</span>
          {#if typeof value === "number"}
            <Number {field} {value} />
          {:else}
            <Text {field} {value} />
          {/if}
        </span>
      {:else}
        <Icon name="slash" />
      {/if}
    </div>
  {/if}
{/each}

<style>
  .field-label {
    margin-bottom: 0.5rem;
  }

  .field-label:last-child {
    margin-bottom: 0;
  }

  .ppp-card-meta-chip {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    border-radius: 0.5rem;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    font-size: var(--font-ui-smaller, 0.75rem);
    line-height: 1.4;
    white-space: nowrap;
  }

  .ppp-card-meta-chip--relation {
    background: var(--background-modifier-active-hover, var(--background-modifier-hover));
    color: var(--text-accent, var(--text-normal));
  }

  .ppp-card-meta-relations {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .ppp-card-meta-derived {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-muted);
  }

  .ppp-card-meta-derived-icon {
    font-style: italic;
    font-weight: 600;
    color: var(--text-faint);
  }
</style>
