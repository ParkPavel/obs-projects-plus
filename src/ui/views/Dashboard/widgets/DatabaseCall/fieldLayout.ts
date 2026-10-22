// fieldLayout.ts — i3-final (B4): which fields a dashboard table tab shows.
//
// THE RULE. A dashboard view's settings carry one field list («Properties» in
// View settings, stored as `view.config.table.fieldConfig[*].hide` and
// `view.config.table.orderFields`). Before, only the legacy data-table widget
// read it, so the list looked broken on every modern database-call block. Now
// it is the DEFAULT for every table tab on that dashboard, and a tab overrides
// it where the tab has said something itself:
//
//   - visibility, per field: a `hide` the tab stores wins; otherwise the
//     dashboard's `hide` for that field applies;
//   - order, as a whole: a non-empty `orderFields` on the tab wins; otherwise
//     the dashboard's order applies;
//   - width and pinning are always the tab's own — the list does not set them.
//
// Writes go the other way through `detachInherited`: a tab's config change
// (a sort, a resize) arrives with the inherited values folded in, and storing
// them would freeze the dashboard's list into that tab for good. Only values
// the tab already owned, or that differ from what it inherited, are kept.

import type { DataTableConfig, DataTableFieldConfig } from "../../types";

type FieldEntry = DataTableFieldConfig[string];

/** The tab's table config with the dashboard's field list underneath it. */
export function inheritFieldLayout(
  tab: DataTableConfig | undefined,
  dashboard: DataTableConfig | undefined
): DataTableConfig | undefined {
  const inheritedHide = Object.entries(dashboard?.fieldConfig ?? {}).filter(([, c]) => c?.hide !== undefined);
  const inheritedOrder = dashboard?.orderFields ?? [];
  if (inheritedHide.length === 0 && inheritedOrder.length === 0) return tab;
  const own = tab?.fieldConfig ?? {};
  const fieldConfig: Record<string, FieldEntry> = { ...own };
  for (const [name, cfg] of inheritedHide) {
    if (own[name]?.hide !== undefined) continue;
    fieldConfig[name] = { ...own[name], hide: cfg.hide === true };
  }
  const orderFields = tab?.orderFields?.length ? tab.orderFields : inheritedOrder;
  return { ...(tab ?? {}), fieldConfig, ...(orderFields.length > 0 ? { orderFields: [...orderFields] } : {}) };
}

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  (a ?? []).length === (b ?? []).length && (a ?? []).every((n, i) => n === b?.[i]);

/** `next` without the values it only carries because they were inherited. */
export function detachInherited(
  next: DataTableConfig,
  ownTab: DataTableConfig | undefined,
  dashboard: DataTableConfig | undefined
): DataTableConfig {
  const own = ownTab?.fieldConfig ?? {};
  const inherited = dashboard?.fieldConfig ?? {};
  const fieldConfig: Record<string, FieldEntry> = {};
  for (const [name, cfg] of Object.entries(next.fieldConfig ?? {})) {
    const inheritedHide = inherited[name]?.hide;
    const borrowed = own[name]?.hide === undefined && inheritedHide !== undefined && (cfg.hide === true) === (inheritedHide === true);
    const { hide, ...rest } = cfg;
    const kept: FieldEntry = borrowed || hide === undefined ? rest : { ...rest, hide };
    if (Object.keys(kept).length > 0) fieldConfig[name] = kept;
  }
  const { fieldConfig: _fc, orderFields, ...base } = next;
  const borrowedOrder = !ownTab?.orderFields?.length && sameList(orderFields, dashboard?.orderFields);
  return {
    ...base,
    ...(Object.keys(fieldConfig).length > 0 ? { fieldConfig } : {}),
    ...(orderFields && orderFields.length > 0 && !borrowedOrder ? { orderFields } : {}),
  };
}
