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
}): ContextMenuEntry[] {
  const { t, locked, collapsed, pipelineStepCount } = opts;
  const K = "views.dashboard.widget.";
  const e: ContextMenuEntry[] = [
    { title: t(`${K}menu-rename`, "Rename"), icon: "pencil", onClick: opts.onRename },
  ];
  if (opts.hasCog) e.push({ title: t(`${K}menu-source`, "Source and settings…"), icon: "database", onClick: opts.onConfigure });
  if (opts.isDatabase) e.push({ title: t(`${K}menu-filter`, "Filter for all views of this block…"), icon: "filter", onClick: opts.onFilter });
  if (opts.isDatabase) {
    e.push({ separator: true });
    e.push({ title: t(`${K}menu-summarize`, "Group and count…"), icon: "sigma", onClick: () => opts.onPipeline("summarize") });
    e.push({ title: t(`${K}menu-pivot`, "Pivot table…"), icon: "table-2", onClick: () => opts.onPipeline("pivot") });
    e.push({ title: t(`${K}menu-join`, "Combine with another source…"), icon: "git-merge", onClick: () => opts.onPipeline("join") });
  }
  // A stored pipeline must stay reachable, whatever the block type.
  if (opts.hasPipeline && (pipelineStepCount > 0 || !opts.isDatabase)) {
    e.push({
      title: pipelineStepCount > 0
        ? t(`${K}menu-pipeline-active`, "Data steps ({{count}})…").replace("{{count}}", String(pipelineStepCount))
        : t(`${K}menu-pipeline`, "Group, count, combine…"),
      icon: "list-ordered",
      onClick: () => opts.onPipeline(null),
    });
  }
  e.push({ separator: true });
  e.push({ title: collapsed ? t(`${K}expand`, "Expand") : t(`${K}menu-collapse`, "Collapse"), icon: collapsed ? "chevron-down" : "chevron-up", onClick: opts.onToggleCollapse });
  e.push({ title: locked ? t(`${K}unlock`, "Unpin position") : t(`${K}lock`, "Pin position"), icon: locked ? "unlock" : "lock", onClick: opts.onToggleLock });
  e.push({ title: t(`${K}menu-duplicate`, "Duplicate"), icon: "copy", onClick: opts.onDuplicate });
  e.push({ separator: true });
  e.push({ title: t(`${K}menu-remove`, "Delete block"), icon: "trash", danger: true, onClick: opts.onRemove });
  return e;
}
