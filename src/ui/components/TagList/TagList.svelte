<script lang="ts">
  /**
   * w4-input2: «+» opens a field at the end of the values, not a window with a
   * name line. It is the kit TextField: Enter adds the item and leaves the
   * field empty for the next one, leaving the field adds what is typed and
   * closes it, Escape closes it.
   */
  import { tick } from "svelte";
  import { Tag } from "obsidian-svelte";
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
  import {
    isString,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";

  import { i18n } from "src/lib/stores/i18n";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import RichTextTag from "src/ui/components/TagList/RichTextTag.svelte";

  export let values: Optional<DataValue>[];
  export let richText: boolean = false;
  export let edit: boolean = false;

  export let onChange: (values: Optional<DataValue>[]) => void = () => {};

  $: stringValues = values.filter(isString);

  let adding = false;
  let field: TextField | null = null;
  let addEl: HTMLElement | null = null;

  async function startAdding(): Promise<void> {
    adding = true;
    await tick();
    field?.focus();
  }

  function add(e: CustomEvent<{ value: string; reason: "enter" | "blur" | "tab" }>): void {
    const item = e.detail.value.trim();
    if (item) onChange([...values, item]);
    if (e.detail.reason === "enter" && item) field?.reset("");
  }

  // The blur commit runs first; the field closes once the focus has left it.
  function closeAfterBlur(): void {
    void Promise.resolve().then(() => {
      if (!addEl?.contains(addEl.ownerDocument.activeElement)) adding = false;
    });
  }
</script>

<div class:edit>
  {#if edit}
    {#each stringValues as value, i}
      <Tag>
        {value}
        <IconButton
          icon="cross"
          size="xs"
          nopadding
          onClick={() => {
            onChange(values.filter((_, j) => i !== j));
          }}
        />
      </Tag>
    {/each}
    {#if adding}
      <span class="tag-list-add" bind:this={addEl} on:focusout={closeAfterBlur}>
        <TextField
          bind:this={field}
          ariaLabel={$i18n.t("common.add-item")}
          placeholder={$i18n.t("common.add-item")}
          on:commit={add}
          on:cancel={() => (adding = false)}
        />
      </span>
    {:else}
      <IconButton
        icon="plus"
        nopadding
        tooltip={$i18n.t("common.add-item")}
        onClick={() => void startAdding()}
      />
    {/if}
  {:else}
    {#each values as value}
      <RichTextTag {richText} value={value?.toString() ?? ""} />
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

  .tag-list-add {
    flex: 1 1 8rem;
    min-width: 0;
  }

  .tag-list-add :global(.ppp-text-field) {
    width: 100%;
  }
</style>
