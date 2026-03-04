<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";

  /**
   * Specifies the link text.
   */
  export let linkText: string;
  /**
   * Specifies the path to the source file.
   */
  export let sourcePath: string;
  /**
   * Specifies a tooltip to display when hovering the link.
   */
  export let tooltip = "";
  /**
   * Specifies whether the link is resolved.
   */
  export let resolved;

  const dispatch = createEventDispatcher<{
    open: { linkText: string; sourcePath: string; newLeaf: boolean; shiftKey: boolean };
    hover: {
      event: MouseEvent;
      linkText: string;
      sourcePath: string;
    };
    /** v3.0.10: Long-press on touch devices — consumer shows navigation menu */
    longpress: { linkText: string; sourcePath: string; event: TouchEvent | MouseEvent };
  }>();
  let aria = {};
  if (tooltip) {
    aria = {
      "aria-label": tooltip,
      "aria-label-position": "top",
    };
  }

  // v3.0.10: Long-press detection for touch devices (500ms threshold)
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  let touchStartPos: { x: number; y: number } | null = null;
  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 10; // px — cancel if finger moves too far

  function handleTouchStart(e: TouchEvent) {
    longPressFired = false;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      // Haptic feedback via vibrate if available
      if (navigator.vibrate) navigator.vibrate(30);
      dispatch("longpress", { linkText, sourcePath, event: e });
    }, LONG_PRESS_MS);
  }

  function handleTouchMove(e: TouchEvent) {
    if (!longPressTimer || !touchStartPos) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPos.x);
    const dy = Math.abs(touch.clientY - touchStartPos.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    // If long-press was triggered, suppress the subsequent click
    if (longPressFired) {
      e.preventDefault();
      longPressFired = false;
    }
  }

  onDestroy(() => {
    if (longPressTimer) clearTimeout(longPressTimer);
  });
</script>

<a
  href={linkText}
  data-href={linkText}
  class={`internal-link`}
  class:is-unresolved={!resolved}
  target="_blank"
  rel="noopener"
  on:click={(event) => {
    event.stopPropagation();
    event.preventDefault();

    // If long-press just fired, ignore the click
    if (longPressFired) {
      longPressFired = false;
      return;
    }

    // Ctrl+click opens in new tab, Shift+click opens in new window
    dispatch("open", {
      linkText,
      sourcePath,
      newLeaf: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
    });
  }}
  on:mouseover={(event) => {
    event.stopPropagation();
    event.preventDefault();

    // Always show preview on hover (not edit mode)
    dispatch("hover", {
      event,
      linkText,
      sourcePath,
    });
  }}
  on:touchstart|passive={handleTouchStart}
  on:touchmove|passive={handleTouchMove}
  on:touchend={handleTouchEnd}
  on:focus
  {...aria}
>
  <slot />
</a>

<style>
  .is-unresolved {
    opacity: 0.5;
  }
</style>
