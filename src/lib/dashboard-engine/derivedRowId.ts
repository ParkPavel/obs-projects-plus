/**
 * i2-data (D17): «Развернуть списки» and «Разворот» make several rows from one
 * note, with ids like `Клиенты/Анна.md__unnest_0` or `…/Анна.md__2`. The table
 * showed that id as the name («Антистресс.md__unnest_») and a cell edit went
 * to a file that does not exist. The note a row came from is its source; a
 * row that is not a note is read-only.
 */
const DERIVED_SUFFIX = /(\.md)__(?:unnest_)?\d+$/;

/** The note a pipeline row came from, or the id itself for a note. */
export function sourceIdOf(id: string): string {
  return id.replace(DERIVED_SUFFIX, "$1");
}

/** Whether the row was made by a pipeline step rather than read from a note. */
export function isDerivedRowId(id: string): boolean {
  return DERIVED_SUFFIX.test(id);
}
