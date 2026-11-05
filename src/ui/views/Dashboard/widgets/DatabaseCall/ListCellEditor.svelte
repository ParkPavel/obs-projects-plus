<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import ListCellEditorItem from "./ListCellEditorItem.svelte";
  import { namesToOptions } from "src/ui/components/fields/comboOptions";
  import { onCellRetry } from "./tableEditing";
  import { createListCellDraft } from "./listCellDraft";
  export let field: DataField;
  export let value: Optional<DataValue>;
  export let options: string[] = [];
  export let saving = false;
  export let retryVersion = 0;
  export let dateFormat: import("src/settings/v3/settings").DateFormatConfig | undefined = undefined;
  const dispatch = createEventDispatcher<{ commit: Optional<DataValue>; cancel: void }>();
  const items = createListCellDraft(value);
  let triggerEl: HTMLSpanElement | null = null;
  let listEl: HTMLDivElement | null = null;
  let finished = false;
  let editors: Record<number, ListCellEditorItem | undefined> = {};
  const retry = onCellRetry(() => { finished = false; });
  $: retry(retryVersion);
  $: suggestionOptions = namesToOptions(options);
  function finish(apply: boolean): void {
    if (finished || saving) return;
    if (apply && !$items.every(item => editors[item.id]?.syncForSubmit())) return;
    finished = true;
    const cell = triggerEl?.parentElement;
    if (apply) {
      dispatch("commit", items.value());
    } else dispatch("cancel");
    void tick().then(() => { if (cell?.isConnected) cell.focus(); });
  }
  function add(): void {
    if (saving) return;
    items.add([DataFieldType.Number, DataFieldType.Date, DataFieldType.Boolean].includes(field.type) ? null : "");
    void tick().then(() => {
      const inputs = listEl?.querySelectorAll<HTMLInputElement>("input");
      inputs?.[inputs.length - 1]?.focus();
    });
  }
</script>
<span bind:this={triggerEl} aria-hidden="true" />
<FloatingPopup open={true} dismissible={!saving} triggerEl={triggerEl?.parentElement ?? null} ariaLabel={field.name} on:close={() => finish(false)}>
  <div class="ppp-t2-list-editor" bind:this={listEl}>
    <span>{field.name}</span>
    {#each $items as item, i (item.id)}
      <ListCellEditorItem
        bind:this={editors[item.id]}
        {item}
        index={i}
        fieldName={field.name}
        {field}
        {dateFormat}
        options={suggestionOptions}
        {saving}
        on:change={(event) => items.change(item.id, event.detail)}
        on:remove={() => items.remove(item.id)}
        on:cancel={() => finish(false)}
      />
    {/each}
    <button type="button" disabled={saving} on:click={add}>
      {$i18n.t("views.dashboard.table-v2.list-add", { defaultValue: "Add item" })}
    </button>
    <div class="ppp-t2-list-actions">
      <button type="button" disabled={saving} on:click={() => finish(false)}>{$i18n.t("common.cancel", { defaultValue: "Cancel" })}</button>
      <button type="button" disabled={saving} on:click={() => finish(true)}>{$i18n.t("common.apply", { defaultValue: "Apply" })}</button>
    </div>
  </div>
</FloatingPopup>
<style>
  .ppp-t2-list-editor {
    display: flex;
    flex-direction: column;
    gap: var(--ppp-space-sm);
    padding: var(--ppp-space-md);
    width: 24em;
    max-width: 80vw;
    max-height: 70vh;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .ppp-t2-list-actions {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-sm);
    justify-content: flex-end;
  }
</style>
