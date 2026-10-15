<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import type { DataField, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";

  export let field: DataField;
  export let value: Optional<DataValue>;
  const dispatch = createEventDispatcher<{ commit: Optional<DataValue>; cancel: void }>();
  const initial = Array.isArray(value) ? value : value == null ? [] : [value];
  // Independent draft + stable item identity; never mutate the datasource.
  let nextId = initial.length;
  let items = initial.map((item, id) => ({ id, value: item }));
  let triggerEl: HTMLSpanElement | null = null;
  let listEl: HTMLDivElement | null = null;
  let finished = false;

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
</script>

<span bind:this={triggerEl} aria-hidden="true" />
<FloatingPopup open={true} triggerEl={triggerEl?.parentElement ?? null} ariaLabel={field.name} on:close={() => finish(false)}>
  <div class="ppp-t2-list-editor" bind:this={listEl}>
    <span>{field.name}</span>
    {#each items as item, i (item.id)}
      <div class="ppp-t2-list-item">
        {#if typeof item.value === "string"}
          <TextField value={item.value} ariaLabel={`${field.name}: ${i + 1}`}
            on:input={(e) => { items = items.map(v => v.id === item.id ? { ...v, value: e.detail } : v); }} />
        {:else}
          <!-- A mixed list keeps non-text values exactly as read. -->
          <span>{item.value == null ? "∅" : String(item.value)}</span>
        {/if}
        <button type="button" on:click={() => { items = items.filter(v => v.id !== item.id); }}>
          {$i18n.t("views.dashboard.table-v2.list-remove", { defaultValue: `Remove item ${i + 1}`, index: i + 1 })}
        </button>
      </div>
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

  .ppp-t2-list-item, .ppp-t2-list-actions {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-sm);
  }

  .ppp-t2-list-item :global(input) {
    min-width: 0;
    flex: 1;
  }

  .ppp-t2-list-actions {
    justify-content: flex-end;
  }
</style>
