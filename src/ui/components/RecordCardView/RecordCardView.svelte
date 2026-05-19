<script lang="ts">
  /**
   * NPLAN-V7.3 — RecordCardView (full implementation)
   *
   * Wraps EditNote inside SlideInPanel. Additions over the MVP:
   *   • Header icon — `PageIcon` shown in the SlideInPanel icon slot when the
   *     record has a recognised icon field (auto-detected or via `iconField` prop).
   *   • Inline icon picker — clicking the header icon opens a small popover
   *     where the user can type a new emoji or lucide icon name.
   *   • Description block — if the record has a field named "description",
   *     "summary", or "excerpt" with a non-empty string value, a styled excerpt
   *     is rendered above the field list so the card gives immediate context.
   */
  import { createEventDispatcher } from "svelte";
  import SlideInPanel from "src/ui/components/SlideInPanel/SlideInPanel.svelte";
  import EditNote from "src/ui/modals/components/EditNote.svelte";
  import PageIcon from "src/ui/components/PageIcon/PageIcon.svelte";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";

  export let open: boolean = false;
  export let fields: DataField[];
  export let record: DataRecord | null = null;
  export let allRecords: DataRecord[] = [];
  export let autosave: boolean = true;
  export let onSave: ((record: DataRecord) => Promise<void> | void) | undefined = undefined;
  export let onOpenNote: ((openMode: false | "tab" | "window") => void) | undefined = undefined;
  export let onRenameNote: ((newName: string) => void) | undefined = undefined;
  /**
   * Name of the field whose value is used as the record icon.
   * Auto-detects "icon", "cover", or "thumbnail" when omitted.
   */
  export let iconField: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: void; save: DataRecord }>();

  const ICON_CANDIDATES = ["icon", "cover", "thumbnail"];
  const DESC_CANDIDATES = ["description", "summary", "excerpt"];

  $: title = record
    ? (record.id.split("/").pop()?.replace(".md", "") ?? record.id)
    : "";

  $: resolvedIconField =
    iconField ??
    fields.find((f) => ICON_CANDIDATES.includes(f.name.toLowerCase()))?.name;

  $: iconValue =
    resolvedIconField && record ? record.values[resolvedIconField] : undefined;

  $: descField = fields.find((f) =>
    DESC_CANDIDATES.includes(f.name.toLowerCase())
  );
  $: descText =
    descField && record
      ? typeof record.values[descField.name] === "string"
        ? (record.values[descField.name] as string).trim()
        : ""
      : "";

  // ── Icon picker ────────────────────────────────────────────
  let pickerOpen = false;
  let pickerInput = "";
  let pickerInputEl: HTMLInputElement | null = null;

  function openPicker() {
    pickerInput = typeof iconValue === "string" ? iconValue : "";
    pickerOpen = true;
  }

  function closePicker() {
    pickerOpen = false;
  }

  function confirmPicker() {
    if (!record || !resolvedIconField) { closePicker(); return; }
    const nextValue: string | null = pickerInput.trim() || null;
    const updated: DataRecord = {
      ...record,
      values: { ...record.values, [resolvedIconField]: nextValue },
    };
    void onSave?.(updated);
    dispatch("save", updated);
    closePicker();
  }

  function handlePickerKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); confirmPicker(); }
    if (e.key === "Escape") { e.stopPropagation(); closePicker(); }
  }

  function focusInput(node: HTMLInputElement) {
    requestAnimationFrame(() => node.focus());
  }

  // ── Save passthrough ───────────────────────────────────────
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
  <!-- Header icon slot: renders whenever the record has a recognised icon field,
       even if the field value is currently empty (so the user can SET an icon).
       NOTE: <svelte:fragment> must be a direct child of the component — the
       {#if} guard goes INSIDE the fragment, not around it. -->
  <svelte:fragment slot="icon">
    {#if resolvedIconField}
      <div class="ppp-rcv-icon-wrap">
        <button
          class="ppp-rcv-icon-btn"
          class:ppp-rcv-icon-btn--empty={!iconValue}
          on:click={openPicker}
          aria-label={$i18n.t("views.dashboard.record-card.change-icon", { defaultValue: "Change icon" })}
          title={$i18n.t("views.dashboard.record-card.change-icon", { defaultValue: "Change icon" })}
        >
          {#if iconValue}
            <PageIcon value={iconValue} size={1.25} />
          {:else}
            <span class="ppp-rcv-icon-placeholder" aria-hidden="true">+</span>
          {/if}
        </button>

        {#if pickerOpen}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="ppp-rcv-icon-picker" on:keydown={handlePickerKeydown}>
            <input
              bind:this={pickerInputEl}
              bind:value={pickerInput}
              class="ppp-rcv-icon-input"
              use:focusInput
              placeholder="📄  or  file-text"
              aria-label={$i18n.t("views.dashboard.record-card.icon-input", { defaultValue: "Emoji or icon name" })}
              on:keydown={handlePickerKeydown}
            />
            <button class="ppp-rcv-icon-confirm" on:click={confirmPicker} aria-label="Confirm">✓</button>
            <button class="ppp-rcv-icon-cancel" on:click={closePicker} aria-label="Cancel">✕</button>
          </div>
        {/if}
      </div>
    {/if}
  </svelte:fragment>

  <!-- Description block -->
  {#if descText}
    <div class="ppp-rcv-desc">{descText}</div>
  {/if}

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
    <div class="ppp-rcv-empty">
      {$i18n.t("views.dashboard.record-card.empty", { defaultValue: "No record selected" })}
    </div>
  {/if}
</SlideInPanel>

<style>
  .ppp-rcv-icon-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .ppp-rcv-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .ppp-rcv-icon-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-rcv-icon-btn:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }

  .ppp-rcv-icon-btn--empty {
    border: 0.0625rem dashed var(--text-faint);
    color: var(--text-faint);
    width: 1.5rem;
    height: 1.5rem;
  }

  .ppp-rcv-icon-btn--empty:hover {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .ppp-rcv-icon-placeholder {
    font-size: 0.875rem;
    line-height: 1;
    font-weight: 600;
    user-select: none;
  }

  .ppp-rcv-icon-picker {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    z-index: var(--layer-popover, 30);
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    box-shadow: var(--shadow-s);
    white-space: nowrap;
    animation: ppp-rcv-picker-in 120ms ease both;
  }

  @keyframes ppp-rcv-picker-in {
    from { opacity: 0; transform: translateY(-0.125rem); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .ppp-rcv-icon-input {
    width: 9rem;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-small);
    background: var(--background-secondary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    color: var(--text-normal);
  }

  .ppp-rcv-icon-input:focus {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: -0.0625rem;
  }

  .ppp-rcv-icon-confirm,
  .ppp-rcv-icon-cancel {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    font-size: 0.75rem;
    transition: background 100ms ease;
  }

  .ppp-rcv-icon-confirm {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-rcv-icon-confirm:hover { opacity: 0.9; }

  .ppp-rcv-icon-cancel {
    background: var(--background-modifier-hover);
    color: var(--text-muted);
  }

  .ppp-rcv-icon-cancel:hover { color: var(--text-normal); }

  /* Description block */
  .ppp-rcv-desc {
    margin-bottom: 0.75rem;
    padding: 0.625rem 0.75rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    background: var(--background-secondary);
    border-left: 0.1875rem solid var(--interactive-accent);
    border-radius: 0 var(--radius-s, 0.25rem) var(--radius-s, 0.25rem) 0;
    line-height: 1.5;
    word-break: break-word;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .ppp-rcv-empty {
    padding: 1.5rem;
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
  }
</style>
