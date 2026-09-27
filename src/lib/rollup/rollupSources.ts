/**
 * Where a rollup reads from — the one list both field dialogs offer.
 *
 * A rollup either follows a relation field of this record (forward) or
 * collects the records of some project whose relation field links to this
 * record (backlink, `RollupFieldConfig.backlink`). The dialogs show both in
 * one picker, so "visits of this client" is a choice next to "tasks of this
 * project" rather than a separate mode to find. Kept free of Svelte so the
 * rules are tested once and CreateField / ConfigureField cannot drift apart.
 *
 * @since 3.6.0
 */

import type { RollupFieldConfig } from "src/settings/base/settings";

/** What a project contributes: its id, its name and the relations it declares. */
export interface RollupSourceProject {
  readonly id: string;
  readonly name: string;
  readonly fieldConfig?: {
    readonly [field: string]: { readonly relation?: { readonly targetProjectId?: string } } | undefined;
  };
}

export type RollupSource =
  | { readonly kind: "forward"; readonly value: string; readonly relationField: string }
  | {
      readonly kind: "backlink";
      readonly value: string;
      readonly projectId: string;
      readonly projectName: string;
      readonly relationField: string;
    };

// Both kinds are encoded, so no field name can pass for the other kind: a
// relation literally named `backlink:["visits","client"]` stays a forward
// source (blui-review).
const FORWARD_PREFIX = "forward:";
const BACKLINK_PREFIX = "backlink:";

function forwardValue(relationField: string): string {
  return FORWARD_PREFIX + JSON.stringify(relationField);
}

function parseForwardValue(value: string): string | null {
  if (!value.startsWith(FORWARD_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(value.slice(FORWARD_PREFIX.length));
    return typeof parsed === "string" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

function backlinkValue(projectId: string, relationField: string): string {
  return BACKLINK_PREFIX + JSON.stringify([projectId, relationField]);
}

function parseBacklinkValue(value: string): { projectId: string; relationField: string } | null {
  if (!value.startsWith(BACKLINK_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(value.slice(BACKLINK_PREFIX.length));
    if (Array.isArray(parsed) && typeof parsed[0] === "string" && typeof parsed[1] === "string") {
      return { projectId: parsed[0], relationField: parsed[1] };
    }
  } catch {
    // Not one of ours: treated as no source.
  }
  return null;
}

/**
 * Every source a rollup on a field of `currentProjectId` can read: this
 * project's relation fields first, then — for every project, this one
 * included — each relation field that points at this project.
 */
export function rollupSources(
  relationFieldNames: readonly string[],
  projects: readonly RollupSourceProject[],
  currentProjectId: string
): RollupSource[] {
  const forward: RollupSource[] = relationFieldNames.map((name) => ({
    kind: "forward",
    value: forwardValue(name),
    relationField: name,
  }));
  const backlinks: RollupSource[] = [];
  if (currentProjectId) {
    for (const project of projects) {
      for (const [field, cfg] of Object.entries(project.fieldConfig ?? {})) {
        if (cfg?.relation?.targetProjectId !== currentProjectId) continue;
        backlinks.push({
          kind: "backlink",
          value: backlinkValue(project.id, field),
          projectId: project.id,
          projectName: project.name,
          relationField: field,
        });
      }
    }
  }
  return [...forward, ...backlinks];
}

/** The picker value that stands for a stored config. */
export function rollupSourceValue(cfg: RollupFieldConfig | undefined): string {
  if (!cfg) return "";
  if (cfg.backlink) return backlinkValue(cfg.backlink.projectId, cfg.backlink.relationField);
  return cfg.relationField ? forwardValue(cfg.relationField) : "";
}

/**
 * The config after picking `value`. `null` means no source: the caller drops
 * the rollup config. Switching between forward and backlink keeps the target
 * field, the function and its options, and removes the other kind's keys so
 * a config never names two sources.
 */
export function applyRollupSource(cfg: RollupFieldConfig | undefined, value: string): RollupFieldConfig | null {
  if (!value) return null;
  const base: RollupFieldConfig = cfg ?? { relationField: "", targetField: "", function: "count" };
  const { backlink: _backlink, targetProjectId: _target, ...rest } = base;
  void _backlink;
  void _target;
  const back = parseBacklinkValue(value);
  if (back) return { ...rest, relationField: "", backlink: back };
  const forward = parseForwardValue(value);
  if (forward) return { ...rest, relationField: forward };
  return null;
}

/** The project whose fields a rollup aggregates: the backlink's, or the forward relation's target. */
export function rollupSourceProjectId(
  cfg: RollupFieldConfig | undefined,
  relationTargetOf: (relationField: string) => string | undefined
): string {
  if (!cfg) return "";
  if (cfg.backlink) return cfg.backlink.projectId;
  return cfg.relationField ? relationTargetOf(cfg.relationField) ?? "" : "";
}

/** Functions whose answer depends on the order of the records (orderBy applies). */
export function rollupFunctionIsPositional(fn: RollupFieldConfig["function"] | undefined): boolean {
  return fn === "first_value" || fn === "last_value";
}

/** The order-by choice that switches the dialog to free text. */
export const ORDER_BY_CUSTOM = "\u0000custom";

/**
 * Order-by choices for a positional rollup: none, the target's known fields,
 * the saved field even when it is not among them, and a way to type any other
 * — the dialog knows only the target's configured fields, while ordering is
 * usually by a plain `date` property (Codex gate of calc-demo).
 */
export function rollupOrderByChoices(
  targetOptions: ReadonlyArray<{ label: string; value: string }>,
  saved: string | undefined,
  noneLabel: string,
  customLabel: string
): Array<{ label: string; value: string }> {
  const known = targetOptions.filter((o) => o.value !== "");
  const withSaved = saved && !known.some((o) => o.value === saved) ? [...known, { label: saved, value: saved }] : known;
  return [{ label: noneLabel, value: "" }, ...withSaved, { label: customLabel, value: ORDER_BY_CUSTOM }];
}
