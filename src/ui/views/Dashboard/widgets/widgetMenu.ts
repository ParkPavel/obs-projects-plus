// widgetMenu.ts — B7: the block's ONE menu «⋯», as data.
//
// Every block action lives here, in plain words; the header keeps no other
// buttons. A database block also offers the data-shaping steps by what they
// GIVE («Group and count», «Pivot table», «Combine with another source») —
// each opens the same PipelineEditor, preset to that step.

import type { ContextMenuEntry } from "src/lib/contextMenu";

export type PipelineIntent = "summarize" | "pivot" | "join";

export interface WidgetMenuHandlers {
  onRename: () => void;
  onConfigure: () => void;
  onFilter: () => void;
  onPipeline: (intent: PipelineIntent | null) => void;
  onToggleCollapse: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function buildWidgetMenuEntries(opts: WidgetMenuHandlers & {
  hasCog: boolean;
  isDatabase: boolean;
  hasPipeline: boolean;
  pipelineStepCount: number;
  locked: boolean;
  collapsed: boolean;
  t: (key: string, defaultValue: string) => string;
  /** i3-dash: the schema dialog of the source this block reads, already labelled with it (layout/blockProperties.ts). */
  properties?: { label: string; open: () => void };
  /** i3-close: tiles only — open the block palette after this block (layout/blockInsert.ts). */
  onInsertAfter?: () => void;
  onInsertBefore?: () => void;
}): ContextMenuEntry[] {
  const { t, locked, collapsed, pipelineStepCount } = opts;
  const K = "views.dashboard.widget.";
  const e: ContextMenuEntry[] = [
    { title: t(`${K}menu-rename`, "Rename"), icon: "pencil", onClick: opts.onRename },
  ];
  if (opts.hasCog) e.push({ title: t(`${K}menu-source`, "Source and settings…"), icon: "database", onClick: opts.onConfigure });
  if (opts.properties) e.push({ title: opts.properties.label, icon: "settings-2", onClick: opts.properties.open });
  if (opts.isDatabase) e.push({ title: t(`${K}menu-filter`, "Filter for all views of this block…"), icon: "filter", onClick: opts.onFilter });
  // i2-model (N27): the data-shaping steps sit behind one «Дополнительно…»
  // (the step editor offers group, pivot and combine). The menu was ten
  // entries; a stored pipeline is named by its step count.
  if (opts.isDatabase || (opts.hasPipeline && pipelineStepCount > 0)) {
    e.push({
      title: pipelineStepCount > 0
        ? t(`${K}menu-pipeline-active`, "Data steps ({{count}})…").replace("{{count}}", String(pipelineStepCount))
        : t(`${K}menu-more`, "More…"),
      icon: "list-ordered",
      onClick: () => opts.onPipeline(null),
    });
  }
  e.push({ separator: true });
  e.push({ title: collapsed ? t(`${K}expand`, "Expand") : t(`${K}menu-collapse`, "Collapse"), icon: collapsed ? "chevron-down" : "chevron-up", onClick: opts.onToggleCollapse });
  // Pinning is undone here; a block is pinned from its grip, not the menu.
  if (locked) e.push({ title: t(`${K}unlock`, "Unpin position"), icon: "unlock", onClick: opts.onToggleLock });
  if (opts.onInsertBefore) e.push({ title: t(`${K}menu-insert-before`, "Insert block before"), icon: "plus", onClick: opts.onInsertBefore });
  if (opts.onInsertAfter) e.push({ title: t(`${K}menu-insert-after`, "Insert block after"), icon: "plus", onClick: opts.onInsertAfter });
  e.push({ title: t(`${K}menu-duplicate`, "Duplicate"), icon: "copy", onClick: opts.onDuplicate });
  e.push({ separator: true });
  e.push({ title: t(`${K}menu-remove`, "Delete block"), icon: "trash", danger: true, onClick: opts.onRemove });
  return e;
}
