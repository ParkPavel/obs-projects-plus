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
   *
   * i3-props: rename and delete in the row menu; nested values are read-only;
   * every write is queued (writeQueue) instead of being dropped while another
   * runs; lists edit as chips, select/status pick from the values the project
   * uses, colours open the shared palette. Only the note's own frontmatter is
   * written — never Obsidian's `.obsidian/types.json`.
   *
   * i3-final: rows reorder by their grip (pointer, so touch too) or Alt+↑/↓,
   * and the order is written into the YAML itself (reorderKeysIn); Tab and
   * Shift+Tab commit the open editor and open the next / previous value; the
   * values other notes hold are memoized (usedValuesCache).
   */
  import { onDestroy, onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { TFile, type App, type EventRef } from "obsidian";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { settings } from "src/lib/stores/settings";
  import { DEFAULT_COLOR } from "src/lib/stores/palettes";
  import {
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
  import { deleteProperty, renameProperty, reorderProperties } from "src/lib/visualizer/propertyKeysWriter";
  import { reorderKeysIn } from "src/lib/visualizer/propertyKeys";
  import { buildLinkHref } from "src/lib/visualizer/linkRender";
  import { openContextMenu, type ContextMenuEntry } from "src/lib/contextMenu";
  import type { CellEditType, CellValue } from "src/lib/database/cellEditor";
  import { writeCellValue } from "src/lib/database/cellEditorWriter";
  import { isWikilink, stripToDisplay, stripToPath } from "src/lib/engine/wikilink";
  import { lookupInverse, type InverseIndex } from "src/lib/relations/inverseIndex";
  import type { InverseIndexStore } from "src/lib/relations/inverseIndexStore";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import DateField from "src/ui/components/fields/DateField.svelte";
  import ComboField from "src/ui/components/fields/ComboField.svelte";
  import { namesToOptions, type ComboOption } from "src/ui/components/fields/comboOptions";
  import { ColorPicker } from "src/ui/components/ColorPicker";
  import { RelationPickerModal, pathFromFile } from "src/ui/views/VisualizerPane/RelationPickerModal";
  import ChipsEditor from "./ChipsEditor.svelte";
  import { createWriteQueue } from "./writeQueue";
  import { createUsedValuesCache } from "./usedValuesCache";
  import { templateFoldersOf } from "src/lib/suggestions/valueSuggestions";
  import {
    dateToCellText,
    draftOf,
    isNestedValue,
    isReservedPropertyKey,
    listItems,
    noteScopeFor,
    parseStoredDate,
    planListWrite,
    planValueWrite,
    reorderedKeys,
    validateNewPropertyName,
    validateRename,
    visibleProperties,
    withPickedRelation,
    type ListType,
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
  let editingKey: string | null = null;
  let editError: string | null = null;
  let renamingKey: string | null = null;
  let renameError: string | null = null;
  let paletteKey: string | null = null;
  let choiceOptions: ComboOption[] = [];
  let adding = false;
  let addError: string | null = null;
  let inverseIndex: InverseIndex = new Map();
  let editField: TextField | null = null;
  let comboField: ComboField | null = null;
  let addField: TextField | null = null;
  let renameField: TextField | null = null;
  let listEl: HTMLUListElement | null = null;

  // i3-final: the colours other notes use, read once when the palette opens.
  let paletteColors: string[] = [];
  // i3-final: a grip drag in progress — the row, its pointer, the slot it would land in.
  let dragKey: string | null = null;
  let dragPointer: number | null = null;
  let dropIndex: number | null = null;

  // i3-props: one queue for every write of this block, in the order asked.
  const queue = createWriteQueue();
  // i3-final: other notes' values, kept until the metadata cache reports a change.
  const usedCache = createUsedValuesCache({
    files: () => app.vault.getMarkdownFiles?.() ?? [],
    frontmatterOf: (f) =>
      app.metadataCache.getFileCache(f as TFile)?.frontmatter as Record<string, unknown> | undefined,
    templateFolders: () => templateFoldersOf(app),
  });

  $: t = $i18n.t.bind($i18n);

  function refresh(target: TFile): void {
    const cache = app.metadataCache.getFileCache(target);
    frontmatter = (cache?.frontmatter as Record<string, unknown> | undefined) ?? null;
    overlay = readOverlay(frontmatter);
  }
  $: refresh(file);

  let metaRef: EventRef | null = null;
  let resolvedRef: EventRef | null = null;
  let unsubInverse: (() => void) | null = null;
  onMount(() => {
    metaRef = app.metadataCache.on("changed", (changed: TFile) => {
      usedCache.invalidateSoon();
      if (changed.path === file.path) refresh(file);
    });
    resolvedRef = app.metadataCache.on("resolved", () => usedCache.invalidateSoon());
    if (inverseIndexStore) {
      unsubInverse = inverseIndexStore.subscribe((idx) => {
        inverseIndex = idx;
      });
    }
  });
  onDestroy(() => {
    if (metaRef) app.metadataCache.offref(metaRef);
    if (resolvedRef) app.metadataCache.offref(resolvedRef);
    usedCache.dispose();
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
    // i3-props: a nested value stays read-only whatever type it is given.
    return !READONLY_TYPES.has(type) && !isReservedPropertyKey(entry.key) && !isNestedValue(entry.value);
  }
  function isListType(type: PropertyType): type is ListType {
    return type === "list" || type === "tags" || type === "relation";
  }

  // ── Writes (queued; the target file is the one the action was taken on) ──
  function persistOverlay(next: NoteOverlay): Promise<void> {
    overlay = next;
    const target = file;
    return queue.run(() => writeOverlay(app, target, next));
  }

  function writeKey(key: string, value: CellValue): Promise<void> {
    const target = file;
    return queue.run(() => writeCellValue(app, target, key, value));
  }

  function writeType(key: string, type: PropertyType | null): Promise<void> {
    const target = file;
    return queue.run(() => setPropertyType(app, target, key, type));
  }

  /**
   * i3-props: the values `key` holds across this project's notes (the note's
   * folder when no project holds it), the note's own value first.
   */
  function usedValues(key: string): string[] {
    const scope = noteScopeFor(file.path, get(settings).projects ?? []);
    return usedCache.get(file.path, frontmatter, key, scope);
  }

  // ── Keyboard: rows ───────────────────────────────────────
  async function focusRow(key: string, grip = false): Promise<void> {
    await tick();
    const row = Array.from(listEl?.children ?? []).find((li) => (li as HTMLElement).dataset["rowKey"] === key);
    row?.querySelector<HTMLElement>(grip ? "[data-row-grip]" : "[data-row-nav]")?.focus();
  }

  /**
   * i3-final: Tab / Shift+Tab inside an open editor (Notion-like). Read in the
   * capture phase so the intent is known before the field acts: a ComboField
   * commits on Tab itself, a TextField or the chips do not — those are
   * committed by taking focus away, the same path a click elsewhere takes.
   * Then the next editable value opens (a checkbox or a date gets focus).
   * Escape still cancels through each field's own handler.
   */
  function onListKeydownCapture(e: KeyboardEvent): void {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    const key = editingKey;
    if (key === null || rowKeyOf(e.target) !== key) return;
    e.preventDefault();
    void tabFrom(key, e.shiftKey ? -1 : 1, e.target as HTMLElement);
  }

  function neighbour(key: string, dir: -1 | 1): OverlayedEntry | null {
    const at = entries.findIndex((en) => en.key === key);
    for (let i = at + dir; at >= 0 && i >= 0 && i < entries.length; i += dir) {
      const candidate = entries[i];
      if (candidate && editable(candidate, typeOf(candidate))) return candidate;
    }
    return null;
  }

  async function tabFrom(key: string, dir: -1 | 1, from: HTMLElement): Promise<void> {
    // Let the field's own Tab handling run first (ComboField commits on it).
    await Promise.resolve();
    if (editingKey === key) {
      const entry = entries.find((en) => en.key === key);
      const type = entry ? typeOf(entry) : null;
      // A draft the type refuses stays open with its error, as Enter would.
      if (entry && type && editable(entry, type) && !isListType(type) && from instanceof HTMLInputElement) {
        const plan = planValueWrite(entry.value, from.value, type);
        if (plan.kind === "invalid") {
          editError = t(plan.i18nKey);
          return;
        }
      }
      if (from.isConnected) from.blur();
      await tick();
      if (editingKey === key) endEdit();
    }
    const next = neighbour(key, dir);
    if (!next) {
      void focusRow(key);
      return;
    }
    const type = typeOf(next);
    if (type === "boolean" || type === "date" || type === "datetime") void focusRow(next.key);
    else await startEdit(next, type);
  }

  // ── Reorder (grip drag, Alt+↑/↓) ─────────────────────────
  function shownIndex(key: string): number {
    return entries.filter((en) => !en.hidden).findIndex((en) => en.key === key);
  }

  /**
   * i3-final: write the new order into the YAML (one processFrontMatter), and
   * show it at once — the block rebuilds its copy the same way the writer does.
   */
  async function moveTo(key: string, to: number): Promise<void> {
    const keys = reorderedKeys(entries, key, to);
    if (!keys) return;
    if (frontmatter) {
      const next = { ...frontmatter };
      if (reorderKeysIn(next, keys)) {
        frontmatter = next;
        overlay = readOverlay(next);
      }
    }
    const target = file;
    await queue.run(() => reorderProperties(app, target, keys));
  }

  function moveBy(key: string, step: -1 | 1): Promise<void> {
    const at = shownIndex(key);
    return at < 0 ? Promise.resolve() : moveTo(key, at + step);
  }

  /** The slot a drag at `y` lands in: how many other shown rows sit above it. */
  function slotAt(key: string, y: number): number {
    const rows = Array.from(listEl?.querySelectorAll<HTMLElement>("li[data-row-key]:not(.is-hidden)") ?? []);
    return rows.filter((li) => {
      if (li.dataset["rowKey"] === key) return false;
      const box = li.getBoundingClientRect();
      return box.top + box.height / 2 < y;
    }).length;
  }

  function onGripDown(e: PointerEvent, key: string): void {
    if (e.button !== 0 || dragKey !== null) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (editingKey !== null) endEdit();
    dragKey = key;
    dragPointer = e.pointerId;
    dropIndex = shownIndex(key);
  }

  function onGripMove(e: PointerEvent): void {
    if (dragKey === null || e.pointerId !== dragPointer) return;
    e.preventDefault();
    dropIndex = slotAt(dragKey, e.clientY);
  }

  function onGripUp(e: PointerEvent): void {
    if (dragKey === null || e.pointerId !== dragPointer) return;
    const key = dragKey;
    const to = slotAt(key, e.clientY);
    endDrag();
    void moveTo(key, to);
  }

  function endDrag(): void {
    dragKey = null;
    dragPointer = null;
    dropIndex = null;
  }

  /** Where the drop line shows: before the row the dragged one would precede. */
  function dropMarkerFor(key: string | null, to: number | null): { key: string; after: boolean } | null {
    if (key === null || to === null) return null;
    const keys = reorderedKeys(entries, key, to);
    if (!keys) return null;
    const at = keys.indexOf(key);
    const below = keys[at + 1];
    if (below !== undefined) return { key: below, after: false };
    const above = keys[at - 1];
    return above !== undefined ? { key: above, after: true } : null;
  }
  $: dropMarker = dropMarkerFor(dragKey, dropIndex);

  function rowKeyOf(el: EventTarget | null): string | null {
    const li = (el as HTMLElement | null)?.closest?.<HTMLElement>("li[data-row-key]");
    return li?.dataset["rowKey"] ?? null;
  }

  function onListKeydown(e: KeyboardEvent): void {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const from = e.target as HTMLElement | null;
    // i3-final: Alt+↑/↓ moves the row itself — the keyboard twin of the grip.
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const key = rowKeyOf(from);
      if (key === null || key === editingKey || key === renamingKey) return;
      e.preventDefault();
      const onGrip = from?.hasAttribute("data-row-grip") ?? false;
      void moveBy(key, e.key === "ArrowDown" ? 1 : -1).then(() => focusRow(key, onGrip));
      return;
    }
    if (!from?.hasAttribute("data-row-nav") || !listEl) return;
    const rows = Array.from(listEl.querySelectorAll<HTMLElement>("[data-row-nav]"));
    const next = rows[rows.indexOf(from) + (e.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
  }

  // ── Value editing ────────────────────────────────────────
  async function startEdit(entry: OverlayedEntry, type: PropertyType): Promise<void> {
    if (!editable(entry, type) || type === "boolean" || type === "date" || type === "datetime") return;
    if (type === "select" || type === "status") {
      choiceOptions = namesToOptions(usedValues(entry.key));
    }
    editingKey = entry.key;
    editError = null;
    await tick();
    editField?.focus();
    comboField?.focus();
  }

  function endEdit(refocus = false): void {
    const key = editingKey;
    editingKey = null;
    editError = null;
    if (refocus && key !== null) void focusRow(key);
  }

  async function commitText(
    entry: OverlayedEntry,
    type: CellEditType,
    draft: string,
    reason: string,
  ): Promise<void> {
    const plan = planValueWrite(entry.value, draft, type);
    if (plan.kind === "invalid") {
      editError = t(plan.i18nKey);
      return;
    }
    endEdit(reason === "enter" || reason === "select");
    if (plan.kind === "write") await writeKey(entry.key, plan.value);
  }

  function validDraft(type: CellEditType): (draft: string) => boolean {
    return (draft) => planValueWrite(null, draft, type).kind !== "invalid";
  }

  async function commitList(entry: OverlayedEntry, type: ListType, next: string[]): Promise<void> {
    const plan = planListWrite(entry.value, next, type);
    if (plan.kind === "write") await writeKey(entry.key, plan.value);
  }

  /**
   * i3-close: a relation chip chosen from the vault — the same note picker
   * the block menu's «Add relation» opens. Opening it takes focus, which ends
   * the chip edit; the chosen note is written to this property and the edit
   * resumes on it, so several notes can be added in a row.
   */
  function pickRelationItem(entry: OverlayedEntry, current: string[]): void {
    const key = entry.key;
    new RelationPickerModal(
      app,
      (chosen) => {
        void commitList(entry, "relation", withPickedRelation(current, pathFromFile(chosen))).then(() => {
          editingKey = key;
        });
      },
      {
        excludePath: file.path,
        placeholder: t("views.visualizer.pane.actions.pick-relation-placeholder"),
      },
    ).open();
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

  async function commitColor(entry: OverlayedEntry, hex: string): Promise<void> {
    const plan = planValueWrite(entry.value, hex, "color");
    if (plan.kind === "write") await writeKey(entry.key, plan.value);
  }

  function togglePalette(key: string): void {
    paletteKey = paletteKey === key ? null : key;
    // i3-final: read once on open, not on every render of the open palette.
    paletteColors = paletteKey === null ? [] : projectColors(paletteKey);
  }

  function projectColors(key: string): string[] {
    return usedValues(key).filter((v) => isColorValue(v));
  }

  // ── Rename / delete ──────────────────────────────────────
  async function startRename(key: string): Promise<void> {
    if (editingKey === key) endEdit();
    renamingKey = key;
    renameError = null;
    await tick();
    renameField?.select();
  }

  function endRename(refocus = false): void {
    const key = renamingKey;
    renamingKey = null;
    renameError = null;
    if (refocus && key !== null) void focusRow(key);
  }

  async function commitRename(from: string, raw: string, reason: string): Promise<void> {
    const verdict = validateRename(from, raw, frontmatter);
    if (!verdict.ok) {
      if (verdict.reason === "empty") endRename(reason === "enter");
      else renameError = t(`views.visualizer.block.errors.${verdict.reason}`);
      return;
    }
    endRename();
    const target = file;
    const to = verdict.key;
    await queue.run(() => renameProperty(app, target, from, to));
    if (reason === "enter") void focusRow(to);
  }

  async function removeKey(key: string): Promise<void> {
    if (editingKey === key) endEdit();
    if (renamingKey === key) endRename();
    if (paletteKey === key) paletteKey = null;
    const target = file;
    await queue.run(() => deleteProperty(app, target, key));
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
        // i3-final: the menu moves write the YAML order too, as the grip does.
        onClick: () => void moveBy(entry.key, -1),
      },
      {
        title: t("views.visualizer.pane.actions.move-down"),
        icon: "arrow-down",
        disabled: entry.hidden || index >= visibleKeys.length - 1,
        onClick: () => void moveBy(entry.key, 1),
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
            onClick: () => void writeType(entry.key, null),
          },
          { separator: true },
          ...PROPERTY_TYPES.map((type) => ({
            title: t(`data-types.${type}`),
            checked: typeOverrides[entry.key] === type,
            onClick: () => void writeType(entry.key, type),
          })),
        ],
      },
      { separator: true },
      {
        title: t("views.visualizer.block.actions.rename", { defaultValue: "Rename property" }),
        icon: "pencil",
        onClick: () => void startRename(entry.key),
      },
      {
        title: t("views.visualizer.block.actions.delete", { defaultValue: "Delete property" }),
        icon: "trash-2",
        danger: true,
        onClick: () => void removeKey(entry.key),
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
        void queue.run(() => appendRelationToFile(app, target, { path: pathFromFile(chosen) }));
      },
      {
        excludePath: target.path,
        placeholder: t("views.visualizer.pane.actions.pick-relation-placeholder"),
      },
    ).open();
  }

  // ── Display helpers ──────────────────────────────────────
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

  function readOnlyTitle(entry: OverlayedEntry): string {
    return isNestedValue(entry.value)
      ? t("views.visualizer.block.nested", { defaultValue: "Nested value: edit it in the note's YAML" })
      : t("views.visualizer.block.read-only");
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
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <ul
      class="ppp-note-props__list"
      bind:this={listEl}
      on:keydown|capture={onListKeydownCapture}
      on:keydown={onListKeydown}
    >
      {#each entries as entry, index (entry.key)}
        {@const type = typeOf(entry)}
        {@const canEdit = editable(entry, type)}
        <li
          class="ppp-note-props__row"
          class:is-hidden={entry.hidden}
          class:is-pinned={entry.pinned}
          class:is-dragging={dragKey === entry.key}
          class:is-drop-before={dropMarker?.key === entry.key && !dropMarker.after}
          class:is-drop-after={dropMarker?.key === entry.key && dropMarker.after}
          data-row-key={entry.key}
        >
          {#if entry.hidden}
            <span class="ppp-note-props__grip is-placeholder" aria-hidden="true"></span>
          {:else}
            <!-- i3-final: pointer events, so a finger drags as a mouse does; Alt+↑/↓ from the keyboard. -->
            <button
              type="button"
              class="ppp-note-props__grip clickable-icon"
              data-row-grip
              aria-label={`${entry.key}: ${t("views.visualizer.block.reorder", { defaultValue: "Drag to reorder (Alt+↑ / Alt+↓)" })}`}
              title={t("views.visualizer.block.reorder", { defaultValue: "Drag to reorder (Alt+↑ / Alt+↓)" })}
              on:pointerdown={(e) => onGripDown(e, entry.key)}
              on:pointermove={onGripMove}
              on:pointerup={onGripUp}
              on:pointercancel={endDrag}
              on:lostpointercapture={(e) => e.pointerId === dragPointer && endDrag()}
            ><Icon name="grip-vertical" size="sm" /></button>
          {/if}
          {#if renamingKey === entry.key}
            <div class="ppp-note-props__rename">
              <TextField
                bind:this={renameField}
                value={entry.key}
                ariaLabel={t("views.visualizer.block.actions.rename", { defaultValue: "Rename property" })}
                error={renameError !== null}
                commitUnchanged
                on:commit={(e) => commitRename(entry.key, e.detail.value, e.detail.reason)}
                on:cancel={() => endRename(true)}
              />
              {#if renameError}
                <span class="ppp-note-props__error" role="alert">{renameError}</span>
              {/if}
            </div>
          {:else}
            <button
              type="button"
              class="ppp-note-props__key"
              title={`${entry.key} · ${t(`data-types.${type}`)}`}
              on:click={(e) => rowMenu(e, entry, index)}
            >
              <Icon name={entry.pinned ? "pin" : iconFor(type)} size="sm" />
              <span class="ppp-note-props__key-text">{entry.key}</span>
            </button>
          {/if}

          <div class="ppp-note-props__value">
            {#if canEdit && type === "boolean"}
              <input
                type="checkbox"
                class="ppp-note-props__check"
                data-row-nav
                checked={entry.value === true}
                aria-label={entry.key}
                on:change={(e) => commitBoolean(entry, e.currentTarget.checked)}
              />
            {:else if canEdit && (type === "date" || type === "datetime")}
              <!-- i3-props: arrows land on the row; Enter hands focus to the picker. -->
              <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
              <div
                class="ppp-note-props__date"
                data-row-nav
                role="group"
                tabindex="-1"
                aria-label={entry.key}
                on:keydown={(e) => {
                  if (e.key !== "Enter" || e.target !== e.currentTarget) return;
                  e.preventDefault();
                  e.currentTarget.querySelector<HTMLElement>("input, button")?.focus();
                }}
              >
                <DateField
                  value={parseStoredDate(entry.value)}
                  withTime={type === "datetime"}
                  ariaLabel={entry.key}
                  on:change={(e) => commitDate(entry, type, e.detail)}
                />
              </div>
            {:else if canEdit && editingKey === entry.key && isListType(type)}
              <ChipsEditor
                items={listItems(entry.value)}
                {type}
                ariaLabel={entry.key}
                pickable={type === "relation"}
                on:change={(e) => commitList(entry, type, e.detail)}
                on:done={(e) => endEdit(e.detail)}
                on:pick={(e) => pickRelationItem(entry, e.detail)}
              />
            {:else if canEdit && editingKey === entry.key && (type === "select" || type === "status")}
              <ComboField
                bind:this={comboField}
                value={draftOf(entry.value, type)}
                options={choiceOptions}
                allowCustom
                commitUnchanged
                ariaLabel={entry.key}
                on:commit={(e) => commitText(entry, type, e.detail.value, e.detail.reason)}
                on:cancel={() => endEdit(true)}
              />
            {:else if canEdit && editingKey === entry.key}
              <TextField
                bind:this={editField}
                value={draftOf(entry.value, type)}
                ariaLabel={entry.key}
                validate={validDraft(type)}
                commitUnchanged
                inputMode={type === "number" ? "decimal" : type === "email" ? "email" : type === "url" ? "url" : type === "phone" ? "tel" : "text"}
                on:commit={(e) => commitText(entry, type, e.detail.value, e.detail.reason)}
                on:cancel={() => endEdit(true)}
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
                data-row-nav
                role={canEdit ? "button" : "group"}
                tabindex={canEdit ? 0 : -1}
                aria-label={canEdit ? undefined : entry.key}
                title={canEdit ? undefined : readOnlyTitle(entry)}
                on:click={() => canEdit && startEdit(entry, type)}
                on:keydown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (canEdit && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    void startEdit(entry, type);
                  } else if (e.key === "Escape" && paletteKey === entry.key) {
                    e.preventDefault();
                    paletteKey = null;
                  }
                }}
              >
                {#if isNestedValue(entry.value)}
                  <code class="ppp-note-props__object">{JSON.stringify(entry.value)}</code>
                {:else if listItems(entry.value).length === 0}
                  <span class="ppp-note-props__empty">{t("views.visualizer.block.empty")}</span>
                {:else if Array.isArray(entry.value) || type === "relation" || type === "tags"}
                  {#each listItems(entry.value) as item}
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
                  {#if canEdit}
                    <button
                      type="button"
                      class="ppp-note-props__swatch is-button"
                      style:background={normalizeColor(entry.value) ?? ""}
                      aria-expanded={paletteKey === entry.key}
                      aria-label={t("views.visualizer.block.color.palette", { defaultValue: "Color palette" })}
                      title={t("views.visualizer.block.color.palette", { defaultValue: "Color palette" })}
                      on:click|stopPropagation={() => togglePalette(entry.key)}
                    ></button>
                  {:else}
                    <span class="ppp-note-props__swatch" style:background={normalizeColor(entry.value) ?? ""} aria-hidden="true"></span>
                  {/if}
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
                {:else}
                  {String(entry.value)}
                {/if}
              </div>
            {/if}
            {#if canEdit && paletteKey === entry.key && isColorValue(entry.value)}
              <!-- i3-props: the shared picker — its favourites are the calendar's. -->
              <div class="ppp-note-props__palette">
                <ColorPicker
                  value={normalizeColor(entry.value) ?? DEFAULT_COLOR}
                  projectPalette={paletteColors}
                  projectPaletteLabel={t("views.visualizer.block.color.project", { defaultValue: "Colors in this project" })}
                  on:change={(e) => commitColor(entry, e.detail)}
                />
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
      <button type="button" class="ppp-note-props__add" on:click={startAdd}>
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
  /* Obsidian's own block is hidden only in views the manager marked.
     i2-record (D01): Live Preview shows it again with a more specific rule of
     its own (measured on the stand: display block under our class), so the
     hide is !important — it is the one switch between the two blocks. */
  :global(.ppp-note-props-replace-native .metadata-container) {
    display: none !important;
  }
  /* i2-record (D02): in Source mode the YAML itself is on screen; a second,
     editable copy of it above is a duplicate. */
  :global(.markdown-source-view:not(.is-live-preview) .ppp-note-props-host) {
    display: none;
  }
  /* i3-props: sizes are in em of the block's own text, and the layout follows
     the width of the note (the container), not of the window — a note in a
     narrow split on a desktop stacks the same way a phone does. */
  .ppp-note-props {
    container: ppp-note-props / inline-size;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
    margin: 0 0 1.15em;
    font-size: var(--font-ui-small, 0.875em);
  }
  .ppp-note-props__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6em;
  }
  .ppp-note-props__title {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    background: transparent;
    border: 0;
    box-shadow: none;
    padding: 0.3em 0;
    color: var(--text-muted);
    font-weight: var(--font-semibold, 600);
    cursor: pointer;
  }
  .ppp-note-props__icon {
    flex: none;
    min-width: 2.3em;
    min-height: 2.3em;
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
    grid-template-columns: auto minmax(8em, 30%) minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6em;
    min-height: 2.3em;
    border-radius: var(--radius-s, 0.3em);
  }
  .ppp-note-props__row.is-hidden {
    opacity: 0.55;
  }
  /* i3-final: the grip. touch-action none — a finger on it drags the row
     instead of scrolling the note. */
  .ppp-note-props__grip {
    flex: none;
    width: 1.6em;
    min-height: 2.3em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
    color: var(--text-faint);
    cursor: grab;
    touch-action: none;
    opacity: 0.5;
  }
  .ppp-note-props__grip:focus-visible,
  .ppp-note-props__row.is-dragging .ppp-note-props__grip {
    opacity: 1;
  }
  @media (hover: hover) and (pointer: fine) {
    .ppp-note-props__row:hover .ppp-note-props__grip {
      opacity: 1;
    }
  }
  /* A finger has no hover: the grip stays fully visible. */
  @media (pointer: coarse) {
    .ppp-note-props__grip {
      opacity: 1;
    }
  }
  .ppp-note-props__grip.is-placeholder {
    cursor: default;
  }
  .ppp-note-props__row.is-dragging {
    background: var(--background-modifier-hover);
  }
  .ppp-note-props__row.is-dragging .ppp-note-props__grip {
    cursor: grabbing;
  }
  .ppp-note-props__row.is-drop-before {
    box-shadow: inset 0 0.15em 0 var(--interactive-accent);
  }
  .ppp-note-props__row.is-drop-after {
    box-shadow: inset 0 -0.15em 0 var(--interactive-accent);
  }
  .ppp-note-props__key {
    /* i2-record (N10): Obsidian centres button content, so each key sat at a
       different x by the length of its name. Keys line up at the start. */
    display: inline-flex;
    justify-content: flex-start;
    align-items: center;
    gap: 0.45em;
    min-width: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
    padding: 0.3em;
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
  .ppp-note-props__rename {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
  }
  .ppp-note-props__value {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
  }
  /* i2-record (D05): a long value (a cover link) ran under «⋯» and off the
     screen; every value item ends in an ellipsis inside its column. */
  .ppp-note-props__display > :global(*) {
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-note-props__display {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3em;
    min-height: 2em;
    padding: 0.15em 0.45em;
    border-radius: var(--radius-s, 0.3em);
    color: var(--text-normal);
    word-break: break-word;
  }
  .ppp-note-props__display.is-editable {
    cursor: text;
  }
  .ppp-note-props__display:focus-visible,
  .ppp-note-props__date:focus-visible {
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
    padding: 0 0.45em;
    min-height: 1.6em;
    border-radius: var(--radius-s, 0.3em);
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
    flex: none;
    width: 1em;
    height: 1em;
    padding: 0;
    border-radius: 0.2em;
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    box-shadow: none;
  }
  .ppp-note-props__swatch.is-button {
    width: 1.4em;
    height: 1.4em;
    cursor: pointer;
  }
  .ppp-note-props__palette {
    max-width: 24em;
  }
  .ppp-note-props__link {
    color: var(--text-accent);
    word-break: break-all;
  }
  .ppp-note-props__object {
    font-size: 0.93em;
    color: var(--text-faint);
  }
  .ppp-note-props__check {
    margin: 0.3em 0.45em;
  }
  .ppp-note-props__error {
    font-size: 0.85em;
    color: var(--text-error);
  }
  .ppp-note-props__add {
    align-self: flex-start;
    background: transparent;
    border: 0;
    box-shadow: none;
    padding: 0.3em;
    min-height: 2.3em;
    color: var(--text-faint);
    cursor: pointer;
  }
  .ppp-note-props__add-row {
    display: flex;
    flex-direction: column;
    gap: 0.15em;
    max-width: 23em;
  }
  .ppp-note-props__linked {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3em;
    padding-top: 0.3em;
  }
  .ppp-note-props__linked-title {
    color: var(--text-muted);
    margin-right: 0.3em;
  }
  /* i3-props: a narrow note (a phone, a side split) puts the key above its
     value, and the value wraps instead of ending in an ellipsis — on a phone
     the ellipsis hid most of every value. */
  @container ppp-note-props (max-width: 32em) {
    .ppp-note-props__row {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: "grip key more" "value value value";
      row-gap: 0;
      padding-bottom: 0.3em;
    }
    .ppp-note-props__grip {
      grid-area: grip;
    }
    .ppp-note-props__key,
    .ppp-note-props__rename {
      grid-area: key;
    }
    .ppp-note-props__value {
      grid-area: value;
    }
    .ppp-note-props__icon {
      grid-area: more;
    }
    .ppp-note-props__display > :global(*) {
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }
</style>
