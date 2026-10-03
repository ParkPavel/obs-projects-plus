<script lang="ts">
  /**
   * cards-g5: the resize handle of one card, at its trailing lower corner.
   *
   * A view renders it into SharedCard's `controls` slot, so the card shell
   * stays view-neutral. The handle owns no config: it reports a live preview
   * (`onPreview`, local to the view, never written) while a drag is under way,
   * and commits the card's new override once (`onCommit`) — on release, or per
   * key action. `onCommit(undefined)` removes the override.
   *
   * Pointer: a press takes pointer capture and stops there — it never reaches
   * the card (open on click, gallery long press) or a board grip. Vertical
   * travel changes the height in whole rem steps (pointer math through
   * cssLength.ts); with `horizontal`, sideways travel changes the column span,
   * one column per measured column step. Cancel or Escape restores the frame.
   *
   * Keyboard (a slider): ArrowUp/ArrowDown change the height one step,
   * Shift four; with `horizontal`, ArrowRight/ArrowLeft change the span. Home
   * returns the height to the view value (Shift+Home the span); Delete or
   * Backspace removes this card's override.
   *
   * The element whose height the frame sets is the one the view marks with
   * `data-ppp-frame-target` inside the card (the media), else the card itself;
   * it is measured only when no height is saved, to start from what is shown.
   */
  import { onDestroy } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { rootFontPx } from "src/ui/utils/cssLength";
  import {
    CARD_FRAME_BOUNDS,
    HEIGHT_STEP_REM,
    LARGE_STEP,
    clampGridSpan,
    heightAfterDrag,
    normalizeCardFrame,
    resolveCardFrame,
    sameFrame,
    snapHeightRem,
    spanAfterDrag,
    type CardFrame,
  } from "./cardFrames";

  /** The view-wide frame, which a missing override dimension inherits. */
  export let view: CardFrame = {};
  /** This card's saved override, if any. */
  export let override: CardFrame | undefined = undefined;
  /** Whether sideways travel and Left/Right change the column span (gallery grid). */
  export let horizontal = false;
  /** One column of horizontal travel, in CSS pixels (measured by the grid). */
  export let columnStep: (() => number) | undefined = undefined;
  export let onPreview: (frame: CardFrame | null) => void = () => undefined;
  export let onCommit: (frame: CardFrame | undefined) => void;

  $: current = resolveCardFrame(view, override);
  $: valueText = [
    current.heightRem !== undefined
      ? $i18n.t("settings-menu.view-config.card-frames.value-height", { height: current.heightRem })
      : $i18n.t("settings-menu.view-config.card-frames.value-auto"),
    ...(horizontal ? [$i18n.t("settings-menu.view-config.card-frames.value-span", { span: current.gridSpan ?? 1 })] : []),
  ].join(", ");

  let node: HTMLElement;
  let drag: {
    pointerId: number;
    x: number;
    y: number;
    root: number;
    height: number;
    span: number;
    step: number;
    proposed: CardFrame | undefined;
    /** A preview went out, so the end of the drag must take it back. */
    previewed: boolean;
  } | null = null;

  /** The card this handle belongs to. */
  const card = (): HTMLElement | null => node?.closest<HTMLElement>(".ppp-shared-card") ?? null;

  /** The height shown now, in rem: the saved one, else the frame target measured. */
  function shownHeight(root: number): number {
    if (current.heightRem !== undefined) return current.heightRem;
    const host = card();
    const target = host?.querySelector<HTMLElement>("[data-ppp-frame-target]") ?? host;
    return snapHeightRem((target?.getBoundingClientRect().height ?? 0) / root);
  }

  /** One column of travel: the grid's measure, else the card's width per span. */
  function stepWidth(): number {
    const measured = columnStep?.();
    if (measured !== undefined && measured > 0) return measured;
    const width = card()?.getBoundingClientRect().width ?? 0;
    return width / (current.gridSpan ?? 1);
  }

  /** The override a new height and/or span make, from the saved one. */
  function overrideWith(change: { heightRem?: number | undefined; gridSpan?: number | undefined }): CardFrame | undefined {
    return normalizeCardFrame({ ...override, ...change });
  }

  function commit(next: CardFrame | undefined): void {
    if (sameFrame(next, override)) return;
    onCommit(next);
  }

  // ── pointer ────────────────────────────────────────────────────────────────

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || drag) return;
    e.stopPropagation();
    e.preventDefault();
    node.setPointerCapture?.(e.pointerId);
    const root = rootFontPx(node.ownerDocument);
    drag = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      root,
      height: shownHeight(root),
      span: current.gridSpan ?? 1,
      step: horizontal ? stepWidth() : 0,
      proposed: override,
      previewed: false,
    };
    node.ownerDocument.defaultView?.addEventListener("keydown", onEscape, true);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.stopPropagation();
    const height = heightAfterDrag(drag.height, e.clientY - drag.y, drag.root);
    const span = horizontal ? spanAfterDrag(drag.span, e.clientX - drag.x, drag.step) : drag.span;
    const proposed = overrideWith({
      ...(height !== drag.height ? { heightRem: height } : {}),
      ...(span !== drag.span ? { gridSpan: span } : {}),
    });
    if (sameFrame(proposed, drag.proposed)) return;
    drag.proposed = proposed;
    drag.previewed = true;
    onPreview(proposed ?? {});
  }

  function end(): CardFrame | undefined {
    const proposed = drag?.proposed;
    const previewed = drag?.previewed ?? false;
    if (drag && node.hasPointerCapture?.(drag.pointerId)) node.releasePointerCapture?.(drag.pointerId);
    drag = null;
    node?.ownerDocument.defaultView?.removeEventListener("keydown", onEscape, true);
    if (previewed) onPreview(null);
    return proposed;
  }

  function onPointerUp(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.stopPropagation();
    commit(end());
  }

  function cancel(): void {
    if (drag) end();
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key !== "Escape" || !drag) return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
  }

  onDestroy(cancel);

  /**
   * Events that would reach the card stop here: a touch would start the
   * gallery long press, a mouse press a board grip's arming check, a click
   * would open the record.
   */
  const stop = (e: Event): void => e.stopPropagation();

  // ── keyboard ───────────────────────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent): void {
    if (drag) return;
    const steps = e.shiftKey ? LARGE_STEP : 1;
    let next: CardFrame | undefined;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown": {
        const sign = e.key === "ArrowUp" ? 1 : -1;
        next = overrideWith({ heightRem: snapHeightRem(shownHeight(rootFontPx(node.ownerDocument)) + sign * steps * HEIGHT_STEP_REM) });
        break;
      }
      case "ArrowRight":
      case "ArrowLeft": {
        if (!horizontal) return;
        const sign = e.key === "ArrowRight" ? 1 : -1;
        next = overrideWith({ gridSpan: clampGridSpan((current.gridSpan ?? 1) + sign * steps) });
        break;
      }
      case "Home":
        if (e.shiftKey && !horizontal) return;
        next = overrideWith(e.shiftKey ? { gridSpan: undefined } : { heightRem: undefined });
        break;
      case "Delete":
      case "Backspace":
        next = undefined;
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    commit(next);
  }
</script>

<div
  bind:this={node}
  class="ppp-card-resize-handle"
  class:ppp-card-resize-handle--horizontal={horizontal}
  class:ppp-card-resize-handle--active={drag !== null}
  role="slider"
  tabindex="0"
  aria-label={$i18n.t("settings-menu.view-config.card-frames.resize")}
  aria-orientation="vertical"
  aria-valuemin={CARD_FRAME_BOUNDS.heightRem.min}
  aria-valuemax={CARD_FRAME_BOUNDS.heightRem.max}
  aria-valuenow={current.heightRem}
  aria-valuetext={valueText}
  title={$i18n.t("settings-menu.view-config.card-frames.hint")}
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={onPointerUp}
  on:pointercancel={cancel}
  on:lostpointercapture={cancel}
  on:keydown={onKeyDown}
  on:touchstart={stop}
  on:mousedown={stop}
  on:click={stop}
  on:dblclick={stop}
  on:keypress={stop}
>
  <span class="ppp-card-resize-handle__glyph" aria-hidden="true"></span>
</div>

<style>
  /* cards-g5: the trailing lower corner of the card (SharedCard makes the card
     a positioned box). It stacks above the card's content by DOM order alone:
     it is the card's last child and positioned, so no z-index. Only the
     handle refuses touch panning; a pan anywhere else on the card scrolls. */
  .ppp-card-resize-handle {
    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    box-sizing: border-box;
    width: var(--size-4-5);
    height: var(--size-4-5);
    padding: var(--size-4-1);
    color: var(--text-faint);
    opacity: 0.6;
    cursor: ns-resize;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .ppp-card-resize-handle--horizontal {
    cursor: nwse-resize;
  }
  .ppp-card-resize-handle__glyph {
    width: var(--size-4-2);
    height: var(--size-4-2);
    border-right: var(--ppp-border-width-thick, 0.125rem) solid currentColor;
    border-bottom: var(--ppp-border-width-thick, 0.125rem) solid currentColor;
    border-bottom-right-radius: var(--radius-s);
  }
  /* A fine pointer that hovers finds it under the card's hover or on keyboard
     focus; at rest it is out of the way. */
  @media (hover: hover) and (pointer: fine) {
    .ppp-card-resize-handle {
      opacity: 0;
    }
    :global(.ppp-shared-card:hover) .ppp-card-resize-handle {
      opacity: 0.8;
    }
    .ppp-card-resize-handle:hover {
      opacity: 1;
      color: var(--text-muted);
    }
  }

  /* On touch it is always shown, and a full finger target. */
  @media (pointer: coarse) {
    .ppp-card-resize-handle {
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
      padding: var(--size-4-2);
      opacity: 0.7;
    }
  }

  /* Keyboard focus and a drag under way show it fully on every pointer; last,
     and one class stronger than the rest rules above. */
  .ppp-card-resize-handle:focus-visible,
  .ppp-card-resize-handle.ppp-card-resize-handle--active {
    opacity: 1;
    color: var(--text-muted);
  }
  .ppp-card-resize-handle:focus-visible {
    outline-offset: calc(-1 * var(--ppp-border-width-thick, 0.125rem));
  }
</style>
