<script lang="ts">
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { customViews } from "src/lib/stores/customViews";
  import { settings } from "src/lib/stores/settings";
  import type { ViewDefinition, ViewId } from "src/settings/settings";
  import { isTouchDevice } from "src/lib/stores/ui";
  import { onDestroy } from "svelte";

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
    let nextIndex = -1;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % views.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + views.length) % views.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = views.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const view = views[index];
      if (view) onSelect?.(view.id);
      return;
    }
    else return;

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
    const resolvedType = type === "table" ? "database" : type;
    return $customViews[resolvedType]?.getIcon() ?? "layout-grid";
  }
  
  let viewSwitcherElement: HTMLDivElement;

  // v7.4: Overflow indicator — chevrons + edge fade shown when tabs overflow.
  // Purely visual/UX; mobile-safe because it respects the same scroll container.
  let canScrollLeft = false;
  let canScrollRight = false;

  function updateScrollIndicators() {
    if (!viewSwitcherElement) return;
    const { scrollLeft, scrollWidth, clientWidth } = viewSwitcherElement;
    // 1 tolerance absorbs sub-pixel rounding from zoom / devicePixelRatio.
    canScrollLeft = scrollLeft > 1;
    canScrollRight = scrollLeft + clientWidth < scrollWidth - 1;
  }

  function scrollByStep(direction: -1 | 1) {
    if (!viewSwitcherElement) return;
    const step = Math.max(viewSwitcherElement.clientWidth * 0.6, 120);
    viewSwitcherElement.scrollBy({ left: step * direction, behavior: "smooth" });
  }

  // Re-check indicators when views list changes, on scroll, and on resize.
  $: if (views) {
    // defer until Svelte has updated the DOM with the new buttons
    Promise.resolve().then(updateScrollIndicators);
  }

  // Observe container resize (panel width changes) to keep indicators in sync.
  let resizeObserver: ResizeObserver | null = null;
  $: if (viewSwitcherElement && typeof ResizeObserver !== "undefined") {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => updateScrollIndicators());
    resizeObserver.observe(viewSwitcherElement);
  }
  onDestroy(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
  });
  
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

<div class="view-switcher-container" class:can-scroll-left={canScrollLeft} class:can-scroll-right={canScrollRight}>
  {#if canScrollLeft && !$isTouchDevice}
    <button
      type="button"
      class="view-switcher-chevron view-switcher-chevron--left"
      on:click={() => scrollByStep(-1)}
      title={$i18n.t('common.scroll-left', { defaultValue: 'Scroll left' })}
      aria-label={$i18n.t('common.scroll-left', { defaultValue: 'Scroll left' })}
      tabindex="-1"
    >‹</button>
  {/if}
  <div
    class="view-switcher"
    role="tablist"
    aria-label={$i18n.t('common.view-switcher')}
    bind:this={viewSwitcherElement}
    on:wheel={handleWheel}
    on:scroll={updateScrollIndicators}
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
  {#if canScrollRight && !$isTouchDevice}
    <button
      type="button"
      class="view-switcher-chevron view-switcher-chevron--right"
      on:click={() => scrollByStep(1)}
      title={$i18n.t('common.scroll-right', { defaultValue: 'Scroll right' })}
      aria-label={$i18n.t('common.scroll-right', { defaultValue: 'Scroll right' })}
      tabindex="-1"
    >›</button>
  {/if}
</div>

<style>
  .view-switcher-container {
    position: relative;
    display: flex;
    align-items: stretch;
    min-width: 0;
  }

  /* Edge-fade masks indicate scrollable content on either side. */
  .view-switcher-container.can-scroll-left::before,
  .view-switcher-container.can-scroll-right::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1.5rem;
    pointer-events: none;
    z-index: 1;
  }
  .view-switcher-container.can-scroll-left::before {
    left: 0;
    background: linear-gradient(to right, var(--background-primary), transparent);
  }
  .view-switcher-container.can-scroll-right::after {
    right: 0;
    background: linear-gradient(to left, var(--background-primary), transparent);
  }

  .view-switcher-chevron {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 50%;
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.1);
  }
  .view-switcher-chevron:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  .view-switcher-chevron--left {
    left: 0.125rem;
  }
  .view-switcher-chevron--right {
    right: 0.125rem;
  }

  .view-switcher {
    display: flex;
    gap: var(--spacing-sm, 0.5rem);
    overflow-x: auto;
    flex: 1 1 auto;
    min-width: 0;
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
