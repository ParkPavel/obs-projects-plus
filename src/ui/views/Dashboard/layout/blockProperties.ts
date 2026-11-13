// blockProperties.ts — i3-dash: «Properties» reached from the block it is about.
//
// i3-dash: the toolbar «Properties» button opened the schema of the PROJECT
// this dashboard belongs to, on a page whose blocks may read other projects
// or nothing at all — nothing on screen said which fields it was about, and
// people took it for a leftover. The same dialog (dashboardSchema.ts, kept as
// is) is now an entry of the block menu, offered only on a block that reads
// this project, and labelled with that project's name. A block that reads
// another project (its fields are written through that project's own view) or
// no data (text, divider, cover) does not offer it.
//
// The grid provides the entry through context so the block menu, rendered
// deep inside the widget router, needs no new prop chain.

import { getContext, setContext } from "svelte";
import type { WidgetDefinition, WidgetType } from "../types";

const KEY = Symbol("ppp-block-properties");

/** Blocks with no data source: there is nothing for «Properties» to describe. */
const NO_DATA: ReadonlySet<WidgetType> = new Set<WidgetType>(["text", "divider", "cover-banner"]);

export type PropertiesTarget = Pick<WidgetDefinition, "type" | "sourceConfig">;

export interface BlockProperties {
  /** The name of the source whose properties the entry edits, or null when the block offers none. */
  sourceFor(widget: PropertiesTarget): string | null;
  open(): void;
}

/** Whether the block reads this dashboard's own project (the one the schema dialog edits). */
export function readsHostProject(widget: PropertiesTarget): boolean {
  if (NO_DATA.has(widget.type)) return false;
  // `sourceConfig.projectId` is honoured only for database-call (types.ts, #184).
  return !(widget.type === "database-call" && (widget.sourceConfig?.projectId ?? "") !== "");
}

export function createBlockProperties(getSourceName: () => string, open: () => void): BlockProperties {
  return {
    sourceFor: (widget) => (readsHostProject(widget) ? getSourceName() : null),
    open,
  };
}

export function provideBlockProperties(properties: BlockProperties): void {
  setContext(KEY, properties);
}

/** Undefined outside a dashboard grid (a widget rendered on its own, a test). */
export function useBlockProperties(): BlockProperties | undefined {
  return getContext<BlockProperties | undefined>(KEY);
}
