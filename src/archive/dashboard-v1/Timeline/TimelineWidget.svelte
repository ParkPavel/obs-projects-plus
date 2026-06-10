<script lang="ts">
  import type { DataFrame, DataRecord, DataValue } from "src/lib/dataframe/dataframe";
  import { isString, isNumber } from "src/lib/dataframe/dataframe";
  import type { TimelineConfig } from "src/ui/views/Dashboard/types";
  import dayjs from "dayjs";

  export let source: DataFrame;
  export let config: Record<string, unknown>;

  // ── Config cast ─────────────────────────────────────────────
  $: cfg = config as unknown as TimelineConfig;

  // ── Date helpers ─────────────────────────────────────────────
  function parseVal(v: DataValue | null | undefined): dayjs.Dayjs | null {
    if (!v) return null;
    if (typeof v === "string" || v instanceof Date) {
      const d = dayjs(v as string);
      return d.isValid() ? d : null;
    }
    if (isNumber(v)) {
      const d = dayjs(v);
      return d.isValid() ? d : null;
    }
    return null;
  }

  function getLabel(record: DataRecord): string {
    if (cfg.labelField) {
      const v = record.values[cfg.labelField];
      if (v !== undefined && v !== null) return String(v);
    }
    return record.id;
  }

  function getColor(record: DataRecord, index: number): string {
    if (cfg.colorField) {
      const v = record.values[cfg.colorField];
      if (v && isString(v)) {
        return stringToColor(v);
      }
    }
    return PALETTE[index % PALETTE.length] ?? "#888";
  }

  // ── Zoom → visible window span in days ──────────────────────
  const ZOOM_DAYS: Record<TimelineConfig["zoom"], number> = {
    day: 1,
    week: 7,
    month: 30,
    quarter: 90,
    year: 365,
  };

  $: windowDays = ZOOM_DAYS[cfg.zoom ?? "month"];

  $: windowStart = cfg.windowStart
    ? dayjs(cfg.windowStart)
    : dayjs().subtract(Math.floor(windowDays / 4), "day");

  $: windowEnd = windowStart.add(windowDays, "day");

  // ── Build bar rows ──────────────────────────────────────────
  interface BarRow {
    id: string;
    label: string;
    color: string;
    left: number;  // % from left edge
    width: number; // % width
    title: string; // tooltip
    outOfRange: boolean;
  }

  $: bars = source.records
    .map((record, i) => {
      const start = parseVal(record.values[cfg.startField]);
      if (!start) return null;

      const rawEnd = cfg.endField ? parseVal(record.values[cfg.endField]) : null;
      const end = rawEnd && rawEnd.isAfter(start) ? rawEnd : start.add(1, "day");

      const totalMs = windowEnd.diff(windowStart, "millisecond");
      if (totalMs <= 0) return null;

      const leftMs = start.diff(windowStart, "millisecond");
      const widthMs = end.diff(start, "millisecond");

      const left = Math.max(0, Math.min(100, (leftMs / totalMs) * 100));
      const right = Math.max(0, Math.min(100, ((leftMs + widthMs) / totalMs) * 100));
      const width = Math.max(0.3, right - left);

      const label = getLabel(record);
      const color = getColor(record, i);

      const fmtStart = start.format("YYYY-MM-DD");
      const fmtEnd = end.format("YYYY-MM-DD");
      const tooltip = `${label}: ${fmtStart} → ${fmtEnd}`;

      const outOfRange = end.isBefore(windowStart) || start.isAfter(windowEnd);

      return { id: record.id, label, color, left, width, title: tooltip, outOfRange } as BarRow;
    })
    .filter((b): b is BarRow => b !== null && !b.outOfRange);

  // ── Today marker ────────────────────────────────────────────
  $: todayPct = (() => {
    const now = dayjs();
    if (now.isBefore(windowStart) || now.isAfter(windowEnd)) return null;
    const totalMs = windowEnd.diff(windowStart, "millisecond");
    return (now.diff(windowStart, "millisecond") / totalMs) * 100;
  })();

  // ── Header ticks ────────────────────────────────────────────
  interface Tick {
    label: string;
    pct: number;
  }

  $: ticks = (() => {
    const result: Tick[] = [];
    const totalMs = windowEnd.diff(windowStart, "millisecond");
    if (totalMs <= 0) return result;

    let step: dayjs.ManipulateType;
    let fmt: string;

    if (windowDays <= 1) { step = "hour"; fmt = "HH:mm"; }
    else if (windowDays <= 7) { step = "day"; fmt = "ddd D"; }
    else if (windowDays <= 60) { step = "week"; fmt = "MMM D"; }
    else if (windowDays <= 180) { step = "month"; fmt = "MMM"; }
    else { step = "month"; fmt = "MMM YY"; }

    let cur = windowStart.startOf(step);
    while (cur.isBefore(windowEnd)) {
      if (cur.isAfter(windowStart) || cur.isSame(windowStart)) {
        const pct = (cur.diff(windowStart, "millisecond") / totalMs) * 100;
        if (pct >= 0 && pct <= 100) {
          result.push({ label: cur.format(fmt), pct });
        }
      }
      cur = cur.add(1, step);
    }
    return result;
  })();

  // ── Palette ──────────────────────────────────────────────────
  const PALETTE = [
    "var(--ppp-chip-blue-bg, hsl(215,70%,65%))",
    "var(--ppp-chip-green-bg, hsl(145,55%,55%))",
    "var(--ppp-chip-orange-bg, hsl(30,80%,60%))",
    "var(--ppp-chip-purple-bg, hsl(270,55%,65%))",
    "var(--ppp-chip-red-bg, hsl(0,65%,60%))",
    "var(--ppp-chip-yellow-bg, hsl(50,75%,60%))",
    "var(--ppp-chip-teal-bg, hsl(180,55%,50%))",
    "var(--ppp-chip-pink-bg, hsl(330,60%,65%))",
  ];

  function stringToColor(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
    return `hsl(${h % 360},55%,60%)`;
  }
</script>

<div class="ppp-timeline">
  <!-- Header: time axis ticks -->
  <div class="ppp-tl-header" role="presentation">
    <div class="ppp-tl-label-col" aria-hidden="true"></div>
    <div class="ppp-tl-axis">
      {#each ticks as tick}
        <span class="ppp-tl-tick" style:left="{tick.pct}%">{tick.label}</span>
      {/each}
      {#if todayPct !== null}
        <div
          class="ppp-tl-today"
          style:left="{todayPct}%"
          role="presentation"
          aria-label="Today"
        ></div>
      {/if}
    </div>
  </div>

  <!-- Rows -->
  <div class="ppp-tl-rows" role="list">
    {#each bars as bar (bar.id)}
      <div class="ppp-tl-row" role="listitem">
        <div class="ppp-tl-label-col" title={bar.label}>{bar.label}</div>
        <div class="ppp-tl-track">
          {#if todayPct !== null}
            <div class="ppp-tl-today-track" style:left="{todayPct}%" aria-hidden="true"></div>
          {/if}
          <div
            class="ppp-tl-bar"
            style:left="{bar.left}%"
            style:width="{bar.width}%"
            style:background={bar.color}
            title={bar.title}
            role="img"
            aria-label={bar.title}
          >{bar.label}</div>
        </div>
      </div>
    {/each}

    {#if bars.length === 0}
      <div class="ppp-tl-empty">
        {source.records.length === 0
          ? "No records"
          : "No records with dates in the current window"}
      </div>
    {/if}
  </div>
</div>

<style>
  .ppp-timeline {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
  }

  .ppp-tl-header {
    display: flex;
    position: sticky;
    top: 0;
    z-index: var(--ppp-db-z-bar, 2);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    min-height: 1.5rem;
  }

  .ppp-tl-label-col {
    width: 10rem;
    flex-shrink: 0;
    padding: 0 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-right: 0.0625rem solid var(--background-modifier-border);
    line-height: 1.5rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .ppp-tl-axis {
    position: relative;
    flex: 1;
    height: 1.5rem;
  }

  .ppp-tl-tick {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    white-space: nowrap;
    line-height: 1.5rem;
    pointer-events: none;
  }

  .ppp-tl-today {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0.0625rem;
    background: var(--color-red, hsl(0,70%,55%));
    opacity: 0.7;
    pointer-events: none;
  }

  .ppp-tl-rows {
    flex: 1;
    overflow-y: auto;
  }

  .ppp-tl-row {
    display: flex;
    align-items: center;
    min-height: 2rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border-focus, rgba(0,0,0,0.04));
  }

  .ppp-tl-row:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-tl-row .ppp-tl-label-col {
    min-height: 2rem;
    display: flex;
    align-items: center;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .ppp-tl-track {
    position: relative;
    flex: 1;
    height: 2rem;
  }

  .ppp-tl-today-track {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0.0625rem;
    background: var(--color-red, hsl(0,70%,55%));
    opacity: 0.4;
    pointer-events: none;
    z-index: var(--ppp-db-z-raised, 1);
  }

  .ppp-tl-bar {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    height: 1.25rem;
    border-radius: 0.25rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-on-accent, #fff);
    display: flex;
    align-items: center;
    padding: 0 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: default;
    z-index: var(--ppp-db-z-bar, 2);
    min-width: 0.25rem;
    box-shadow: 0 0.0625rem 0.1875rem rgba(0,0,0,0.2);
    transition: filter 100ms ease;
  }

  .ppp-tl-bar:hover {
    filter: brightness(1.1);
  }

  .ppp-tl-empty {
    padding: 1.5rem;
    text-align: center;
    color: var(--text-faint);
    font-style: italic;
  }
</style>
