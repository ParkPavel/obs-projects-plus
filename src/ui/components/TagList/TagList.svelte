<script lang="ts">
  /**
   * w4-input2: «+» opens a field at the end of the values, not a window with a
   * name line. The kit ComboField keeps its input when options change. Enter
   * adds the item and empties the field; leaving adds what is typed and
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
  import ComboField from "src/ui/components/fields/ComboField.svelte";
  import { namesToOptions } from "src/ui/components/fields/comboOptions";
  import RichTextTag from "src/ui/components/TagList/RichTextTag.svelte";

  export let values: Optional<DataValue>[];
  export let richText: boolean = false;
  export let edit: boolean = false;
  export let suggestions: string[] = [];

  export let onChange: (values: Optional<DataValue>[]) => void = () => {};

  $: stringValues = values.flatMap((value, index) => isString(value) ? [{ value, index }] : []);
  $: suggestionOptions = namesToOptions(suggestions);

  let adding = false;
  let suggestionField: ComboField | null = null;
  let addEl: HTMLElement | null = null;
  let suggestedDraft = "";

  async function startAdding(): Promise<void> {
    suggestedDraft = "";
    adding = true;
    await tick();
    suggestionField?.focus();
  }

  function addSuggested(e: CustomEvent<{ value: string; reason: string }>): void {
    if (!edit) return;
    const selected = e.detail.reason === "select" || suggestionOptions.some(option => option.id === e.detail.value);
    const item = selected ? e.detail.value : e.detail.value.trim();
    if (item.trim()) onChange([...values, item]);
    if ((e.detail.reason === "enter" || e.detail.reason === "select") && item) {
      suggestedDraft = "";
      suggestionField?.reset("");
    } else if (e.detail.reason !== "enter" && e.detail.reason !== "select") {
      adding = false;
    }
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
    {#each stringValues as { value, index }}
      <Tag>
        {value}
        <IconButton
          icon="cross"
          size="xs"
          nopadding
          tooltip={`${$i18n.t("common.remove")}: ${value}`}
          onClick={() => {
            if (edit) onChange(values.filter((_, j) => index !== j));
          }}
        />
      </Tag>
    {/each}
    {#if adding}
      <span class="tag-list-add" bind:this={addEl} on:focusout={closeAfterBlur}>
          <ComboField
            bind:this={suggestionField}
            value={suggestedDraft}
            options={suggestionOptions}
            allowCustom
            focusOnMount
            commitOnDestroy={false}
            ariaLabel={$i18n.t("common.add-item")}
            placeholder={$i18n.t("common.add-item")}
            on:draftChange={(e) => (suggestedDraft = e.detail)}
            on:commit={addSuggested}
            on:cancel={() => {
              suggestedDraft = "";
              adding = false;
            }}
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

  .tag-list-add :global(.ppp-combo),
  .tag-list-add :global(.ppp-combo-input) {
    width: 100%;
  }
</style>
