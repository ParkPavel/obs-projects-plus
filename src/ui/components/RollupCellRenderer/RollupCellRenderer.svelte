<script lang="ts">
  /**
   * RollupCellRenderer — standalone Rollup display component (#045.4).
   *
   * Generic, GridCell-free renderer for `Rollup` values. Designed to be
   * dropped into:
   *   - DataTable widget rows (DV-backed and folder-backed alike)
   *   - Board card metadata
   *   - Sub-base canvas list items
   *   - Anywhere a rollup result must surface outside the legacy DataGrid
   *
   * Display strategy is driven from the rollup-mode taxonomy
   * (`src/lib/database/rollupMode.ts`), not from the raw kernel function:
   *
   *   group=percent   → progress bar (0–100, clamped)
   *   group=show      → comma-split chip strip (or "—" when empty)
   *   group=count|more→ plain text (numeric → tabular-nums, formatted)
   *
   * Either `modeId` or `fn` is sufficient; passing `modeId` is preferred
   * because it gives presentational fidelity for the "show original" /
   * "show unique" modes that share a kernel.
   */

  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import type { RollupFunction } from "src/lib/engine/aggregate";
  import {
    getRollupMode,
    type RollupModeGroup,
    type RollupModeId,
  } from "src/lib/database/rollupMode";

  export let value: Optional<DataValue> = null;
  /** Persisted rollup kernel (legacy projects without `mode`). */
  export let fn: RollupFunction | "" = "";
  /** Presentational mode id (preferred). Overrides `fn` when both set. */
  export let modeId: RollupModeId | "" = "";
  /** Decimal places for numeric plain-text rendering. Default 2. */
  export let precision: number = 2;
  /** Placeholder rendered when the value is empty/null/undefined. */
  export let emptyPlaceholder: string = "—";

  $: descriptor = modeId ? getRollupMode(modeId) : null;
  $: group = resolveGroup(descriptor?.group, fn);
  $: isPercent = group === "percent";
  $: isShow = group === "show";

  $: percentValue = isPercent ? parsePercent(value) : null;
  $: chips = isShow ? splitChips(value) : null;
  $: plainText = !isPercent && !isShow ? formatPlain(value, precision) : "";

  /**
   * Resolve the presentational group. When `modeId` is unknown (e.g.
   * legacy save with only `function` persisted), fall back to the
   * function-name → group mapping that matches `ROLLUP_MODES`.
   */
  function resolveGroup(
    fromMode: RollupModeGroup | undefined,
    legacyFn: RollupFunction | ""
  ): RollupModeGroup {
    if (fromMode) return fromMode;
    if (!legacyFn) return "more";
    if (legacyFn.startsWith("percent_")) return "percent";
    if (
      legacyFn === "show_original" ||
      legacyFn === "show_unique" ||
      legacyFn === "concat" ||
      legacyFn === "concat_unique"
    ) {
      return "show";
    }
    if (legacyFn.startsWith("count")) return "count";
    return "more";
  }

  function parsePercent(val: Optional<DataValue>): number {
    if (val == null) return 0;
    const str = String(val).replace("%", "").trim();
    const n = parseFloat(str);
    if (Number.isNaN(n)) return 0;
    // Clamp; the engine may emit 0–1 (Notion-style) or 0–100 — accept both.
    const scaled = n <= 1 && n >= 0 ? n * 100 : n;
    return Math.min(100, Math.max(0, scaled));
  }

  function splitChips(val: Optional<DataValue>): string[] {
    if (val == null) return [];
    if (Array.isArray(val)) {
      return val
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => String(v));
    }
    if (val === "") return [];
    return String(val)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function formatPlain(val: Optional<DataValue>, decimals: number): string {
    if (val == null) return emptyPlaceholder;
    if (val === "") return emptyPlaceholder;
    if (Array.isArray(val)) {
      if (val.length === 0) return emptyPlaceholder;
      return val.map(String).join(", ");
    }
    if (typeof val === "number") {
      if (Number.isInteger(val)) return val.toString();
      return val.toFixed(Math.max(0, decimals));
    }
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    return String(val);
  }
</script>

<span class="ppp-rollup-cell" data-rollup-group={group}>
  {#if isPercent && percentValue !== null}
    <span class="ppp-rollup-bar-wrap" title="{percentValue}%">
      <span
        class="ppp-rollup-bar"
        style="width: {percentValue}%"
        data-testid="ppp-rollup-bar"
      ></span>
      <span class="ppp-rollup-bar-label">{Math.round(percentValue)}%</span>
    </span>
  {:else if chips !== null}
    {#if chips.length === 0}
      <span class="ppp-rollup-empty">{emptyPlaceholder}</span>
    {:else}
      <span class="ppp-rollup-chips">
        {#each chips as chip}
          <span class="ppp-rollup-chip">{chip}</span>
        {/each}
      </span>
    {/if}
  {:else}
    <span class="ppp-rollup-plain">{plainText}</span>
  {/if}
</span>

<style>
  .ppp-rollup-cell {
    display: inline-flex;
    align-items: center;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    max-width: 100%;
  }

  .ppp-rollup-bar-wrap {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 4rem;
    width: 100%;
  }

  .ppp-rollup-bar {
    display: block;
    height: 0.375rem;
    border-radius: 0.1875rem;
    background: var(--interactive-accent);
    opacity: 0.7;
    min-width: 0.125rem;
    flex-shrink: 0;
    transition: width 150ms ease;
  }

  .ppp-rollup-bar-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    white-space: nowrap;
  }

  .ppp-rollup-chips {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.1875rem;
    align-items: center;
  }

  .ppp-rollup-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.75rem;
    background: var(--background-modifier-hover);
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
    white-space: nowrap;
  }

  .ppp-rollup-empty {
    color: var(--text-faint);
  }

  .ppp-rollup-plain {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
