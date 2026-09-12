// src/ui/views/Dashboard/dashboardTemplates.ts
//
// R5-013 — Templates controller extracted from DashboardCanvas.svelte.
// Owns the apply-template flow: confirm-on-replace dialog state, pending
// widget batch, quick-action dispatch.

import { writable, type Writable } from "svelte/store";
import { Notice } from "obsidian";

import { applyWidgetTemplate } from "./widgetTemplates";
import type {
  DatabaseViewConfig,
  QuickActionConfig,
  WidgetDefinition,
} from "./types";

export interface TemplatesControllerDeps {
  readonly getConfig: () => DatabaseViewConfig | undefined;
  readonly getWidgets: () => WidgetDefinition[];
  readonly saveConfig: (cfg: DatabaseViewConfig) => void;
  readonly toggleFormulaBar: () => void;
  readonly t: (key: string, opts?: { defaultValue?: string; [k: string]: unknown }) => string;
}

export interface TemplatesController {
  applyTemplateById(templateId: string): void;
  requestReplace(nextWidgets: WidgetDefinition[]): Promise<void>;
  confirmReplace(): void;
  cancelReplace(): void;
  handleQuickAction(action: QuickActionConfig): void;
  /** Reactive flag the canvas binds to the confirm-dialog `show` prop. */
  readonly showConfirm: Writable<boolean>;
}

export function createTemplatesController(
  deps: TemplatesControllerDeps
): TemplatesController {
  const showConfirm = writable(false);
  let pending: WidgetDefinition[] | null = null;

  async function requestReplace(nextWidgets: WidgetDefinition[]) {
    const cfg = deps.getConfig();
    if (!cfg) return;
    if (deps.getWidgets().length > 0) {
      pending = nextWidgets;
      showConfirm.set(true);
      return;
    }
    deps.saveConfig({ ...cfg, widgets: nextWidgets });
  }

  function confirmReplace() {
    const cfg = deps.getConfig();
    if (!cfg || !pending) return;
    deps.saveConfig({ ...cfg, widgets: pending });
    showConfirm.set(false);
    pending = null;
  }

  function cancelReplace() {
    showConfirm.set(false);
    pending = null;
  }

  function applyTemplateById(templateId: string) {
    if (!deps.getConfig()) return;
    const widgets = applyWidgetTemplate(templateId);
    if (!widgets) return;
    requestReplace(widgets).catch((err) => {
      new Notice(
        deps.t("views.dashboard.canvas.error-apply-template", {
          defaultValue: "Failed to apply template.",
        })
      );
      // eslint-disable-next-line no-console
      console.warn("[obs-projects-plus] applyTemplateById failed", err);
    });
  }

  function handleQuickAction(action: QuickActionConfig) {
    if (action.kind === "toggle-formula-bar") {
      deps.toggleFormulaBar();
      return;
    }
    if (action.kind === "apply-template" && action.templateId) {
      applyTemplateById(action.templateId);
    }
  }

  return {
    applyTemplateById,
    requestReplace,
    confirmReplace,
    cancelReplace,
    handleQuickAction,
    showConfirm,
  };
}
