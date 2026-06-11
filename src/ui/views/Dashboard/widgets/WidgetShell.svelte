<script lang="ts">
  /**
   * WidgetShell — #067 F1 (UT2026-F).
   *
   * The frame every canvas widget lives in: host container, header
   * (collapse toggle, title, type badge, `actions` slot), `panels` slot
   * (config panels / pipeline editor), and the content area with
   * lazy-render skeleton (DG-9 IntersectionObserver) and scoped
   * resource-error capture. Owns NO widget semantics — collapse is the
   * only behavior it requests (via `toggleCollapse`), everything else is
   * slotted in by the host router.
   */
  import { createEventDispatcher, onMount } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { ariaWidget } from "src/lib/dashboard-engine/accessibility";

  export let widgetId: string;
  export let title: string;
  export let widgetType: string;
  export let collapsed = false;

  const dispatch = createEventDispatcher<{ toggleCollapse: void }>();

  $: widgetAria = ariaWidget(title);

  // DG-9: one-shot IntersectionObserver — renders skeleton until visible
  let hostEl: HTMLDivElement;
  let contentVisible = false;

  onMount(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          contentVisible = true;
          obs.disconnect();
        }
      },
      { threshold: 0 },
    );
    obs.observe(hostEl);
    return () => obs.disconnect();
  });

  let renderError: string | null = null;

  /** Capture unhandled resource errors scoped to this widget's DOM subtree */
  function captureErrors(node: HTMLElement) {
    function handleResourceError(e: Event) {
      // Capture-phase listener: resource errors (img, script) do not bubble.
      if (e.target instanceof HTMLElement && node.contains(e.target)) {
        renderError = `Failed to load: ${(e.target as HTMLElement).tagName.toLowerCase()}`;
      }
    }
    node.addEventListener("error", handleResourceError, true);
    return {
      destroy() {
        node.removeEventListener("error", handleResourceError, true);
      },
    };
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div
  class="ppp-widget-host"
  class:ppp-widget-host--collapsed={collapsed}
  bind:this={hostEl}
  role={widgetAria.role}
  aria-labelledby={`ppp-widget-title-${widgetId}`}
  tabindex={widgetAria.tabindex}
>
  <div class="ppp-widget-header">
    <button
      class="ppp-widget-collapse-btn clickable-icon"
      on:click={() => dispatch("toggleCollapse")}
      aria-label={collapsed ? $i18n.t("views.dashboard.widget.expand") : $i18n.t("views.dashboard.widget.collapse")}
      aria-expanded={!collapsed}
    >
      {collapsed ? "›" : "‹"}
    </button>
    <span id={`ppp-widget-title-${widgetId}`} class="ppp-widget-title">{title}</span>
    <span class="ppp-widget-type-badge" aria-hidden="true">({widgetType})</span>
    <slot name="actions" />
  </div>

  <slot name="panels" />

  {#if !collapsed}
    <div class="ppp-widget-content" use:captureErrors>
      {#if !contentVisible}
        <div class="ppp-widget-skeleton" aria-hidden="true"></div>
      {:else if renderError}
        <div class="ppp-widget-error">
          <span class="ppp-widget-error-icon"><Icon name="alert-triangle" size="sm" /></span>
          <span>{renderError}</span>
          <button class="ppp-widget-error-retry" on:click={() => { renderError = null; }}>
            {$i18n.t("common.retry", { defaultValue: "Retry" })}
          </button>
        </div>
      {:else}
        <slot />
      {/if}
    </div>
  {/if}
</div>

<style>
  .ppp-widget-host {
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    background: var(--background-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    /* Matryoshka: each widget is a container context for its children */
    container-type: inline-size;
    container-name: widget;
    transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
  }

  .ppp-widget-host--collapsed {
    min-height: auto;
  }

  .ppp-widget-header {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-sm, 0.25rem);
    padding: var(--ppp-space-sm, 0.25rem) var(--ppp-space-md, 0.5rem);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
    user-select: none;
    min-height: 2.25rem;
  }

  .ppp-widget-collapse-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-s, 0.25rem);
    transition: transform var(--ppp-duration-normal, 0.15s) ease, color var(--ppp-duration-normal, 0.15s) ease;
  }

  .ppp-widget-host--collapsed .ppp-widget-collapse-btn {
    transform: rotate(-90deg);
  }

  .ppp-widget-collapse-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-widget-title {
    font-weight: var(--font-semibold, 600);
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-widget-type-badge {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--ppp-duration-normal, 0.15s) ease;
  }

  .ppp-widget-header:hover .ppp-widget-type-badge {
    opacity: 1;
  }

  @media (pointer: coarse) {
    .ppp-widget-type-badge {
      opacity: 1;
    }
  }

  .ppp-widget-content {
    flex: 1;
    overflow: auto;
  }

  /* Placeholder is rendered by the host router inside the default slot —
     style lives here so the shell owns the widget frame vocabulary. */
  .ppp-widget-content :global(.ppp-widget-placeholder) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ppp-space-xl, 1.5rem);
    color: var(--text-faint);
    font-style: italic;
  }

  .ppp-widget-error {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-sm, 0.25rem);
    padding: var(--ppp-space-md, 0.5rem) var(--ppp-space-lg, 1rem);
    background: var(--background-modifier-error-rgb, rgba(255, 0, 0, 0.05));
    border-left: 0.1875rem solid var(--text-error);
    color: var(--text-error);
    font-size: var(--font-ui-small);
  }

  .ppp-widget-error-icon {
    flex-shrink: 0;
  }

  .ppp-widget-error-retry {
    margin-left: auto;
    padding: 0.15rem 0.5rem;
    border: 0.0625rem solid var(--text-error);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-error);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
  }

  .ppp-widget-error-retry:hover {
    background: var(--text-error);
    color: var(--background-primary);
  }

  /* DG-9 lazy-render skeleton */
  .ppp-widget-skeleton {
    flex: 1;
    min-height: 4rem;
    background: linear-gradient(
      90deg,
      var(--background-modifier-border) 25%,
      var(--background-secondary-alt, var(--background-secondary)) 50%,
      var(--background-modifier-border) 75%
    );
    background-size: 200% 100%;
    animation: ppp-shimmer 1.4s infinite linear;
    border-radius: var(--radius-s, 0.25rem);
  }

  @keyframes ppp-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
