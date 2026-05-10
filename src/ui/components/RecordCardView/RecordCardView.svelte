<script lang="ts">
  /**
   * S7 — RecordCardView
   *
   * Wraps EditNote inside SlideInPanel so any view can open a record's
   * details inline without a full-screen modal. Caller controls `open`
   * and supplies the same props that EditNote expects.
   */
  import { createEventDispatcher } from "svelte";
  import SlideInPanel from "src/ui/components/SlideInPanel/SlideInPanel.svelte";
  import EditNote from "src/ui/modals/components/EditNote.svelte";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";

  export let open: boolean = false;
  export let fields: DataField[];
  export let record: DataRecord | null = null;
  export let allRecords: DataRecord[] = [];
  export let autosave: boolean = true;
  export let onSave: ((record: DataRecord) => Promise<void> | void) | undefined = undefined;
  export let onOpenNote: ((openMode: false | "tab" | "window") => void) | undefined = undefined;
  export let onRenameNote: ((newName: string) => void) | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: void; save: DataRecord }>();

  $: title = record ? (record.id.split("/").pop()?.replace(".md", "") ?? record.id) : "";

  async function handleSave(r: DataRecord) {
    await onSave?.(r);
    dispatch("save", r);
  }
</script>

<SlideInPanel
  {open}
  {title}
  width="28rem"
  on:close={() => dispatch("close")}
>
  {#if record}
    <EditNote
      {fields}
      {record}
      {allRecords}
      {autosave}
      onSave={handleSave}
      onOpenNote={onOpenNote}
      onRenameNote={onRenameNote}
    />
  {:else}
    <div class="ppp-rcv-empty">No record selected</div>
  {/if}
</SlideInPanel>

<style>
  .ppp-rcv-empty {
    padding: 1.5rem;
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
  }
</style>
