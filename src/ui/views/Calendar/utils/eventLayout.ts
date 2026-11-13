/**
 * Shared overlap layout for calendar events (day / week / two weeks / month).
 *
 * Events are grouped into clusters of transitive overlap; each cluster is laid
 * out in greedy columns and every member gets the cluster's column count, so
 * widths never mix between clusters and bars never cover each other.
 * Times are plain numbers (minutes or ms) so the same code serves the timeline
 * (dayjs) and the month cell (minutes since midnight).
 */
/**
 * i3-calendar — the shortest an event is drawn on the day/week time grid, and
 * so the length the overlap layout reserves for it: one 15-minute step, the
 * drag snap (dnd/types SNAP_INTERVAL_DEFAULT). The bar and the layout read
 * this one value; a CSS minimum taller than it made a 15-minute event cover
 * the next hour on touch screens.
 */
export const MIN_EVENT_VISUAL_MINUTES = 15;

/** i3-calendar — a timed event this long or longer lives in the all-day row only. */
export const ALL_DAY_ROW_MIN_HOURS = 24;

/**
 * i3-calendar — the part of [start, end) that falls on one day, in minutes
 * from that day's midnight, or null when the event does not touch the day.
 * An event crossing midnight is drawn as one clipped segment per day.
 */
export function daySegment(
  startMs: number,
  endMs: number,
  dayStartMs: number,
  dayEndMs: number,
): { startMin: number; endMin: number; continuesBefore: boolean; continuesAfter: boolean } | null {
  const end = Math.max(endMs, startMs);
  const segStart = Math.max(startMs, dayStartMs);
  const segEnd = Math.min(end, dayEndMs);
  if (segEnd < segStart || (segEnd === segStart && startMs !== end)) return null;
  return {
    startMin: (segStart - dayStartMs) / 60000,
    endMin: (segEnd - dayStartMs) / 60000,
    continuesBefore: startMs < dayStartMs,
    continuesAfter: end > dayEndMs,
  };
}

export interface LayoutSpan {
  start: number;
  end: number;
}

export interface LayoutSlot {
  column: number;
  totalColumns: number;
}

/**
 * @param minDuration - minimum visual length of an event in the same unit as the
 *   spans: a short event is drawn at least this tall, so collision uses it too.
 * @returns slots in the input order.
 */
export function layoutOverlapClusters(spans: readonly LayoutSpan[], minDuration = 0): LayoutSlot[] {
  const items = spans.map((s, index) => ({
    index,
    start: s.start,
    end: Math.max(s.end, s.start + minDuration),
  }));
  items.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.index - b.index);

  const slots: LayoutSlot[] = new Array<LayoutSlot>(spans.length);
  let cluster: { index: number; column: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const total = columnEnds.length;
    for (const c of cluster) slots[c.index] = { column: c.column, totalColumns: total };
    cluster = [];
    columnEnds = [];
  };

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    cluster.push({ index: item.index, column });
    clusterEnd = cluster.length === 1 ? item.end : Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) flush();
  return slots;
}

/**
 * Month cell stack: `rowsThatFit` card rows are shown, the rest go behind a
 * "+N" button that lives in its own reserved row below the cards.
 */
export function stackCell(count: number, rowsThatFit: number): { visible: number; hidden: number } {
  const visible = Math.min(count, Math.max(0, Math.floor(rowsThatFit)));
  return { visible, hidden: count - visible };
}
