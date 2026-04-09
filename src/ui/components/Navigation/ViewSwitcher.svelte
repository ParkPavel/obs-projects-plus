<script lang="ts">
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { customViews } from "src/lib/stores/customViews";
  import { settings } from "src/lib/stores/settings";
  import type { ViewDefinition, ViewId } from "src/settings/settings";
  import { isTouchDevice } from "src/lib/stores/ui";

  export let views: ViewDefinition[] = [];
  export let activeViewId: ViewId | undefined;
  export let onSelect: (viewId: ViewId) => void;

  $: showTitles = $settings.preferences.showViewTitles ?? true;

  // v3.2.1 fix: Misclick prevention — simplified architecture.
  // REMOVED swipe-to-navigate (conflicted with native pan-x scroll).
  // Native horizontal scroll via CSS touch-action: pan-x + overflow-x: auto.
  // Tap = select view. Scroll = just scroll the tab bar.
  //
  // Root cause of the old bug:
  //   touch-action: pan-x → browser handles panning → fires touchcancel
  //   instead of touchend → touchHandled was never set → click leaked through.
  //   Additionally, swipe navigation called onSelect() even after native scroll.
  //
  // New approach:
  //   1. Track ANY finger movement > MOVE_DEADZONE
  //   2. On touchend OR touchcancel → block clicks for 400ms
  //   3. No swipe navigation — just native pan + tap
  const MOVE_DEADZONE = 8;  // px — beyond this = not a tap

  let touchStartX = 0;
  let touchStartY = 0;
  let buttonRefs: HTMLButtonElement[] = [];
  let touchMoved = false;
  let touchHandled = false;

  function handleTouchStart(event: TouchEvent) {
    touchStartX = event.touches[0]?.clientX ?? 0;
    touchStartY = event.touches[0]?.clientY ?? 0;
    touchMoved = false;
  }

  function handleTouchMove(event: TouchEvent) {
    if (touchMoved) return;
    const touch = event.touches[0];
    if (!touch) return;
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    if (deltaX > MOVE_DEADZONE || deltaY > MOVE_DEADZONE) {
      touchMoved = true;
    }
  }

  // v3.2.1: handles BOTH touchend AND touchcancel —
  // touchcancel fires when browser takes over native pan gesture.
  function handleTouchEndOrCancel() {
    if (touchMoved) {
      touchHandled = true;
      setTimeout(() => { touchHandled = false; }, 400);
    }
  }

  function handleKeydown(event: KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + views.length) % views.length;
    const nextView = views[nextIndex];
    if (nextView) {
      buttonRefs[nextIndex]?.focus();
      onSelect?.(nextView.id);
      event.preventDefault();
    }
  }

  function handleButtonClick(viewId: ViewId, index: number) {
    if (touchHandled) return;
    onSelect?.(viewId);
    // v3.2.1: Scroll the selected tab into view for better visibility
    buttonRefs[index]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function getViewIcon(type: string): string {
    return $customViews[type]?.getIcon() ?? "layout-grid";
  }
  
  let viewSwitcherElement: HTMLDivElement;
  
  // v7.3: Wheel scroll for pointer devices (mouse/trackpad) - not touch
  function handleWheel(event: WheelEvent) {
    if (!viewSwitcherElement || $isTouchDevice) return; // Only on pointer devices
    
    // Always handle wheel on pointer devices (hovering = intent to scroll)
    const isHorizontalWheel = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    
    event.preventDefault();
    
    if (isHorizontalWheel) {
      // Horizontal trackpad scroll
      viewSwitcherElement.scrollLeft += event.deltaX;
    } else {
      // Vertical wheel over horizontal menu = horizontal scroll
      viewSwitcherElement.scrollLeft += event.deltaY;
    }
  }
</script>

<div
  class="view-switcher"
  role="tablist"
  aria-label={$i18n.t('common.view-switcher')}
  bind:this={viewSwitcherElement}
  on:wheel={handleWheel}
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEndOrCancel}
  on:touchcancel={handleTouchEndOrCancel}
>
  {#each views as view, index (view.id)}
    <button
      class:active={view.id === activeViewId}
      class:icons-only={!showTitles}
      class="view-item"
      role="tab"
      aria-selected={view.id === activeViewId}
      tabindex={view.id === activeViewId ? 0 : -1}
      on:click={() => handleButtonClick(view.id, index)}
      on:keydown={(event) => handleKeydown(event, index)}
      aria-label={view.name}
      title={view.name}
      bind:this={buttonRefs[index]}
    >
      <Icon name={getViewIcon(view.type)} size="sm" />
      {#if showTitles}
        <span>{view.name}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .view-switcher {
    display: flex;
    gap: var(--spacing-sm, 0.5rem);
    overflow-x: auto;
    /* v3.1.0: Declare touch intent so browser doesn't compete with custom handler */
    touch-action: pan-x;
    /* v3.1.0: Prevent scroll chaining to parent (Obsidian workspace) */
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
  }

  .view-switcher::-webkit-scrollbar {
    display: none;
  }

  .view-item {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.5rem;
    min-width: 3.5rem;
    min-height: 2.75rem;
    border-radius: 0.5rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    /* v3.2.1: Prevent visual pre-selection during native pan scroll */
    -webkit-tap-highlight-color: transparent;
    /* v3.2.1: manipulation = pan-x ∩ pan-y ∩ pinch-zoom
       Intersected with container's pan-x → effective pan-x.
       Disables double-tap-to-zoom → removes 300ms click delay. */
    touch-action: manipulation;
  }

  .view-item:hover {
    background: var(--background-modifier-hover);
  }

  .view-item.active {
    background: var(--background-modifier-active-hover, var(--background-modifier-hover));
  }

  .view-item span {
    font-size: 0.6875rem;
    line-height: 1.1;
    text-overflow: ellipsis;
    overflow: hidden;
    max-width: 5.625rem;
  }

  /* Icons only mode */
  .view-item.icons-only {
    flex-direction: row;
    min-width: 2.5rem;
    padding: 0.5rem;
  }

  /* Mobile */
  @media (max-width: 30rem) {
    .view-item {
      min-width: 2.75rem;
      padding: 0.25rem;
    }
    .view-item span {
      font-size: 0.625rem;
      max-width: 3rem;
    }
  }
</style>
