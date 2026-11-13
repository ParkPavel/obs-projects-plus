import type { WidgetDefinition } from "./types";

/** Layout locks pin stack indices, including when another tile crosses them. */
export function reorderWidgets(previous: readonly WidgetDefinition[], proposal: WidgetDefinition[], shadowId?: string): WidgetDefinition[] {
  const ids = new Set(previous.map(w => w.id));
  const proposedIds = new Set(proposal.map(w => w.id));
  if (proposal.length !== previous.length || proposedIds.size !== proposal.length ||
    proposal.some(w => !ids.has(w.id) && w.id !== shadowId)) return [...previous];
  const locked = new Set(previous.filter(w => w.layout?.locked).map(w => w.id));
  if ([...locked].some(id => !proposedIds.has(id))) return [...previous];
  const movable = proposal.filter(w => !locked.has(w.id));
  let index = 0;
  return previous.map(w => w.layout?.locked ? w : movable[index++]!);
}
