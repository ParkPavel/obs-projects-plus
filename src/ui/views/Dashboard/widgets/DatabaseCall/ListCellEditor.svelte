<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import type { DataField, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import ListCellEditorItem from "./ListCellEditorItem.svelte";
  import { namesToOptions } from "src/ui/components/fields/comboOptions";

  export let field: DataField;
  export let value: Optional<DataValue>;
  export let options: string[] = [];
  const dispatch = createEventDispatcher<{ commit: Optional<DataValue>; cancel: void }>();
  const initial = Array.isArray(value) ? value : value == null ? [] : [value];
  // Independent draft + stable item identity; never mutate the datasource.
  let nextId = initial.length;
  let items = initial.map((item, id) => ({ id, value: item }));
  let triggerEl: HTMLSpanElement | null = null;
  let listEl: HTMLDivElement | null = null;
  let finished = false;
  $: suggestionOptions = namesToOptions(options);

  function finish(apply: boolean): void {
    if (finished) return;
    finished = true;
    const cell = triggerEl?.parentElement;
    if (apply) {
      const next = items.map(item => item.value);
      const unchanged = next.length === initial.length && next.every((v, i) => v === initial[i]);
      dispatch("commit", unchanged ? value : next);
    } else dispatch("cancel");
    void tick().then(() => { if (cell?.isConnected) cell.focus(); });
  }

  function add(): void {
    items = [...items, { id: nextId++, value: "" }];
    void tick().then(() => {
      const inputs = listEl?.querySelectorAll<HTMLInputElement>("input");
      inputs?.[inputs.length - 1]?.focus();
    });
  }

  function updateItem(id: number, value: Optional<DataValue>): void {
    items = items.map((item) => item.id === id ? { ...item, value } : item);
  }

  function removeItem(id: number): void {
    items = items.filter((item) => item.id !== id);
  }
</script>

<span bind:this={triggerEl} aria-hidden="true" />
<FloatingPopup open={true} triggerEl={triggerEl?.parentElement ?? null} ariaLabel={field.name} on:close={() => finish(false)}>
  <div class="ppp-t2-list-editor" bind:this={listEl}>
    <span>{field.name}</span>
    {#each items as item, i (item.id)}
      <ListCellEditorItem
        {item}
        index={i}
        fieldName={field.name}
        options={suggestionOptions}
        on:change={(event) => updateItem(item.id, event.detail)}
        on:remove={() => removeItem(item.id)}
        on:cancel={() => finish(false)}
      />
    {/each}
    <button type="button" on:click={add}>
      {$i18n.t("views.dashboard.table-v2.list-add", { defaultValue: "Add item" })}
    </button>
    <div class="ppp-t2-list-actions">
      <button type="button" on:click={() => finish(false)}>{$i18n.t("common.cancel", { defaultValue: "Cancel" })}</button>
      <button type="button" on:click={() => finish(true)}>{$i18n.t("common.apply", { defaultValue: "Apply" })}</button>
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
