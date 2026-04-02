<script lang="ts">
  /**
   * DragOverlay — Ghost bar + snap indicator for timeline DnD v3.2.0
   *
   * Rendered as an absolutely-positioned overlay inside TimelineView.
   * Subscribes to TimelineDragManager stores for reactive position updates.
   * Uses lightweight CSS transforms — no Svelte re-render during drag.
   */

  import type { Writable } from 'svelte/store';
  import { writable } from 'svelte/store';
  import type { DragState, GhostPosition } from './types';

  /** Current drag state from TimelineDragManager */
  export let state: Writable<DragState>;
  /** Ghost position from TimelineDragManager */
  export let ghostPosition: Writable<GhostPosition | null>;
  /** Snap time label from TimelineDragManager */
  export let snapTimeLabel: Writable<string | null>;
  /** v3.2.2: Edge date label for cross-week drag */
  export let edgeDateLabel: Writable<string | null> = writable(null);
  /** Array of day column DOM elements for positioning */
  export let dayColumnElements: HTMLElement[];

  /** Current drag mode from TimelineDragManager */
  export let activeMode: Writable<import('./types').DragMode | null>;

  /** Reference to the .dnd-overlay element for coordinate transforms */
  let overlayElement: HTMLElement;

  // Reactive subscriptions to stores
  $: currentState = $state;
  $: ghost = $ghostPosition;
  $: snapLabel = $snapTimeLabel;
  $: edgeLabel = $edgeDateLabel;
  $: mode = $activeMode;

  // Calculate ghost pixel position relative to the overlay container
  // v3.2.3: Cross-period ghost uses absolute positioning relative to overlay parent
  // instead of position:fixed (which breaks when ancestors have CSS transform).
  $: ghostStyle = (() => {
    if (!ghost || currentState !== 'dragging') return '';
    
    // Cross-period: compute absolute position relative to overlay parent
    if (ghost.viewportRect && overlayElement) {
      const overlayRect = overlayElement.getBoundingClientRect();
      const relLeft = ghost.viewportRect.left - overlayRect.left;
      const relTop = ghost.viewportRect.top - overlayRect.top;
      return `
        top: ${relTop}px;
        left: ${relLeft}px;
        width: ${ghost.viewportRect.width}px;
        height: ${ghost.viewportRect.height}px;
        z-index: 9999;
      `;
    }
    
    const column = dayColumnElements[ghost.dayColumnIndex];
    if (!column) return '';

    const columnRect = column.getBoundingClientRect();
    const parentRect = column.parentElement?.getBoundingClientRect();
    if (!parentRect) return '';

    const left = columnRect.left - parentRect.left;
    const width = columnRect.width;

    return `
      top: ${ghost.topRem}rem;
      left: ${left}px;
      width: ${width}px;
      height: ${ghost.heightRem}rem;
    `;
  })();

  // v3.2.4: Compute snap line top position — when cross-period, convert to overlay-relative pixels
  $: snapLineTop = (() => {
    if (!ghost || currentState !== 'dragging') return `${ghost?.topRem ?? 0}rem`;
    if (ghost.viewportRect && overlayElement) {
      const overlayRect = overlayElement.getBoundingClientRect();
      return `${ghost.viewportRect.top - overlayRect.top}px`;
    }
    return `${ghost.topRem}rem`;
  })();
</script>

{#if currentState === 'dragging' && ghost}
  <!-- v3.3.4: When viewportRect is set, a portal ghost renders on document.body
       at the correct target position. Skip local rendering to avoid a clipped
       duplicate stuck at the period boundary. -->
  {#if !ghost.viewportRect}
  <div class="dnd-overlay" bind:this={overlayElement} aria-hidden="true">
    <!-- Ghost bar -->
    <div
      class="dnd-ghost-bar"
      class:dnd-ghost-resize-top={mode === 'resize-top'}
      class:dnd-ghost-resize-bottom={mode === 'resize-bottom'}
      style={ghostStyle}
    >
      <!-- v4.0.2: Resize handle indicators on ghost bar -->
      <div class="dnd-ghost-handle-top" aria-hidden="true"></div>
      {#if ghost.title}
        <div class="dnd-ghost-title">{ghost.title}</div>
      {/if}
      <div class="dnd-ghost-time">{ghost.time} – {ghost.endTime}</div>
      <div class="dnd-ghost-handle-bottom" aria-hidden="true"></div>
    </div>

    <!-- Snap line indicator -->
    {#if snapLabel}
      <div
        class="dnd-snap-line"
        style="top: {snapLineTop}"
      >
        <span class="dnd-snap-label">{snapLabel}</span>
      </div>
    {/if}

    <!-- v3.2.2: Edge date indicator for cross-week drag -->
    {#if edgeLabel}
      <div class="dnd-edge-indicator" style={ghostStyle}>
        <span class="dnd-edge-label">{edgeLabel}</span>
      </div>
    {/if}
  </div>
  {/if}
{/if}

<style>
  .dnd-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 50;
    /* v3.2.4: Allow cross-period ghost to extend beyond overlay bounds */
    overflow: visible;
  }

  .dnd-ghost-bar {
    position: absolute;
    border-left: 0.1875rem solid var(--text-accent);
    background: color-mix(in srgb, var(--text-accent) 20%, var(--background-primary));
    border-radius: 0.25rem;
    opacity: 0.85;
    box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.15), 0 0 0 0.0625rem color-mix(in srgb, var(--text-accent) 20%, transparent);
    transition: none; /* No transition during drag — instant updates */
    box-sizing: border-box;
    padding: 0.125rem 0.375rem;
    overflow: hidden;
  }

  /* v4.0.2: Resize handle indicators on ghost bar — always visible */
  .dnd-ghost-handle-top {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-top: 0.5rem solid var(--text-accent);
    border-right: 0.5rem solid transparent;
    opacity: 0.6;
  }
  .dnd-ghost-handle-bottom {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-bottom: 0.5rem solid var(--text-accent);
    border-left: 0.5rem solid transparent;
    opacity: 0.6;
  }

  /* Highlight the active resize edge */
  .dnd-ghost-resize-top .dnd-ghost-handle-top {
    opacity: 1;
    border-top-width: 0.75rem;
    border-right-width: 0.75rem;
    filter: drop-shadow(0 0 0.25rem var(--text-accent));
  }
  .dnd-ghost-resize-bottom .dnd-ghost-handle-bottom {
    opacity: 1;
    border-bottom-width: 0.75rem;
    border-left-width: 0.75rem;
    filter: drop-shadow(0 0 0.25rem var(--text-accent));
  }

  @media (pointer: coarse) {
    .dnd-ghost-handle-top {
      border-top-width: 0.75rem;
      border-right-width: 0.75rem;
      opacity: 0.8;
    }
    .dnd-ghost-handle-bottom {
      border-bottom-width: 0.75rem;
      border-left-width: 0.75rem;
      opacity: 0.8;
    }
    .dnd-ghost-resize-top .dnd-ghost-handle-top {
      border-top-width: 1rem;
      border-right-width: 1rem;
    }
    .dnd-ghost-resize-bottom .dnd-ghost-handle-bottom {
      border-bottom-width: 1rem;
      border-left-width: 1rem;
    }
  }

  .dnd-ghost-time {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dnd-ghost-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dnd-snap-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 0.0625rem;
    background: var(--text-accent);
    opacity: 0.5;
    pointer-events: none;
  }

  .dnd-snap-label {
    position: absolute;
    left: -3rem;
    top: -0.5rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-accent);
    background: var(--background-primary);
    padding: 0 0.25rem;
    border-radius: 0.125rem;
    white-space: nowrap;
  }

  .dnd-edge-indicator {
    position: absolute;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    pointer-events: none;
  }

  .dnd-edge-label {
    background: var(--text-accent);
    color: var(--text-on-accent);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
    margin-top: -1.25rem;
  }
</style>
