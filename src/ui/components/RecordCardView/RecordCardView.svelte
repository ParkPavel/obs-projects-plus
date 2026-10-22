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
  import TextField from "src/ui/components/fields/TextField.svelte";
  import EditNote from "src/ui/modals/components/EditNote.svelte";
  import NotePropertiesBlock from "src/ui/properties/NotePropertiesBlock.svelte";
  import { app as appStore } from "src/lib/stores/obsidian";
  import { TFile } from "obsidian";
  import { formatDisplayValue } from "src/lib/helpers/dateDisplay";
  import PageIcon from "src/ui/components/PageIcon/PageIcon.svelte";
  import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
  import { normalizeRelationValue } from "src/lib/relations/relationContract";
  import { i18n } from "src/lib/stores/i18n";

  export let open: boolean = false;
  export let fields: DataField[];
  export let record: DataRecord | null = null;
  export let allRecords: DataRecord[] = [];
  export let autosave: boolean = true;
  // #158 (L3/C3): the peek's read-only path — gates EditNote, the icon
  // picker and `confirmPicker` below, all independent of `onSave`'s presence.
  export let readonly: boolean = false;
  /** Named in EditNote's read-only notice. */
  export let projectName: string = "";
  export let onSave: ((record: DataRecord) => Promise<void> | void) | undefined = undefined;
  export let onOpenNote: ((openMode: false | "tab" | "window") => void) | undefined = undefined;
  export let onRenameNote: ((newName: string) => void) | undefined = undefined;
  /**
   * Name of the field whose value is used as the record icon.
   * Auto-detects an "icon" field when omitted.
   */
  export let iconField: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: void; save: DataRecord }>();

  /**
   * #151, the half that stayed open: a link that did not resolve looked exactly
   * like one that did.
   *
   * The ticket recorded why — marking it in a TABLE CELL needs the target frame
   * in the cell, and it is not there. The peek is where it becomes possible:
   * the record it shows is the ENRICHED one, so the resolved companion
   * `__resolved__<field>` sits beside the raw wikilinks, and the difference
   * between them is the answer. No new data path and no re-resolution.
   *
   * A link counts as unresolved when nothing in the companion matches it by
   * path or by basename — the two keys the contract's own index matches on.
   */
  function linkStates(f: DataField): Array<{ link: string; resolved: boolean }> {
    if (!record) return [];
    const raw = normalizeRelationValue(record.values[f.name]);
    const companion = record.values[`__resolved__${f.name}`];
    const resolved = Array.isArray(companion) ? (companion as unknown[]) : [];
    const keys = new Set<string>();
    for (const r of resolved) {
      const rec = r as { id?: string };
      if (typeof rec?.id === "string") {
        keys.add(rec.id.toLowerCase());
        const base = rec.id.split("/").pop()?.replace(/\.md$/i, "");
        if (base) keys.add(base.toLowerCase());
      }
    }
    return raw.map((link) => {
      const bare = link.replace(/^\[\[|\]\]$/g, "").split("|")[0]?.trim() ?? link;
      const base = bare.split("/").pop()?.replace(/\.md$/i, "") ?? bare;
      return { link: bare, resolved: keys.has(bare.toLowerCase()) || keys.has(base.toLowerCase()) };
    });
  }

  $: relationFields = fields.filter((f) => f.type === DataFieldType.Relation && !f.derived);

  /** The fields that really become frontmatter keys — see the block below. */
  // i2-record (D07/N05): the peek shows the SAME properties block as the note
  // itself — the keys are its labels — and the computed properties (rollups,
  // formulas) read-only beneath it. A row that is not a note keeps the old editor.
  $: noteFile = (() => {
    const f = record && $appStore?.vault ? $appStore.vault.getAbstractFileByPath(record.id) : null;
    return f instanceof TFile ? f : null;
  })();
  $: isNote = noteFile !== null;
  $: computedFields = fields.filter((f) =>
    (f.type === DataFieldType.Formula || f.type === DataFieldType.Rollup || !!f.typeConfig?.rollup) && record?.values[f.name] != null);


  // N06: a cover is an image, not an icon — «[[Обложка….svg]]» was drawn as an
  // emoji over the title. Only an icon field gives the header its icon.
  const ICON_CANDIDATES = ["icon"];
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

  // #038: when the side panel closes, clear local picker state so the next
  // record doesn't open with a stuck-open picker or stale input value.
  // Assigned in a function the `$:` calls, never in the statement: the picker
  // input is bound to `pickerInput`, and in Svelte 3 a binding to a variable
  // assigned inside a `$:` statement re-runs that statement on the next flush
  // (R0.34). The picker is seeded by `openPicker` alone.
  function resetPickerWhenClosed(isOpen: boolean): void {
    if (isOpen) return;
    pickerOpen = false;
    pickerInput = "";
  }
  $: resetPickerWhenClosed(open);

  function openPicker() {
    pickerInput = typeof iconValue === "string" ? iconValue : "";
    pickerOpen = true;
  }

  function closePicker() {
    pickerOpen = false;
  }

  function confirmPicker() {
    if (readonly || !record || !resolvedIconField) { closePicker(); return; }
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

  function focusInput(node: HTMLElement) {
    requestAnimationFrame(() => node.querySelector("input")?.focus());
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
  <!-- Header icon slot: svelte:fragment must be unconditional direct child (Svelte 3 constraint).
       The {#if} lives inside the fragment so the slot is declared but empty when no icon field. -->
  <svelte:fragment slot="icon">
    {#if resolvedIconField && readonly}
      <!-- Read-only: the icon shows, but it is not a button — there is nothing to pick. -->
      <div class="ppp-rcv-icon-wrap">
        {#if iconValue}
          <span class="ppp-rcv-icon-static" aria-hidden="true">
            <PageIcon value={iconValue} size={1.25} />
          </span>
        {/if}
      </div>
    {:else if resolvedIconField}
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
            <!-- Enter (via the wrapper) confirms; Escape closes. A blur alone
                 writes nothing: the picker has its own ✓ and ✕. -->
            <span class="ppp-rcv-icon-field" use:focusInput>
              <TextField
                value={pickerInput}
                inputClass="ppp-rcv-icon-input"
                placeholder={$i18n.t("components.record-card-view.icon-placeholder")}
                ariaLabel={$i18n.t("views.dashboard.record-card.icon-input", { defaultValue: "Emoji or icon name" })}
                on:input={(e) => (pickerInput = e.detail)}
                on:cancel={closePicker}
              />
            </span>
            <button class="ppp-rcv-icon-confirm" on:click={confirmPicker} aria-label={$i18n.t("common.confirm")}>✓</button>
            <button class="ppp-rcv-icon-cancel" on:click={closePicker} aria-label={$i18n.t("common.cancel")}>✕</button>
          </div>
        {/if}
      </div>
    {/if}
  </svelte:fragment>

  <!-- Description block -->
  {#if descText}
    <div class="ppp-rcv-desc">{descText}</div>
  {/if}

  {#if record && isNote && noteFile}
    <NotePropertiesBlock app={$appStore} file={noteFile} />
    {#if computedFields.length > 0}
      <dl class="ppp-rcv-computed">
        {#each computedFields as field (field.name)}
          <div class="ppp-rcv-fm-row">
            <dt>{field.name}</dt>
            <dd>{formatDisplayValue(record.values[field.name]) || "—"}</dd>
          </div>
        {/each}
      </dl>
    {/if}
  {:else if record}
    <EditNote
      {fields}
      {record}
      {allRecords}
      {autosave}
      readonly={true}
      {projectName}
      onSave={handleSave}
      onOpenNote={onOpenNote}
      onRenameNote={onRenameNote}
    />

    <!--
      #151 / #168(c): which links found their target. Only the ones that did
      not are named — a row of ticks beside every working link is noise, and a
      single line about the broken one is what scene 4 asks for.
    -->
    {#each relationFields as rf (rf.name)}
      {@const broken = linkStates(rf).filter((st) => !st.resolved)}
      {#if broken.length > 0}
        <p class="ppp-rcv-unresolved" role="status">
          <strong>{rf.name}</strong>:
          {$i18n.t("views.dashboard.record-card.unresolved", {
            defaultValue: "no note found for",
          })}
          {broken.map((b) => b.link).join(", ")}
        </p>
      {/if}
    {/each}
  {:else}
    <div class="ppp-rcv-empty">
      {$i18n.t("views.dashboard.record-card.empty", { defaultValue: "No record selected" })}
    </div>
  {/if}
</SlideInPanel>

<style>
  .ppp-rcv-unresolved {
    margin: 0.5em 0 0;
    padding: 0.375em 0.5em;
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-modifier-error-hover, rgba(255, 0, 0, 0.08));
    color: var(--text-error, var(--text-muted));
    font-size: 0.85em;
  }

  /* Computed properties sit under the block as its own rows read-only:
     label left and muted, value right — the block's own columns. */
  .ppp-rcv-computed {
    display: grid;
    grid-template-columns: minmax(7rem, 30%) minmax(0, 1fr);
    gap: 0.25rem 0.5rem;
    margin: 0 0 0.75rem;
    padding: 0 0.25rem;
    font-size: var(--font-ui-small);
  }



  .ppp-rcv-fm-row {
    display: contents;
  }

  .ppp-rcv-computed dt {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-rcv-computed dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

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

  .ppp-rcv-icon-static {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem;
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

  .ppp-rcv-icon-field {
    display: flex;
    flex: 1;
    min-width: 0;
  }

  .ppp-rcv-icon-field :global(.ppp-rcv-icon-input) {
    width: 9rem;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-small);
    background: var(--background-secondary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    color: var(--text-normal);
  }

  .ppp-rcv-icon-field :global(.ppp-rcv-icon-input):focus {
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
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  /* theme-compat: an empty state is read, so --text-muted (WCAG AA in the
     default themes), not --text-faint (2.30:1 light, 2.97:1 dark). */
  .ppp-rcv-empty {
    padding: 1.5rem;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
  }
</style>
