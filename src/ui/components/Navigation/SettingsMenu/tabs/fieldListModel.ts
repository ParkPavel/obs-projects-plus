// fieldListModel.ts — i3-final (B4): the pure half of the «Properties» list.
//
// One list of a table's fields, Notion-style: shown fields in their order,
// hidden ones in a group of their own. Visibility follows the table's own rule
// (`tableCanon.isVisible`), so `path` and relation companions start hidden here
// exactly as they do in the table, and the primary field cannot be hidden.

import { isVisible, primaryFieldName } from "src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon";

export interface ListedField {
  readonly name: string;
  readonly type: string;
  readonly derived?: boolean;
  readonly identifier?: boolean;
}

export type FieldHideConfig = Readonly<Record<string, { readonly hide?: boolean } & Record<string, unknown>>>;

export interface FieldRows<F extends ListedField> {
  readonly shown: F[];
  readonly hidden: F[];
  readonly primary: string;
}

/** Shown fields in the saved order (unknown ones after, in frame order) and the hidden ones. */
export function fieldRows<F extends ListedField>(fields: readonly F[], fieldConfig: FieldHideConfig, orderFields: readonly string[]): FieldRows<F> {
  const primary = primaryFieldName(fields);
  const rank = (name: string) => {
    const i = orderFields.indexOf(name);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const ordered = fields.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f.name) - rank(b.f.name) || a.i - b.i).map(({ f }) => f);
  return {
    shown: ordered.filter((f) => isVisible(f.name, primary, fieldConfig[f.name])),
    hidden: ordered.filter((f) => !isVisible(f.name, primary, fieldConfig[f.name])),
    primary,
  };
}

/** `fieldConfig` with one field shown or hidden; every other key of the entry is kept. */
export function withHidden(fieldConfig: FieldHideConfig, name: string, hidden: boolean): Record<string, Record<string, unknown>> {
  return { ...fieldConfig, [name]: { ...fieldConfig[name], hide: hidden } };
}

/** The full order after moving `name` among the shown fields; hidden fields keep their place after them. */
export function reorderShown(shown: readonly string[], hidden: readonly string[], name: string, to: number): string[] {
  const from = shown.indexOf(name);
  if (from === -1) return [...shown, ...hidden];
  const next = shown.filter((n) => n !== name);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, name);
  return [...next, ...hidden];
}

/** Case-insensitive substring match on the field name; an empty query matches all. */
export const matchesFieldQuery = (name: string, query: string): boolean =>
  query.trim() === "" || name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
