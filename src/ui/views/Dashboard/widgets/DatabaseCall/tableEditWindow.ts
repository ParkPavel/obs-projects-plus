import type { RenderRow } from "./tableCanon";

export type TableWindowRow = RenderRow | { kind: "spacer"; key: string; count: number };

/** Keep just the active editor mounted outside the viewport, with exact gaps. */
export function editWindow(rows: RenderRow[], start: number, end: number, editingId?: string): TableWindowRow[] {
  const pinned = editingId ? rows.findIndex(row => row.kind === "record" && row.record.id === editingId) : -1;
  const indices = Array.from({ length: end - start }, (_, index) => start + index);
  if (pinned >= 0 && pinned < start) indices.unshift(pinned);
  if (pinned >= end) indices.push(pinned);
  const result: TableWindowRow[] = [];
  let cursor = 0;
  for (const index of indices) {
    if (index > cursor) result.push({ kind: "spacer", key: `s:${cursor}`, count: index - cursor });
    result.push(rows[index]!);
    cursor = index + 1;
  }
  if (cursor < rows.length) result.push({ kind: "spacer", key: `s:${cursor}`, count: rows.length - cursor });
  return result;
}
