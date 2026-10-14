<script lang="ts">
  /**
   * NotePropertiesBlock (3.7.2 B2) — the note's properties in the note header,
   * where Obsidian shows its own "Properties" block. Replaces the YAML
   * Visualizer side pane: pin, hide, show hidden, order, property type, add
   * relation and reset live in the row "⋯" menu and the block "⋯" menu;
   * "+ Property" adds a key as in Notion.
   *
   * Reads: metadataCache frontmatter + `pp_overlay` / `pp_types`.
   * Writes: the frontmatter writer, one key per commit, only on change
   * (planValueWrite); overlay and types through their own writers. Reserved
   * keys (`pp_*`, `$*`) and calculated types are never edited here.
   */
  import { onDestroy, onMount, tick } from "svelte";
  import { TFile, type App, type EventRef } from "obsidian";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import {
    moveKey,
    readOverlay,
    toggleHidden,
    togglePinned,
    type NoteOverlay,
    type OverlayedEntry,
  } from "src/lib/visualizer/overlay";
  import { writeOverlay } from "src/lib/visualizer/overlayWriter";
  import { appendRelationToFile } from "src/lib/visualizer/relationsWriter";
  import { isColorValue, normalizeColor } from "src/lib/visualizer/colors";
  import {
    PROPERTY_TYPES,
    readPropertyTypes,
    resolveType,
    type PropertyType,
  } from "src/lib/visualizer/propertyTypes";
  import { setPropertyType } from "src/lib/visualizer/propertyTypesWriter";
  import { buildLinkHref } from "src/lib/visualizer/linkRender";
  import { openContextMenu, type ContextMenuEntry } from "src/lib/contextMenu";
  import type { CellEditType, CellValue } from "src/lib/database/cellEditor";
  import { writeCellValue } from "src/lib/database/cellEditorWriter";
  import { isWikilink, stripToDisplay, stripToPath } from "src/lib/engine/wikilink";
  import { lookupInverse, type InverseIndex } from "src/lib/relations/inverseIndex";
  import type { InverseIndexStore } from "src/lib/relations/inverseIndexStore";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import DateField from "src/ui/components/fields/DateField.svelte";
  import { RelationPickerModal, pathFromFile } from "src/ui/views/VisualizerPane/RelationPickerModal";
  import {
    dateToCellText,
    draftOf,
    isReservedPropertyKey,
    parseStoredDate,
    planValueWrite,
    validateNewPropertyName,
    visibleProperties,
  } from "./noteProperties";

  export let app: App;
  export let file: TFile;
  export let inverseIndexStore: InverseIndexStore | undefined = undefined;

  const EMPTY_OVERLAY: NoteOverlay = { hidden: [], pinned: [], order: [] };
  const READONLY_TYPES = new Set<string>(["formula", "rollup"]);

  let frontmatter: Record<string, unknown> | null = null;
  let overlay: NoteOverlay = EMPTY_OVERLAY;
  let showHidden = false;
  let collapsed = false;
  let writing = false;
  let editingKey: string | null = null;
  let editError: string | null = null;
  let adding = false;
  let addError: string | null = null;
  let inverseIndex: InverseIndex = new Map();
  let editField: TextField | null = null;
  let addField: TextField | null = null;

  $: t = $i18n.t.bind($i18n);

  function refresh(target: TFile): void {
    const cache = app.metadataCache.getFileCache(target);
    frontmatter = (cache?.frontmatter as Record<string, unknown> | undefined) ?? null;
    overlay = readOverlay(frontmatter);
  }
  $: refresh(file);

  let metaRef: EventRef | null = null;
  let unsubInverse: (() => void) | null = null;
  onMount(() => {
    metaRef = app.metadataCache.on("changed", (changed: TFile) => {
      if (changed.path === file.path) refresh(file);
    });
    if (inverseIndexStore) {
      unsubInverse = inverseIndexStore.subscribe((idx) => {
        inverseIndex = idx;
      });
    }
  });
  onDestroy(() => {
    if (metaRef) app.metadataCache.offref(metaRef);
    unsubInverse?.();
  });

  $: entries = visibleProperties(frontmatter, overlay, { showHidden });
  $: typeOverrides = readPropertyTypes(frontmatter);
  $: linkedFrom = lookupInverse(inverseIndex, file.path);
  $: hasOverlay = overlay.hidden.length + overlay.pinned.length + overlay.order.length > 0;
  $: hiddenCount = overlay.hidden.filter((k) => frontmatter && k in frontmatter).length;

  function typeOf(entry: OverlayedEntry): PropertyType {
    return resolveType(entry.key, entry.value, typeOverrides);
  }
  function editable(entry: OverlayedEntry, type: PropertyType): type is CellEditType {
    return !READONLY_TYPES.has(type) && !isReservedPropertyKey(entry.key);
  }

  async function persistOverlay(next: NoteOverlay): Promise<void> {
    if (writing) return;
    overlay = next;
    writing = true;
    try {
      await writeOverlay(app, file, next);
    } finally {
      writing = false;
    }
  }

  async function writeKey(key: string, value: CellValue): Promise<void> {
    writing = true;
    try {
      await writeCellValue(app, file, key, value);
    } finally {
      writing = false;
    }
  }

  // ── Value editing ────────────────────────────────────────
  async function startEdit(entry: OverlayedEntry, type: PropertyType): Promise<void> {
    if (!editable(entry, type) || type === "boolean" || type === "date" || type === "datetime") return;
    editingKey = entry.key;
    editError = null;
    await tick();
    editField?.focus();
  }

  function endEdit(): void {
    editingKey = null;
    editError = null;
  }

  async function commitText(entry: OverlayedEntry, type: CellEditType, draft: string): Promise<void> {
    const plan = planValueWrite(entry.value, draft, type);
    if (plan.kind === "invalid") {
      editError = t(plan.i18nKey);
      return;
    }
    endEdit();
    if (plan.kind === "write") await writeKey(entry.key, plan.value);
  }

  function validDraft(type: CellEditType): (draft: string) => boolean {
    return (draft) => planValueWrite(null, draft, type).kind !== "invalid";
  }

  async function commitDate(entry: OverlayedEntry, type: CellEditType, next: Date | null): Promise<void> {
    const text = next ? dateToCellText(next, type === "datetime") : "";
    const plan = planValueWrite(entry.value, text, type);
    if (plan.kind === "write") await writeKey(entry.key, plan.value);
  }

  async function commitBoolean(entry: OverlayedEntry, next: boolean): Promise<void> {
    if (entry.value === next) return;
    await writeKey(entry.key, next);
  }

  // ── New property ─────────────────────────────────────────
  async function startAdd(): Promise<void> {
    adding = true;
    addError = null;
    await tick();
    addField?.focus();
  }

  async function commitAdd(name: string): Promise<void> {
    const verdict = validateNewPropertyName(name, frontmatter);
    if (!verdict.ok) {
      if (verdict.reason === "empty") {
        adding = false;
        addError = null;
        return;
      }
      addError = t(`views.visualizer.block.errors.${verdict.reason}`);
      return;
    }
    adding = false;
    addError = null;
    await writeKey(verdict.key, "");
    editingKey = verdict.key;
    await tick();
    editField?.focus();
  }

  // ── Menus ────────────────────────────────────────────────
  function rowMenu(event: MouseEvent, entry: OverlayedEntry, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    const current = typeOf(entry);
    const visibleKeys = entries.filter((e) => !e.hidden).map((e) => e.key);
    const items: ContextMenuEntry[] = [
      {
        title: entry.pinned ? t("views.visualizer.pane.actions.unpin") : t("views.visualizer.pane.actions.pin"),
        icon: entry.pinned ? "pin-off" : "pin",
        onClick: () => void persistOverlay(togglePinned(overlay, entry.key)),
      },
      {
        title: entry.hidden ? t("views.visualizer.pane.actions.unhide") : t("views.visualizer.pane.actions.hide"),
        icon: entry.hidden ? "eye" : "eye-off",
        onClick: () => void persistOverlay(toggleHidden(overlay, entry.key)),
      },
      { separator: true },
      {
        title: t("views.visualizer.pane.actions.move-up"),
        icon: "arrow-up",
        disabled: entry.hidden || index === 0,
        onClick: () => void persistOverlay(moveKey(overlay, visibleKeys, entry.key, -1)),
      },
      {
        title: t("views.visualizer.pane.actions.move-down"),
        icon: "arrow-down",
        disabled: entry.hidden || index >= visibleKeys.length - 1,
        onClick: () => void persistOverlay(moveKey(overlay, visibleKeys, entry.key, 1)),
      },
      { separator: true },
      {
        title: `${t("views.visualizer.block.type")}: ${t(`data-types.${current}`)}`,
        icon: "shapes",
        onClick: () => undefined,
        submenu: [
          {
            title: t("views.visualizer.pane.types.auto"),
            icon: "wand-2",
            checked: typeOverrides[entry.key] === undefined,
            onClick: () => void setPropertyType(app, file, entry.key, null),
          },
          { separator: true },
          ...PROPERTY_TYPES.map((type) => ({
            title: t(`data-types.${type}`),
            checked: typeOverrides[entry.key] === type,
            onClick: () => void setPropertyType(app, file, entry.key, type),
          })),
        ],
      },
    ];
    openContextMenu(items, event.currentTarget as HTMLElement, app);
  }

  function blockMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const items: ContextMenuEntry[] = [
      {
        title: showHidden
          ? t("views.visualizer.pane.actions.hide-hidden")
          : `${t("views.visualizer.pane.actions.show-hidden")} (${hiddenCount})`,
        icon: showHidden ? "eye-off" : "eye",
        checked: showHidden,
        disabled: !showHidden && hiddenCount === 0,
        onClick: () => {
          showHidden = !showHidden;
        },
      },
      {
        title: t("views.visualizer.pane.actions.add-relation"),
        icon: "link",
        onClick: addRelation,
      },
      { separator: true },
      {
        title: t("views.visualizer.pane.actions.reset"),
        icon: "rotate-ccw",
        disabled: !hasOverlay,
        onClick: () => void persistOverlay({ hidden: [], pinned: [], order: [] }),
      },
    ];
    openContextMenu(items, event.currentTarget as HTMLElement, app);
  }

  function addRelation(): void {
    const target = file;
    new RelationPickerModal(
      app,
      (chosen) => {
        void appendRelationToFile(app, target, { path: pathFromFile(chosen) });
      },
      {
        excludePath: target.path,
        placeholder: t("views.visualizer.pane.actions.pick-relation-placeholder"),
      },
    ).open();
  }

  // ── Display helpers ──────────────────────────────────────
  function items(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((x) => String(x));
    if (value === null || value === undefined || value === "") return [];
    return [String(value)];
  }

  function openLink(raw: string): void {
    void app.workspace.openLinkText(stripToPath(raw), file.path, false);
  }

  function openPath(path: string): void {
    const target = app.vault.getAbstractFileByPath(path);
    if (target instanceof TFile) void app.workspace.getLeaf(false).openFile(target);
  }

  function baseName(path: string): string {
    const slash = path.lastIndexOf("/");
    return (slash >= 0 ? path.slice(slash + 1) : path).replace(/\.md$/i, "");
  }

  function iconFor(type: PropertyType): string {
    switch (type) {
      case "number": return "binary";
      case "boolean": return "check-square";
      case "date": return "calendar";
      case "datetime": return "clock";
      case "list": return "list";
      case "tags": return "tags";
      case "select": case "status": return "circle-dot";
      case "color": return "palette";
      case "relation": return "link";
      case "formula": case "rollup": return "sigma";
      case "url": return "globe";
      case "email": return "mail";
      case "phone": return "phone";
      default: return "text";
    }
  }
</script>

<section class="ppp-note-props" aria-label={t("views.visualizer.block.title")}>
  <header class="ppp-note-props__head">
    <button
      type="button"
      class="ppp-note-props__title"
      aria-expanded={!collapsed}
      on:click={() => (collapsed = !collapsed)}
    >
      <Icon name={collapsed ? "chevron-right" : "chevron-down"} size="sm" />
      {t("views.visualizer.block.title")}
    </button>
    <button
      type="button"
      class="ppp-note-props__icon clickable-icon"
      aria-label={t("views.visualizer.block.options")}
      title={t("views.visualizer.block.options")}
      on:click={blockMenu}
    ><Icon name="more-horizontal" size="sm" /></button>
  </header>

  {#if !collapsed}
    <ul class="ppp-note-props__list">
      {#each entries as entry, index (entry.key)}
        {@const type = typeOf(entry)}
        {@const canEdit = editable(entry, type)}
        <li class="ppp-note-props__row" class:is-hidden={entry.hidden} class:is-pinned={entry.pinned}>
          <button
            type="button"
            class="ppp-note-props__key"
            title={`${entry.key} · ${t(`data-types.${type}`)}`}
            on:click={(e) => rowMenu(e, entry, index)}
          >
            <Icon name={entry.pinned ? "pin" : iconFor(type)} size="sm" />
            <span class="ppp-note-props__key-text">{entry.key}</span>
          </button>

          <div class="ppp-note-props__value">
            {#if canEdit && type === "boolean"}
              <input
                type="checkbox"
                class="ppp-note-props__check"
                checked={entry.value === true}
                disabled={writing}
                aria-label={entry.key}
                on:change={(e) => commitBoolean(entry, e.currentTarget.checked)}
              />
            {:else if canEdit && (type === "date" || type === "datetime")}
              <DateField
                value={parseStoredDate(entry.value)}
                withTime={type === "datetime"}
                disabled={writing}
                ariaLabel={entry.key}
                on:change={(e) => commitDate(entry, type, e.detail)}
              />
            {:else if canEdit && editingKey === entry.key}
              <TextField
                bind:this={editField}
                value={draftOf(entry.value, type)}
                ariaLabel={entry.key}
                validate={validDraft(type)}
                commitUnchanged
                inputMode={type === "number" ? "decimal" : type === "email" ? "email" : type === "url" ? "url" : type === "phone" ? "tel" : "text"}
                on:commit={(e) => commitText(entry, type, e.detail.value)}
                on:cancel={endEdit}
              />
              {#if editError}
                <span class="ppp-note-props__error" role="alert">{editError}</span>
              {/if}
            {:else}
              <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
              <div
                class="ppp-note-props__display"
                class:is-editable={canEdit}
                class:is-readonly={!canEdit}
                role={canEdit ? "button" : undefined}
                tabindex={canEdit ? 0 : undefined}
                title={canEdit ? undefined : t("views.visualizer.block.read-only")}
                on:click={() => canEdit && startEdit(entry, type)}
                on:keydown={(e) => {
                  if (canEdit && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    void startEdit(entry, type);
                  }
                }}
              >
                {#if items(entry.value).length === 0}
                  <span class="ppp-note-props__empty">{t("views.visualizer.block.empty")}</span>
                {:else if Array.isArray(entry.value) || type === "relation" || type === "tags"}
                  {#each items(entry.value) as item}
                    {#if isWikilink(item)}
                      <button
                        type="button"
                        class="ppp-note-props__chip internal-link"
                        on:click|stopPropagation={() => openLink(item)}
                      >{stripToDisplay(item)}</button>
                    {:else}
                      <span class="ppp-note-props__chip">{type === "tags" ? `#${item.replace(/^#+/, "")}` : item}</span>
                    {/if}
                  {/each}
                {:else if isColorValue(entry.value)}
                  <span class="ppp-note-props__swatch" style:background={normalizeColor(entry.value) ?? ""} aria-hidden="true"></span>
                  {String(entry.value)}
                {:else if type === "url" || type === "email" || type === "phone"}
                  {@const link = buildLinkHref(entry.value, type)}
                  {#if link}
                    <a
                      class="ppp-note-props__link"
                      href={link.href}
                      target={type === "url" ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      on:click|stopPropagation
                    >{link.label}</a>
                  {:else}
                    {String(entry.value)}
                  {/if}
                {:else if typeof entry.value === "object"}
                  <code class="ppp-note-props__object">{JSON.stringify(entry.value)}</code>
                {:else}
                  {String(entry.value)}
                {/if}
              </div>
            {/if}
          </div>

          <button
            type="button"
            class="ppp-note-props__icon clickable-icon"
            aria-label={t("views.visualizer.block.more")}
            title={t("views.visualizer.block.more")}
            on:click={(e) => rowMenu(e, entry, index)}
          ><Icon name="more-horizontal" size="sm" /></button>
        </li>
      {/each}
    </ul>

    {#if adding}
      <div class="ppp-note-props__add-row">
        <TextField
          bind:this={addField}
          placeholder={t("views.visualizer.block.name-placeholder")}
          ariaLabel={t("views.visualizer.block.name-placeholder")}
          commitUnchanged
          on:commit={(e) => commitAdd(e.detail.value)}
          on:cancel={() => {
            adding = false;
            addError = null;
          }}
        />
        {#if addError}
          <span class="ppp-note-props__error" role="alert">{addError}</span>
        {/if}
      </div>
    {:else}
      <button type="button" class="ppp-note-props__add" disabled={writing} on:click={startAdd}>
        {t("views.visualizer.block.add")}
      </button>
    {/if}

    {#if linkedFrom.length > 0}
      <div class="ppp-note-props__linked">
        <span class="ppp-note-props__linked-title">{t("views.visualizer.pane.linked-from.title")}</span>
        {#each linkedFrom as link (link.sourcePath + ":" + link.viaKey)}
          <button
            type="button"
            class="ppp-note-props__chip internal-link"
            title={`${link.sourcePath} · ${t("views.visualizer.pane.linked-from.via")} ${link.viaKey}`}
            on:click={() => openPath(link.sourcePath)}
          >{baseName(link.sourcePath)}</button>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  /* Obsidian's own block is hidden only in views the manager marked. */
  :global(.ppp-note-props-replace-native .metadata-container) {
    display: none;
  }
  .ppp-note-props {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin: 0 0 1rem;
    font-size: var(--font-ui-small, 0.875rem);
  }
  .ppp-note-props__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .ppp-note-props__title {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: 0;
    box-shadow: none;
    padding: 0.25rem 0;
    color: var(--text-muted);
    font-weight: var(--font-semibold, 600);
    cursor: pointer;
  }
  .ppp-note-props__icon {
    flex: none;
    min-width: 2rem;
    min-height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    box-shadow: none;
    color: var(--text-faint);
    cursor: pointer;
  }
  .ppp-note-props__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .ppp-note-props__row {
    display: grid;
    grid-template-columns: minmax(7rem, 30%) minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    min-height: 2rem;
    border-radius: var(--radius-s, 0.25rem);
  }
  .ppp-note-props__row.is-hidden {
    opacity: 0.55;
  }
  .ppp-note-props__key {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
    padding: 0.25rem;
    color: var(--text-muted);
    text-align: left;
    cursor: pointer;
  }
  .ppp-note-props__row.is-pinned .ppp-note-props__key {
    color: var(--text-accent);
  }
  .ppp-note-props__key-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-note-props__value {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .ppp-note-props__display {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    min-height: 1.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-s, 0.25rem);
    color: var(--text-normal);
    word-break: break-word;
  }
  .ppp-note-props__display.is-editable {
    cursor: text;
  }
  .ppp-note-props__display.is-editable:focus-visible {
    outline: var(--ppp-border-width) solid var(--interactive-accent);
  }
  .ppp-note-props__display.is-readonly {
    color: var(--text-muted);
  }
  .ppp-note-props__empty {
    color: var(--text-faint);
  }
  .ppp-note-props__chip {
    display: inline-flex;
    align-items: center;
    padding: 0 0.375rem;
    min-height: 1.375rem;
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-modifier-hover);
    border: 0;
    box-shadow: none;
    color: var(--text-normal);
    font: inherit;
  }
  .ppp-note-props__chip.internal-link {
    color: var(--link-color, var(--text-accent));
    cursor: pointer;
  }
  .ppp-note-props__swatch {
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 0.1875rem;
    border: var(--ppp-border-width) solid var(--background-modifier-border);
  }
  .ppp-note-props__link {
    color: var(--text-accent);
    word-break: break-all;
  }
  .ppp-note-props__object {
    font-size: 0.8125rem;
    color: var(--text-faint);
  }
  .ppp-note-props__check {
    margin: 0.25rem 0.375rem;
  }
  .ppp-note-props__error {
    font-size: 0.75rem;
    color: var(--text-error);
  }
  .ppp-note-props__add {
    align-self: flex-start;
    background: transparent;
    border: 0;
    box-shadow: none;
    padding: 0.25rem;
    min-height: 2rem;
    color: var(--text-faint);
    cursor: pointer;
  }
  .ppp-note-props__add-row {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    max-width: 20rem;
  }
  .ppp-note-props__linked {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    padding-top: 0.25rem;
  }
  .ppp-note-props__linked-title {
    color: var(--text-muted);
    margin-right: 0.25rem;
  }
</style>
