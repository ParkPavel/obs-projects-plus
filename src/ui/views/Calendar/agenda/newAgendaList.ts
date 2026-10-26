import type { AgendaCustomList } from "src/settings/v3/settings";

/** A unique list or filter-group id, in the shape the list editor writes. */
export function agendaListId(): string {
  return `list-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * w4-input2: the list «Add list» creates from a name typed in place — the
 * list editor's defaults (clipboard icon, visual mode, no filters, so every
 * record shows) at the end of the order. Icon, colour and filters are set
 * later from the list's menu.
 */
export function newAgendaList(name: string, order: number): AgendaCustomList {
  return {
    id: agendaListId(),
    name,
    icon: { type: "lucide", value: "clipboard-list" },
    filterMode: "visual",
    filterGroup: { id: agendaListId(), conjunction: "AND", filters: [], groups: [] },
    order,
    collapsed: false,
  };
}
