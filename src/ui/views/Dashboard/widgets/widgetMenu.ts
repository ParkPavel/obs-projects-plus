// widgetMenu.ts — R3 P0 (NOTION_GRADE_PIPELINE W2): the always-visible
// widget «⋯» menu as data. Pure builder — testable without mounting Svelte;
// WidgetHeaderActions only dispatches the chosen action.

import type { ContextMenuEntry } from "src/lib/contextMenu";

export function buildWidgetMenuEntries(opts: {
  hasCog: boolean;
  hasPipeline: boolean;
  pipelineStepCount: number;
  locked: boolean;
  t: (key: string, defaultValue: string) => string;
  onConfigure: () => void;
  onPipeline: () => void;
  onRename: () => void;
  onToggleLock: () => void;
  onRemove: () => void;
}): ContextMenuEntry[] {
  const { hasCog, hasPipeline, pipelineStepCount, locked, t, onConfigure, onPipeline, onRename, onToggleLock, onRemove } = opts;
  const entries: ContextMenuEntry[] = [];
  if (hasCog) {
    entries.push({ title: t("views.dashboard.widget.menu-configure", "Configure widget…"), icon: "settings-2", onClick: onConfigure });
  }
  if (hasPipeline) {
    entries.push({
      title: pipelineStepCount > 0
        ? t("views.dashboard.widget.menu-pipeline-active", "Data pipeline ({{count}})").replace("{{count}}", String(pipelineStepCount))
        : t("views.dashboard.widget.menu-pipeline", "Data pipeline — filter, group, compute…"),
      icon: "sigma",
      onClick: onPipeline,
    });
  }
  entries.push({ title: t("views.dashboard.widget.menu-rename", "Rename"), icon: "pencil", onClick: onRename });
  entries.push({
    title: locked
      ? t("views.dashboard.widget.unlock", "Unlock widget")
      : t("views.dashboard.widget.lock", "Lock widget position"),
    icon: locked ? "unlock" : "lock",
    onClick: onToggleLock,
  });
  entries.push({ separator: true });
  entries.push({ title: t("views.dashboard.widget.menu-remove", "Remove widget"), icon: "trash", danger: true, onClick: onRemove });
  return entries;
}
