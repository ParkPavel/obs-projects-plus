<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { i18n } from 'src/lib/stores/i18n';
  import { rootFontPx } from 'src/ui/utils/cssLength';
  import { DND_CONSTANTS } from './types';
  import { minutesToTime, minutesToRem, yPositionToMinutes } from './SnapEngine';
  import { hapticTapCreate, hapticSnap, hapticCreationConfirm, hapticCancel } from './HapticManager';

  /**
   * CreationPreview — v3.2.0 Iteration 4
   * Preview bar shown while holding empty time.
   * No elapsed timer can confirm a draft.
   */

  export let startMinutes: number;
  export let endMinutes: number;
  export let hourHeightRem: number;
  export let startHour: number;
  export let endHour: number;
  export let columnElement: HTMLElement;
  export let onConfirm: (startTime: string, endTime: string) => void;
  export let onCancel: () => void;

  let currentStartMinutes = startMinutes;
  let currentEndMinutes = endMinutes;
  let lastSnappedMinutes = -1;

  // Resize state
  let resizeMode: 'top' | 'bottom' | null = null;

  $: topRem = minutesToRem(currentStartMinutes, startHour, hourHeightRem);
  $: heightRem = ((currentEndMinutes - currentStartMinutes) / 60) * hourHeightRem;
  $: startTimeLabel = minutesToTime(currentStartMinutes);
  $: endTimeLabel = minutesToTime(currentEndMinutes);

  $: currentStartMinutes = startMinutes;
  $: currentEndMinutes = endMinutes;
  onMount(() => { hapticTapCreate(); });
  onDestroy(() => { detachResize(); });

  function handleConfirmClick(): void {
    hapticCreationConfirm();
    onConfirm(minutesToTime(currentStartMinutes), minutesToTime(currentEndMinutes));
  }

  function handleCancelClick(): void {
    hapticCancel();
    onCancel();
  }

  // ── Resize touch handling ──

  function handleResizeTouchStart(event: TouchEvent, mode: 'top' | 'bottom'): void {
    event.stopPropagation();
    resizeMode = mode;

    columnElement.ownerDocument.addEventListener('touchmove', handleResizeTouchMove, { passive: false });
    columnElement.ownerDocument.addEventListener('touchend', handleResizeTouchEnd);
    columnElement.ownerDocument.addEventListener('touchcancel', handleResizeTouchEnd);
  }

  function handleResizeTouchMove(event: TouchEvent): void {
    if (!resizeMode) return;
    const touch = event.touches[0];
    if (!touch) return;

    if (event.cancelable) {
      event.preventDefault();
    }

    const rect = columnElement.getBoundingClientRect();
    const relativeY = touch.clientY - rect.top;
    const pointerMinutes = yPositionToMinutes(
      relativeY, startHour, endHour, hourHeightRem, rootFontPx(columnElement.ownerDocument),
      DND_CONSTANTS.SNAP_INTERVAL_DEFAULT
    );

    if (resizeMode === 'top') {
      const clamped = Math.min(pointerMinutes, currentEndMinutes - DND_CONSTANTS.MIN_DURATION_MINUTES);
      currentStartMinutes = Math.max(startHour * 60, clamped);
    } else {
      const clamped = Math.max(pointerMinutes, currentStartMinutes + DND_CONSTANTS.MIN_DURATION_MINUTES);
      currentEndMinutes = Math.min(endHour * 60, clamped);
    }

    // Haptic snap feedback
    const snapRef = resizeMode === 'top' ? currentStartMinutes : currentEndMinutes;
    if (lastSnappedMinutes !== snapRef) {
      hapticSnap();
      lastSnappedMinutes = snapRef;
    }
  }

  function handleResizeTouchEnd(): void {
    resizeMode = null;
    detachResize();
  }
  function detachResize(): void {
    columnElement.ownerDocument.removeEventListener('touchmove', handleResizeTouchMove);
    columnElement.ownerDocument.removeEventListener('touchend', handleResizeTouchEnd);
    columnElement.ownerDocument.removeEventListener('touchcancel', handleResizeTouchEnd);
  }
</script>

<div
  class="creation-preview"
  style="top: {topRem}rem; height: {heightRem}rem;"
>
  <!-- Top resize handle (always visible) -->
  <div
    class="resize-handle-top"
    on:touchstart|stopPropagation={(e) => handleResizeTouchStart(e, 'top')}
    aria-hidden="true"
  ></div>

  <div class="preview-content">
    <span class="preview-time">{startTimeLabel}–{endTimeLabel}</span>
    <div class="preview-actions">
      <button class="preview-confirm" aria-label={$i18n.t("common.save")} on:click={handleConfirmClick} type="button">✓</button>
      <button class="preview-cancel" aria-label={$i18n.t("common.cancel")} on:click={handleCancelClick} type="button">✕</button>
    </div>
  </div>

  <!-- Bottom resize handle (always visible) -->
  <div
    class="resize-handle-bottom"
    on:touchstart|stopPropagation={(e) => handleResizeTouchStart(e, 'bottom')}
    aria-hidden="true"
  ></div>
</div>

<style>
  .creation-preview {
    position: absolute;
    left: 0.25rem;
    right: 0.25rem;
    border: 0.125rem dashed var(--text-accent);
    background: color-mix(in srgb, var(--text-accent) 10%, transparent);
    border-radius: 0.25rem;
    z-index: 20;
    display: flex;
    flex-direction: column;
    animation: previewFadeIn 0.2s ease-out;
  }

  @keyframes previewFadeIn {
    from { opacity: 0; transform: scaleY(0.8); }
    to { opacity: 1; transform: scaleY(1); }
  }

  .preview-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.375rem;
    flex: 1;
    overflow: hidden;
    pointer-events: auto;
  }

  .preview-time {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-accent);
    white-space: nowrap;
  }

  .preview-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .preview-confirm,
  .preview-cancel {
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .preview-confirm {
    background: var(--text-accent);
    color: var(--background-primary);
  }

  .preview-cancel {
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  /* Resize handles — always visible for creation preview */
  .resize-handle-top,
  .resize-handle-bottom {
    position: absolute;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2;
    pointer-events: auto;
  }

  .resize-handle-top {
    top: 0;
    border-top: 0.75rem solid var(--text-accent);
    border-right: 0.75rem solid transparent;
    cursor: n-resize;
  }

  .resize-handle-bottom {
    bottom: 0;
    right: 0;
    left: auto;
    border-bottom: 0.75rem solid var(--text-accent);
    border-left: 0.75rem solid transparent;
    cursor: s-resize;
  }

  /* Touch zone 2.75rem around handles */
  .resize-handle-top::before,
  .resize-handle-bottom::before {
    content: '';
    position: absolute;
    width: 2.75rem;
    height: 2.75rem;
  }
  .resize-handle-top::before {
    top: -1.125rem;
    left: -1.125rem;
  }
  .resize-handle-bottom::before {
    bottom: -1.125rem;
    right: -1.125rem;
  }
</style>
