<script lang="ts">
  /**
   * VisualizerPane.svelte (R1.2 — per-note overlay)
   *
   * Read/write surface for the active Markdown file's frontmatter.
   * Subscribes to workspace `active-leaf-change` and `metadataCache.changed`
   * to follow focus and external edits.
   *
   * R1.2 adds:
   *  - Per-row controls (pin, hide, move up/down).
   *  - "Show hidden" toggle.
   *  - "Reset overlay" action.
   *
   * Persistence is via `pp_overlay` frontmatter key (see lib/visualizer).
   */
  import { onMount, onDestroy } from "svelte";
  import { TFile, type App } from "obsidian";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import {
    applyOverlay,
    moveKey,
    readOverlay,
    toggleHidden,
    togglePinned,
    type NoteOverlay,
    type OverlayedEntry,
  } from "src/lib/visualizer/overlay";
  import { writeOverlay } from "src/lib/visualizer/overlayWriter";
  import { appendRelationToFile } from "src/lib/visualizer/relationsWriter";
  import {
    hexLuminance,
    isColorValue,
    normalizeColor,
  } from "src/lib/visualizer/colors";
  import {
    PROPERTY_TYPES,
    readPropertyTypes,
    resolveType,
    type PropertyType,
  } from "src/lib/visualizer/propertyTypes";
  import { setPropertyType } from "src/lib/visualizer/propertyTypesWriter";
  import { buildLinkHref } from "src/lib/visualizer/linkRender";
  import { openContextMenu } from "src/lib/contextMenu";
  import {
    formatCellValue,
    parseCellInput,
    type CellEditType,
  } from "src/lib/database/cellEditor";
  import { writeCellValue } from "src/lib/database/cellEditorWriter";
  import {
    lookupInverse,
    type InverseIndex,
  } from "src/lib/relations/inverseIndex";
  import type { InverseIndexStore } from "src/lib/relations/inverseIndexStore";
  import {
    RelationPickerModal,
    pathFromFile,
  } from "./RelationPickerModal";

  export let app: App;
  export let inverseIndexStore: InverseIndexStore | undefined = undefined;

  let activeFile: TFile | null = null;
  let frontmatter: Record<string, unknown> | null = null;
  let overlay: NoteOverlay = { hidden: [], pinned: [], order: [] };
  let showHidden = false;
  let writing = false;
  let unsub: (() => void) | null = null;
  let metaUnsub: (() => void) | null = null;

  $: t = $i18n.t.bind($i18n);

  function refresh() {
    const file = app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      activeFile = null;
      frontmatter = null;
      overlay = { hidden: [], pinned: [], order: [] };
      return;
    }
    activeFile = file;
    const cache = app.metadataCache.getFileCache(file);
    frontmatter = (cache?.frontmatter as Record<string, unknown> | null) ?? null;
    overlay = readOverlay(frontmatter);
  }

  onMount(() => {
    refresh();
    const leafRef = app.workspace.on("active-leaf-change", refresh);
    unsub = () => app.workspace.offref(leafRef);
    const metaRef = app.metadataCache.on("changed", (file: TFile) => {
      if (file === activeFile) refresh();
    });
    metaUnsub = () => app.metadataCache.offref(metaRef);
  });

  onDestroy(() => {
    if (unsub) unsub();
    if (metaUnsub) metaUnsub();
  });

  $: entries = applyOverlay(frontmatter, overlay, { showHidden });
  $: typeOverrides = readPropertyTypes(frontmatter);

  // R2.4 — inverse links derived from a session-scoped index. The store
  // may be absent (e.g. unit tests); we fall back to an empty map.
  let inverseIndex: InverseIndex = new Map();
  $: if (inverseIndexStore) {
    const unsubInv = inverseIndexStore.subscribe((idx) => {
      inverseIndex = idx;
    });
    onDestroy(unsubInv);
  }
  $: linkedFrom = activeFile
    ? lookupInverse(inverseIndex, activeFile.path)
    : [];

  function openLinkedFromNote(path: string): void {
    const file = app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      void app.workspace.getLeaf(false).openFile(file);
    }
  }

  /** Strip path + `.md` suffix for compact display in the linked-from list. */
  function linkBasename(path: string): string {
    const slash = path.lastIndexOf("/");
    const base = slash >= 0 ? path.slice(slash + 1) : path;
    return base.replace(/\.md$/i, "");
  }

  async function persist(next: NoteOverlay) {
    if (!activeFile || writing) return;
    overlay = next; // optimistic
    writing = true;
    try {
      await writeOverlay(app, activeFile, next);
    } finally {
      writing = false;
    }
  }

  function isPrimitive(v: unknown): boolean {
    return v === null || ["string", "number", "boolean"].includes(typeof v);
  }

  function formatValue(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  /**
   * R1.4 — Choose a swatch border colour that contrasts against the
   * filler. Light fillers get a darker border, dark fillers get a
   * lighter one. For non-hex values we fall back to a neutral border.
   */
  function swatchBorder(color: string): string {
    if (!color.startsWith("#")) return "var(--background-modifier-border)";
    return hexLuminance(color) > 0.7 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.35)";
  }

  function handleHide(entry: OverlayedEntry) {
    persist(toggleHidden(overlay, entry.key));
  }

  function handlePin(entry: OverlayedEntry) {
    persist(togglePinned(overlay, entry.key));
  }

  function handleMove(entry: OverlayedEntry, direction: -1 | 1) {
    const visible = entries.filter((e) => !e.hidden).map((e) => e.key);
    persist(moveKey(overlay, visible, entry.key, direction));
  }

  function handleReset() {
    persist({ hidden: [], pinned: [], order: [] });
  }

  function handleAddRelation() {
    if (!activeFile) return;
    const file = activeFile;
    const modal = new RelationPickerModal(
      app,
      (chosen) => {
        void appendRelationToFile(app, file, { path: pathFromFile(chosen) });
      },
      {
        excludePath: file.path,
        placeholder: t("views.visualizer.pane.actions.pick-relation-placeholder"),
      },
    );
    modal.open();
  }

  /**
   * R1.5 — Open the property-type popup anchored at the trigger element.
   * Persists the choice via processFrontMatter; "Auto" clears the override.
   */
  function handleTypePopup(
    event: MouseEvent,
    key: string,
    current: PropertyType,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    if (!activeFile) return;
    const file = activeFile;
    const target = event.currentTarget as HTMLElement;

    const entries = [
      {
        title: t("views.visualizer.pane.types.auto"),
        icon: "wand-2",
        onClick: () => {
          void setPropertyType(app, file, key, null);
        },
      },
      { separator: true as const },
      ...PROPERTY_TYPES.map((type) => ({
        title: t(`data-types.${type}`),
        checked: type === current,
        onClick: () => {
          void setPropertyType(app, file, key, type);
        },
      })),
    ];
    openContextMenu(entries, target, app);
  }

  $: hasOverlay =
    overlay.hidden.length > 0 ||
    overlay.pinned.length > 0 ||
    overlay.order.length > 0;

  // ── R2.6 — inline cell editing ──────────────────────────
  // Reserved frontmatter keys (pp_*, $*) and computed types
  // (formula, rollup) are read-only; everything else is editable
  // via a single click on the value cell.
  const READONLY_TYPES = new Set<string>(["formula", "rollup"]);

  let editingKey: string | null = null;
  let editingDraft = "";
  let editingError: string | null = null;

  function isEditableType(type: PropertyType): type is CellEditType {
    return !READONLY_TYPES.has(type);
  }

  function isReservedKey(key: string): boolean {
    return key.startsWith("pp_") || key.startsWith("$");
  }

  function startEdit(entry: OverlayedEntry, type: PropertyType): void {
    if (!isEditableType(type) || isReservedKey(entry.key)) return;
    editingKey = entry.key;
    editingDraft = formatCellValue(entry.value as never, type);
    editingError = null;
  }

  function cancelEdit(): void {
    editingKey = null;
    editingDraft = "";
    editingError = null;
  }

  async function commitEdit(entry: OverlayedEntry, type: PropertyType): Promise<void> {
    if (!activeFile || !isEditableType(type)) {
      cancelEdit();
      return;
    }
    const result = parseCellInput(editingDraft, type);
    if (!result.ok) {
      editingError = t(result.error.i18nKey);
      return;
    }
    const file = activeFile;
    writing = true;
    try {
      await writeCellValue(app, file, entry.key, result.value);
      cancelEdit();
    } finally {
      writing = false;
    }
  }

  async function commitBoolean(entry: OverlayedEntry, next: boolean): Promise<void> {
    if (!activeFile) return;
    const file = activeFile;
    writing = true;
    try {
      await writeCellValue(app, file, entry.key, next);
    } finally {
      writing = false;
    }
  }

  function handleEditKeydown(
    event: KeyboardEvent,
    entry: OverlayedEntry,
    type: PropertyType,
  ): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitEdit(entry, type);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }

  function inputTypeFor(type: CellEditType): string {    switch (type) {
      case "number":
        return "number";
      case "date":
        return "date";
      case "datetime":
        return "datetime-local";
      case "color":
        return "text";
      default:
        return "text";
    }
  }
</script>

<div class="ppp-vis-pane">
  {#if !activeFile}
    <div class="ppp-vis-pane-empty">
      {t("views.visualizer.pane.no-file")}
    </div>
  {:else}
    <header class="ppp-vis-pane-header">
      <div class="ppp-vis-pane-title">{activeFile.basename}</div>
      <div class="ppp-vis-pane-subtitle">{activeFile.path}</div>
      <div class="ppp-vis-pane-toolbar">
        <button
          type="button"
          class="ppp-vis-pane-tool"
          class:is-active={showHidden}
          on:click={() => (showHidden = !showHidden)}
          aria-pressed={showHidden}
          title={showHidden
            ? t("views.visualizer.pane.actions.hide-hidden")
            : t("views.visualizer.pane.actions.show-hidden")}
        >
          {showHidden
            ? t("views.visualizer.pane.actions.hide-hidden")
            : t("views.visualizer.pane.actions.show-hidden")}
        </button>
        <button
          type="button"
          class="ppp-vis-pane-tool"
          on:click={handleReset}
          disabled={!hasOverlay || writing}
          title={t("views.visualizer.pane.actions.reset")}
        >
          {t("views.visualizer.pane.actions.reset")}
        </button>
        <button
          type="button"
          class="ppp-vis-pane-tool"
          on:click={handleAddRelation}
          disabled={writing}
          title={t("views.visualizer.pane.actions.add-relation")}
        >
          {t("views.visualizer.pane.actions.add-relation")}
        </button>
      </div>
    </header>

    {#if entries.length === 0}
      <div class="ppp-vis-pane-empty">
        {t("views.visualizer.pane.no-properties")}
      </div>
    {:else}
      <ul class="ppp-vis-pane-list">
        {#each entries as entry, idx (entry.key)}
          {@const currentType = resolveType(entry.key, entry.value, typeOverrides)}
          {@const editable = isEditableType(currentType) && !isReservedKey(entry.key)}
          <li
            class="ppp-vis-pane-row"
            class:is-pinned={entry.pinned}
            class:is-hidden={entry.hidden}
          >
            <span class="ppp-vis-pane-key">
              {#if entry.pinned}
                <span class="ppp-vis-pane-pin-marker" aria-hidden="true">▲</span>
              {/if}
              {entry.key}
              <button
                type="button"
                class="ppp-vis-pane-type-chip"
                class:is-overridden={typeOverrides[entry.key] !== undefined}
                on:click={(e) => handleTypePopup(e, entry.key, currentType)}
                aria-label={t("views.visualizer.pane.actions.set-type")}
              >{t(`data-types.${currentType}`)}</button>
            </span>
            {#if editingKey === entry.key && editable}
              <!-- R2.6 — inline editor. Boolean uses a checkbox; all
                   other editable types share a single text input. -->
              <span class="ppp-vis-pane-value is-editing">
                {#if currentType === "boolean"}
                  <input
                    type="checkbox"
                    class="ppp-vis-pane-edit-checkbox"
                    checked={entry.value === true}
                    disabled={writing}
                    on:change={(e) => commitBoolean(entry, e.currentTarget.checked)}
                    on:blur={cancelEdit}
                  />
                {:else}
                  <input
                    type={inputTypeFor(currentType)}
                    class="ppp-vis-pane-edit-input"
                    class:is-error={editingError !== null}
                    value={editingDraft}
                    disabled={writing}
                    on:input={(e) => (editingDraft = e.currentTarget.value)}
                    on:keydown={(e) => handleEditKeydown(e, entry, currentType)}
                    on:blur={() => commitEdit(entry, currentType)}
                  />
                  {#if editingError}
                    <span class="ppp-vis-pane-edit-error" role="alert">{editingError}</span>
                  {/if}
                {/if}
              </span>
            {:else}
              <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <span
                class="ppp-vis-pane-value"
                class:is-array={Array.isArray(entry.value)}
                class:is-object={!isPrimitive(entry.value) && !Array.isArray(entry.value)}
                class:is-editable={editable}
                role={editable ? "button" : undefined}
                tabindex={editable ? 0 : undefined}
                on:click={() => editable && startEdit(entry, currentType)}
                on:keydown={(e) => {
                  if (editable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    startEdit(entry, currentType);
                  }
                }}
              >
                {#if isColorValue(entry.value)}
                  {@const color = normalizeColor(entry.value) ?? ""}
                  <span
                    class="ppp-vis-pane-swatch"
                    style="background:{color}; border-color:{swatchBorder(color)};"
                    aria-hidden="true"
                  ></span>
                {/if}
                {#if currentType === "url" || currentType === "email" || currentType === "phone"}
                  {@const link = buildLinkHref(entry.value, currentType)}
                  {#if link}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <a
                      class="ppp-vis-pane-link"
                      href={link.href}
                      target={currentType === "url" ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      on:click|stopPropagation
                    >{link.label}</a>
                  {:else}
                    {formatValue(entry.value)}
                  {/if}
                {:else}
                  {formatValue(entry.value)}
                {/if}
              </span>
            {/if}
            <span class="ppp-vis-pane-actions">
              <button
                type="button"
                class="ppp-vis-pane-action"
                on:click={() => handleMove(entry, -1)}
                disabled={writing || idx === 0 || entry.hidden}
                title={t("views.visualizer.pane.actions.move-up")}
                aria-label={t("views.visualizer.pane.actions.move-up")}
              >▲</button>
              <button
                type="button"
                class="ppp-vis-pane-action"
                on:click={() => handleMove(entry, 1)}
                disabled={writing || idx === entries.length - 1 || entry.hidden}
                title={t("views.visualizer.pane.actions.move-down")}
                aria-label={t("views.visualizer.pane.actions.move-down")}
              >▼</button>
              <button
                type="button"
                class="ppp-vis-pane-action"
                on:click={() => handlePin(entry)}
                disabled={writing}
                aria-pressed={entry.pinned}
                title={entry.pinned
                  ? t("views.visualizer.pane.actions.unpin")
                  : t("views.visualizer.pane.actions.pin")}
                aria-label={entry.pinned
                  ? t("views.visualizer.pane.actions.unpin")
                  : t("views.visualizer.pane.actions.pin")}
              ><Icon name="pin" size={14} /></button>
              <button
                type="button"
                class="ppp-vis-pane-action"
                on:click={() => handleHide(entry)}
                disabled={writing}
                aria-pressed={entry.hidden}
                title={entry.hidden
                  ? t("views.visualizer.pane.actions.unhide")
                  : t("views.visualizer.pane.actions.hide")}
                aria-label={entry.hidden
                  ? t("views.visualizer.pane.actions.unhide")
                  : t("views.visualizer.pane.actions.hide")}
              ><Icon name={entry.hidden ? "eye" : "eye-off"} size={14} /></button>
            </span>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- R2.4 — runtime-derived inverse relations. Always rendered (even
         when empty) so users discover the feature exists. -->
    <section class="ppp-vis-pane-linked">
      <h3 class="ppp-vis-pane-section-title">
        {t("views.visualizer.pane.linked-from.title")}
      </h3>
      {#if linkedFrom.length === 0}
        <div class="ppp-vis-pane-empty">
          {t("views.visualizer.pane.linked-from.empty")}
        </div>
      {:else}
        <ul class="ppp-vis-pane-linked-list">
          {#each linkedFrom as link (link.sourcePath + ":" + link.viaKey)}
            <li class="ppp-vis-pane-linked-row">
              <button
                type="button"
                class="ppp-vis-pane-linked-link internal-link"
                on:click={() => openLinkedFromNote(link.sourcePath)}
                title={link.sourcePath}
              >{linkBasename(link.sourcePath)}</button>
              <span class="ppp-vis-pane-linked-via">
                {t("views.visualizer.pane.linked-from.via")} <code>{link.viaKey}</code>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .ppp-vis-pane {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    font-size: 0.875rem;
  }
  .ppp-vis-pane-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  .ppp-vis-pane-title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-normal);
  }
  .ppp-vis-pane-subtitle {
    font-size: 0.75rem;
    color: var(--text-muted);
    word-break: break-word;
  }
  .ppp-vis-pane-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.25rem;
  }
  .ppp-vis-pane-tool {
    background: var(--background-secondary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .ppp-vis-pane-tool:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }
  .ppp-vis-pane-tool.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }
  .ppp-vis-pane-tool:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .ppp-vis-pane-empty {
    padding: 1rem;
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
  }
  .ppp-vis-pane-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .ppp-vis-pane-row {
    display: grid;
    grid-template-columns: minmax(6rem, 28%) 1fr auto;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.25rem 0;
    min-height: 1.75rem;
  }
  .ppp-vis-pane-row.is-pinned {
    background: var(--background-modifier-active-hover, transparent);
  }
  .ppp-vis-pane-row.is-hidden {
    opacity: 0.5;
  }
  .ppp-vis-pane-key {
    color: var(--text-muted);
    font-weight: 500;
    word-break: break-word;
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }
  .ppp-vis-pane-pin-marker {
    color: var(--interactive-accent);
    font-size: 0.625rem;
  }
  .ppp-vis-pane-type-chip {
    background: var(--background-secondary);
    color: var(--text-faint);
    border: 0;
    border-radius: 0.1875rem;
    padding: 0 0.25rem;
    font-size: 0.625rem;
    line-height: 1.25;
    cursor: pointer;
    margin-left: 0.25rem;
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }
  .ppp-vis-pane-type-chip:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  .ppp-vis-pane-type-chip.is-overridden {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  .ppp-vis-pane-value {
    color: var(--text-normal);
    word-break: break-word;
  }
  /* PARITY-001 — URL/Email/Phone clickable rendering. */
  .ppp-vis-pane-link {
    color: var(--text-accent);
    text-decoration: underline;
    text-underline-offset: 0.125rem;
    word-break: break-all;
  }
  .ppp-vis-pane-link:hover {
    color: var(--text-accent-hover);
  }
  .ppp-vis-pane-swatch {
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 0.1875rem;
    margin-right: 0.375rem;
    vertical-align: -0.125rem;
    border: 1px solid var(--background-modifier-border);
  }
  .ppp-vis-pane-value.is-array,
  .ppp-vis-pane-value.is-object {
    font-family: var(--font-monospace);
    font-size: 0.8125rem;
  }
  .ppp-vis-pane-value.is-object {
    color: var(--text-faint);
  }
  .ppp-vis-pane-actions {
    display: flex;
    gap: 0.125rem;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .ppp-vis-pane-row:hover .ppp-vis-pane-actions,
  .ppp-vis-pane-row:focus-within .ppp-vis-pane-actions {
    opacity: 1;
  }
  .ppp-vis-pane-action {
    background: transparent;
    border: 0;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.125rem 0.25rem;
    border-radius: 0.1875rem;
    font-size: 0.75rem;
    line-height: 1;
  }
  .ppp-vis-pane-action:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  .ppp-vis-pane-action:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .ppp-vis-pane-action[aria-pressed="true"] {
    color: var(--interactive-accent);
  }
  /* R2.4 — Linked-from section.
     The hairline top border counts as one new entry in the px-budget. */
  .ppp-vis-pane-linked {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .ppp-vis-pane-section-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0;
  }
  .ppp-vis-pane-linked-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .ppp-vis-pane-linked-row {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    flex-wrap: wrap;
  }
  .ppp-vis-pane-linked-link {
    background: transparent;
    border: none;
    padding: 0;
    color: var(--text-accent);
    cursor: pointer;
    text-align: left;
    font: inherit;
    text-decoration: underline;
    text-decoration-color: transparent;
    transition: text-decoration-color 0.15s ease;
  }
  .ppp-vis-pane-linked-link:hover {
    text-decoration-color: currentColor;
  }
  .ppp-vis-pane-linked-via {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .ppp-vis-pane-linked-via code {
    font-size: 0.75rem;
    background: var(--background-secondary);
    padding: 0 0.25rem;
    border-radius: 0.25rem;
  }
  /* R2.6 — inline cell editor */
  .ppp-vis-pane-value.is-editable {
    cursor: text;
    border-radius: 0.25rem;
    transition: background 0.15s ease;
  }
  .ppp-vis-pane-value.is-editable:hover {
    background: var(--background-modifier-hover);
  }
  .ppp-vis-pane-value.is-editing {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .ppp-vis-pane-edit-input {
    width: 100%;
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--interactive-accent);
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
    font: inherit;
  }
  .ppp-vis-pane-edit-input.is-error {
    border-color: var(--text-error);
  }
  .ppp-vis-pane-edit-checkbox {
    cursor: pointer;
  }
  .ppp-vis-pane-edit-error {
    font-size: 0.75rem;
    color: var(--text-error);
  }
</style>
