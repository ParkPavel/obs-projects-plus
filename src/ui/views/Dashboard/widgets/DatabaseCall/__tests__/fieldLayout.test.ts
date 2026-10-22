/**
 * i3-final (B4) — the dashboard's field list is the default of its table tabs.
 *
 * Before, «View settings → fields» wrote `view.config.table.fieldConfig`, which
 * only the legacy data-table widget read: on a modern database-call block the
 * list did nothing. These prove the rule in `fieldLayout.ts` — inherit where
 * the tab is silent, keep what the tab said itself — through `buildColumns`,
 * the function that decides the columns a table actually renders.
 */

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type { DataTableConfig } from "../../../types";
import { buildColumns } from "../tableCanon";
import { detachInherited, inheritFieldLayout } from "../fieldLayout";

const field = (name: string, identifier = false): DataField =>
  ({ name, type: DataFieldType.String, repeated: false, identifier, derived: false }) as DataField;
const FIELDS = [field("name", true), field("status"), field("owner"), field("due")];
const columns = (cfg: DataTableConfig | undefined) => buildColumns(FIELDS, cfg).map((c) => c.field.name);

const DASHBOARD: DataTableConfig = {
  fieldConfig: { owner: { hide: true } },
  orderFields: ["name", "due", "status"],
};

describe("inheritFieldLayout", () => {
  it("a tab with no field settings of its own shows the dashboard's list", () => {
    expect(columns(inheritFieldLayout({}, DASHBOARD))).toEqual(["name", "due", "status"]);
    expect(columns(inheritFieldLayout(undefined, DASHBOARD))).toEqual(["name", "due", "status"]);
  });

  it("a tab's own choice for a field wins over the dashboard's", () => {
    const tab: DataTableConfig = { fieldConfig: { owner: { hide: false }, status: { hide: true } } };
    expect(columns(inheritFieldLayout(tab, DASHBOARD))).toEqual(["name", "due", "owner"]);
  });

  it("a tab's own order wins as a whole; widths stay the tab's", () => {
    const tab: DataTableConfig = { orderFields: ["status", "due"], fieldConfig: { due: { widthRem: 20 } } };
    const merged = inheritFieldLayout(tab, DASHBOARD);
    expect(columns(merged)).toEqual(["name", "status", "due"]);
    expect(buildColumns(FIELDS, merged).find((c) => c.field.name === "due")?.widthRem).toBe(20);
  });

  it("no dashboard list leaves the tab exactly as stored", () => {
    const tab: DataTableConfig = { fieldConfig: { owner: { hide: true } } };
    expect(inheritFieldLayout(tab, undefined)).toBe(tab);
    expect(inheritFieldLayout(tab, {})).toBe(tab);
  });
});

describe("detachInherited — a tab write does not freeze the dashboard list into it", () => {
  it("drops inherited hides and order the tab only carried along", () => {
    const shown = inheritFieldLayout({}, DASHBOARD) as DataTableConfig;
    const afterSort = { ...shown, sortCriteria: [{ field: "due", order: "asc" as const }] };
    expect(detachInherited(afterSort, {}, DASHBOARD)).toEqual({ sortCriteria: [{ field: "due", order: "asc" }] });
  });

  it("keeps what the tab changed: a new hide, a different order, a width", () => {
    const shown = inheritFieldLayout({}, DASHBOARD) as DataTableConfig;
    const next: DataTableConfig = {
      ...shown,
      fieldConfig: { ...shown.fieldConfig, owner: { hide: false }, status: { hide: true }, due: { widthRem: 9 } },
      orderFields: ["due", "name"],
    };
    expect(detachInherited(next, {}, DASHBOARD)).toEqual({
      fieldConfig: { owner: { hide: false }, status: { hide: true }, due: { widthRem: 9 } },
      orderFields: ["due", "name"],
    });
  });

  it("keeps a hide the tab already owned even when it equals the dashboard's", () => {
    const own: DataTableConfig = { fieldConfig: { owner: { hide: true } } };
    const next = inheritFieldLayout(own, DASHBOARD) as DataTableConfig;
    expect(detachInherited(next, own, DASHBOARD).fieldConfig).toEqual({ owner: { hide: true } });
  });
});
