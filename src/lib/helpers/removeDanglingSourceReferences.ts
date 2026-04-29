// src/lib/helpers/removeDanglingSourceReferences.ts
// Pillar 5 cleanup helper: when a sibling project is deleted, walk every
// remaining project's views and strip any `rightSourceId` references that
// point at the removed id. This prevents silent data-rot where an orphaned
// Join step or scatter correlation keeps its stale target id forever.
//
// The helper is intentionally tolerant of unknown widget shapes: it uses
// structural checks (`Array.isArray`, typeof-guards) and touches only the
// fields it owns. Unknown widgets pass through unchanged.

import type { ProjectDefinition } from "src/settings/settings";

interface JoinLikeStep {
  readonly type: "join";
  readonly rightSourceId?: string;
  readonly [key: string]: unknown;
}

interface WidgetLike {
  readonly id?: string;
  readonly type?: string;
  readonly transform?: { readonly steps?: readonly unknown[] } | undefined;
  readonly config?: Record<string, unknown> | undefined;
  readonly [key: string]: unknown;
}

function isJoinStep(step: unknown): step is JoinLikeStep {
  return (
    typeof step === "object" &&
    step !== null &&
    (step as { type?: unknown }).type === "join"
  );
}

function sanitizeWidget(widget: WidgetLike, removedId: string): WidgetLike {
  let nextWidget = widget;

  // 1) Join steps in transform pipeline.
  const steps = widget.transform?.steps;
  if (Array.isArray(steps)) {
    const filtered = steps.filter((s) => !(isJoinStep(s) && s.rightSourceId === removedId));
    if (filtered.length !== steps.length) {
      nextWidget = {
        ...nextWidget,
        transform: {
          ...(nextWidget.transform ?? {}),
          steps: filtered,
        },
      } as WidgetLike;
    }
  }

  // 2) Chart-widget correlation pointing at the removed project.
  if (widget.type === "chart" && widget.config && typeof widget.config === "object") {
    const correlation = (widget.config as { correlation?: { rightSourceId?: string } }).correlation;
    if (correlation && correlation.rightSourceId === removedId) {
      const { correlation: _stripped, ...restConfig } = widget.config as Record<string, unknown>;
      nextWidget = {
        ...nextWidget,
        config: restConfig,
      } as WidgetLike;
    }
  }

  return nextWidget;
}

/**
 * Return a copy of `projects` where every dangling reference to `removedId`
 * has been stripped. Inputs are treated as immutable.
 *
 * @param projects - all remaining projects AFTER the target has been removed
 * @param removedId - the id of the project that was just deleted
 */
export function removeDanglingSourceReferences(
  projects: readonly ProjectDefinition[],
  removedId: string
): ProjectDefinition[] {
  if (!removedId) return projects.slice() as ProjectDefinition[];

  return projects.map((project) => {
    const views = project.views ?? [];
    let viewsChanged = false;

    const nextViews = views.map((view) => {
      const cfg = (view as unknown as { config?: { widgets?: unknown[] } }).config;
      const widgets = cfg?.widgets;
      if (!Array.isArray(widgets)) return view;

      let widgetsChanged = false;
      const nextWidgets = widgets.map((w) => {
        const sanitized = sanitizeWidget(w as WidgetLike, removedId);
        if (sanitized !== w) widgetsChanged = true;
        return sanitized;
      });

      if (!widgetsChanged) return view;
      viewsChanged = true;
      return {
        ...view,
        config: {
          ...(cfg ?? {}),
          widgets: nextWidgets,
        },
      } as typeof view;
    });

    if (!viewsChanged) return project;
    return { ...project, views: nextViews };
  });
}
