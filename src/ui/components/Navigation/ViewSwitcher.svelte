<script lang="ts">
  import { Icon } from "obsidian-svelte";
  import { customViews } from "src/lib/stores/customViews";
  import { settings } from "src/lib/stores/settings";
  import type { ViewDefinition, ViewId } from "src/settings/settings";
  import { isTouchDevice } from "src/lib/stores/ui";

  export let views: ViewDefinition[] = [];
  export let activeViewId: ViewId | undefined;
  export let onSelect: (viewId: ViewId) => void;

  $: showTitles = $settings.preferences.showViewTitles ?? true;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isHorizontalSwipe: boolean | null = null;
  // v7.1: Much stricter thresholds to prevent misclicks
  const SWIPE_THRESHOLD = 35; // Higher threshold before deciding direction
  const SWIPE_MIN_DISTANCE = 100; // Larger distance for intentional swipe
  const TAP_MAX_MOVE = 15; // Max movement for tap (prevents swipe on tap)
  const TAP_MAX_DURATION = 200; // Max tap duration in ms

  let buttonRefs: HTMLButtonElement[] = [];
  let touchHandled = false; // Block synthetic click after touch

  function handleTouchStart(event: TouchEvent) {
    touchStartX = event.touches[0]?.clientX ?? 0;
    touchStartY = event.touches[0]?.clientY ?? 0;
    touchStartTime = Date.now();
    isHorizontalSwipe = null;
  }

  function handleTouchMove(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);

    if (isHorizontalSwipe === null) {
      // v7.1: Only decide after clear movement - require 3x ratio
      if (deltaX > deltaY * 3 && deltaX > SWIPE_THRESHOLD) {
        isHorizontalSwipe = true;
        event.stopPropagation(); // Block Obsidian sidebar
      } else if (deltaY > deltaX * 2 && deltaY > SWIPE_THRESHOLD) {
        // Clear vertical scroll - don't interfere
        isHorizontalSwipe = false;
      }
    }

    if (isHorizontalSwipe) {
      event.preventDefault(); // Prevent scroll during horizontal swipe
      event.stopPropagation();
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch) {
      isHorizontalSwipe = null;
      return;
    }

    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const duration = Date.now() - touchStartTime;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // v7.1: Check if this was a tap (small movement, short duration)
    if (distance < TAP_MAX_MOVE && duration < TAP_MAX_DURATION) {
      // This was a tap - let it through to button click
      isHorizontalSwipe = null;
      return;
    }

    // Not a swipe - clear state
    if (!isHorizontalSwipe) {
      isHorizontalSwipe = null;
      return;
    }

    // Block synthetic click after swipe
    touchHandled = true;
    setTimeout(() => { touchHandled = false; }, 300);

    // Swipe distance check - must be intentional
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE) {
      isHorizontalSwipe = null;
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Find current view index
    const currentIndex = views.findIndex(v => v.id === activeViewId);
    if (currentIndex === -1) {
      isHorizontalSwipe = null;
      return;
    }

    // Determine swipe direction and switch view (NO wrap-around to prevent confusion)
    let nextIndex: number;
    if (deltaX > 0) {
      // Swipe right → previous view (NO wrap)
      nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    } else {
      // Swipe left → next view (NO wrap)
      nextIndex = currentIndex < views.length - 1 ? currentIndex + 1 : views.length - 1;
    }

    // Only change if different
    if (nextIndex !== currentIndex) {
      const nextView = views[nextIndex];
      if (nextView) {
        onSelect?.(nextView.id);
        // v7.1: Use instant scroll to avoid "bounce" effect
        buttonRefs[nextIndex]?.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
      }
    }

    isHorizontalSwipe = null;
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
    // Block if this was triggered by swipe end
    if (touchHandled) return;
    onSelect?.(viewId);
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
  aria-label="Переключение видов"
  bind:this={viewSwitcherElement}
  on:wheel={handleWheel}
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
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
    scroll-behavior: smooth;
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
  }

  .view-item:hover {
    background: rgba(var(--accent-rgb, 120, 170, 255), 0.1);
  }

  .view-item.active {
    background: rgba(var(--accent-rgb, 120, 170, 255), 0.2);
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
