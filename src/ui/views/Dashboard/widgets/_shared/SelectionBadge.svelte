<script lang="ts" context="module">
  /**
   * Pure visibility predicate — exposed via context="module" so unit tests
   * can verify the rule without mounting the component.
   *
   * Returns `true` exactly when the WindowShell `badges` slot of `widget`
   * should render a `<SelectionBadge>`:
   *   - the widget's type is a v1 receiver (stats, data-table);
   *   - a selection is active;
   *   - the selection was NOT emitted by this widget itself (self-skip rule
   *     keeps the driver from labelling its own selection — driver widgets
   *     communicate state via their own active-segment styling, spec §6.1).
   *
   * Decoupled from any Svelte lifecycle to make `shouldShowSelectionBadge` a
   * trivially testable function. The literal source-id checks mirror the
   * builders in `selectionStore.ts` — kept in sync via the spec contract
   * (see spec §6.2 + the canonical `dataTableSourceId` / `statsSourceId`).
   */

  import type { SelectionState } from "../../canvasSelectionStore";

  /**
   * Widget types that receive a SelectionBadge in v1.
   *   - `stats`        — receiver-only (#044.4)
   *   - `data-table`   — receiver (#044.3a) + driver hybrid (#044.3b, deferred)
   * Chart is driver-only (#044.2); its active-segment styling is the v1 UX,
   * a badge would duplicate that signal so it is intentionally excluded.
   */
  const SELECTION_RECEIVER_TYPES: ReadonlySet<string> = new Set([
    "stats",
    "data-table",
  ]);

  export function shouldShowSelectionBadge(
    widget: { readonly type: string; readonly id: string },
    selection: SelectionState,
  ): boolean {
    if (!SELECTION_RECEIVER_TYPES.has(widget.type)) return false;
    if (
      selection.source === null ||
      selection.field === null ||
      selection.values.length === 0
    ) {
      return false;
    }
    // Self-skip: a driver/receiver hybrid should not label its own emission.
    if (
      selection.source === `data-table:${widget.id}` ||
      selection.source === `stats:${widget.id}`
    ) {
      return false;
    }
    return true;
  }
</script>

<script lang="ts">
  /**
   * SelectionBadge.svelte — pill rendered into the WindowShell `badges` slot
   * to label a cross-widget selection that is actively narrowing this widget.
   *
   * Spec: .ai_internal/New-specification/CROSS_WIDGET_SPEC.md §6.2.
   * Ticket: #044.5 (Phase 5 sub-PR 5).
   *
   * The badge owns NO state — `field` and `value` come in as props from the
   * canvas-level selection subscription, and `on:clear` is the user-facing
   * dismiss action that the parent wires into `selectionStore.clearSelection()`.
   */

  import { createEventDispatcher } from "svelte";

  export let field: string;
  export let values: ReadonlyArray<string>;

  const dispatch = createEventDispatcher<{ clear: void }>();

  function handleClear(): void {
    dispatch("clear");
  }

  $: displayValue = values.length === 1 ? (values[0] ?? "") : values.join(", ");
  $: tooltip = `${field}: ${displayValue}`;
</script>

<span
  class="ppp-selection-badge"
  title={tooltip}
  data-testid="ppp-selection-badge"
>
  <span class="ppp-selection-badge__label">
    <span class="ppp-selection-badge__field">{field}:</span>
    <span class="ppp-selection-badge__value">{displayValue}</span>
  </span>
  <button
    type="button"
    class="ppp-selection-badge__clear"
    title="Clear selection"
    aria-label="Clear selection"
    on:click|stopPropagation={handleClear}
  >
    ✕
  </button>
</span>

<style>
  .ppp-selection-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: var(--ppp-radius-pill, 62.5rem);
    background: color-mix(
      in srgb,
      var(--interactive-accent) 18%,
      var(--background-secondary)
    );
    color: var(--text-normal);
    font-size: 0.75rem;
    line-height: 1.2;
    max-width: 14rem;
  }

  .ppp-selection-badge__label {
    display: inline-flex;
    gap: 0.25rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-selection-badge__field {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .ppp-selection-badge__value {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ppp-selection-badge__clear {
    /* Reset native button styling so the ✕ visually belongs to the pill. */
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1;
    width: 1rem;
    height: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .ppp-selection-badge__clear:hover,
  .ppp-selection-badge__clear:focus-visible {
    background: color-mix(
      in srgb,
      var(--interactive-accent) 28%,
      transparent
    );
    color: var(--text-normal);
    outline: none;
  }
</style>
