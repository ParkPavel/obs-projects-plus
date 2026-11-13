<script lang="ts">
  /**
   * w4-input2: «+» opens a field at the end of the values, not a window with a
   * name line. The kit ComboField keeps its input when options change. Enter
   * adds the item and empties the field; leaving adds what is typed and
   * closes it, Escape closes it.
   */
  import { Tag } from "obsidian-svelte";
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
  import {
    DataFieldType,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";

  import { i18n } from "src/lib/stores/i18n";
  import { formatTypedDate } from "src/lib/helpers/typedDate";
  import TagListAdd from "./TagListAdd.svelte";
  import RichTextTag from "src/ui/components/TagList/RichTextTag.svelte";

  export let values: Optional<DataValue>[];
  export let richText: boolean = false;
  export let edit: boolean = false;
  export let suggestions: string[] = [];
  export let type: DataFieldType = DataFieldType.String;
  export let withTime = false;
  export let allowCustom = true;

  export let onChange: (values: Optional<DataValue>[]) => void = () => {};

  let list = [...values], parent = values;
  const keyOf = (next: Optional<DataValue>[]): string => JSON.stringify(next.map(item => item instanceof Date ? ["date", item.getTime()] : ["value", item]));
  let parentKey = keyOf(values);
  let pending: string[] = [];
  function adopt(next: Optional<DataValue>[]): void {
    if (next === parent) return;
    parent = next;
    const key = keyOf(next);
    if (key === parentKey) return;
    parentKey = key;
    const acknowledgement = pending.indexOf(key);
    if (acknowledgement >= 0) {
      pending.splice(0, acknowledgement + 1);
      if (pending.length) return;
    } else pending = [];
    list = [...next];
  }
  $: adopt(values);
  function change(next: Optional<DataValue>[]): void {
    if (!edit) return;
    list = next;
    pending.push(keyOf(next));
    onChange(next);
  }

  function label(value: Optional<DataValue>): string {
    return value instanceof Date ? formatTypedDate(value, withTime) : value == null ? "—" : String(value);
  }

  let adding = false;
</script>

<div class:edit>
  {#if edit}
    {#each list as value, index}
      <Tag>
        {label(value)}
        <IconButton
          icon="cross"
          size="xs"
          nopadding
          tooltip={`${$i18n.t("common.remove")}: ${label(value)}`}
          onClick={() => {
            change(list.filter((_, j) => index !== j));
          }}
        />
      </Tag>
    {/each}
    {#if adding}
      <TagListAdd {type} {withTime} {suggestions} {allowCustom}
        on:add={event => change([...list, event.detail])}
        on:close={() => (adding = false)} />
    {:else}
      <IconButton
        icon="plus"
        nopadding
        tooltip={$i18n.t("common.add-item")}
        onClick={() => (adding = true)}
      />
    {/if}
  {:else}
    {#each values as value}
      <RichTextTag {richText} value={label(value)} />
    {/each}
  {/if}
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: var(--ppp-spacing-2xs, 0.25rem);
    overflow: hidden;
    padding: var(--ppp-spacing-2xs, 0.25rem);
  }

  .edit {
    flex-wrap: wrap;
  }

</style>
