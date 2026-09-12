<script lang="ts">
  /**
   * Unified configuration panel shell for every Database widget.
   * Enforces consistent chrome: title, close, content area, footer slot.
   * Use container queries — all internal layout in rem, Zero-Pixels regulation.
   */
  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher } from "svelte";

  export let title: string;
  export let subtitle: string | null = null;
  export let dirty: boolean = false;

  const dispatch = createEventDispatcher<{ close: void }>();
</script>

<section
  class="ppp-widget-config"
  aria-label={title}
>
  <header class="ppp-widget-config__header">
    <div class="ppp-widget-config__titles">
      <h3 class="ppp-widget-config__title">{title}</h3>
      {#if subtitle}
        <p class="ppp-widget-config__subtitle">{subtitle}</p>
      {/if}
    </div>

    {#if dirty}
      <span class="ppp-widget-config__dirty" aria-live="polite">
        ● {$i18n.t("views.dashboard.widget.config.dirty", { defaultValue: "Unsaved" })}
      </span>
    {/if}

    <button
      type="button"
      class="ppp-widget-config__close clickable-icon"
      on:click={() => dispatch("close")}
      aria-label={$i18n.t("common.close", { defaultValue: "Close" })}
      title={$i18n.t("common.close", { defaultValue: "Close" })}
    >✕</button>
  </header>

  <div class="ppp-widget-config__body">
    <slot />
  </div>

  {#if $$slots.footer}
    <footer class="ppp-widget-config__footer">
      <slot name="footer" />
    </footer>
  {/if}
</section>

<style>
  .ppp-widget-config {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    margin: 0.375rem 0.5rem;
    background: var(--background-secondary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    container-type: inline-size;
    container-name: widget-config;
  }

  .ppp-widget-config__header {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .ppp-widget-config__titles {
    flex: 1;
    min-width: 0;
  }

  .ppp-widget-config__title {
    margin: 0;
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-normal);
    line-height: 1.2;
  }

  .ppp-widget-config__subtitle {
    margin: 0.125rem 0 0 0;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
    line-height: 1.35;
  }

  .ppp-widget-config__dirty {
    align-self: center;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-accent);
    white-space: nowrap;
  }

  .ppp-widget-config__close {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.8rem;
    border-radius: var(--radius-s, 0.25rem);
    transition: color 0.15s ease, background 0.15s ease;
  }
  .ppp-widget-config__close:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-widget-config__body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ppp-widget-config__footer {
    display: flex;
    gap: 0.375rem;
    justify-content: flex-end;
    padding-top: 0.375rem;
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  /* Narrow widget: stack header */
  @container widget-config (max-width: 22rem) {
    .ppp-widget-config__header {
      flex-wrap: wrap;
    }
  }

  /* Shared form primitives used inside the body slot */
  :global(.ppp-widget-config__body .ppp-cfg-row) {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  :global(.ppp-widget-config__body .ppp-cfg-row label) {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1 1 10rem;
    min-width: 8rem;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
  }
  :global(.ppp-widget-config__body .ppp-cfg-row input[type="text"]),
  :global(.ppp-widget-config__body .ppp-cfg-row input[type="number"]),
  :global(.ppp-widget-config__body .ppp-cfg-row select) {
    width: 100%;
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-small);
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    color: var(--text-normal);
  }
  :global(.ppp-widget-config__body .ppp-cfg-list) {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  :global(.ppp-widget-config__body .ppp-cfg-item) {
    display: flex;
    gap: 0.375rem;
    align-items: flex-end;
    padding: 0.375rem;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
  }
  :global(.ppp-widget-config__body .ppp-cfg-item > label) {
    flex: 1 1 0;
    min-width: 5rem;
  }
  :global(.ppp-widget-config__body .ppp-cfg-item .ppp-cfg-remove) {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }
  :global(.ppp-widget-config__body .ppp-cfg-item .ppp-cfg-remove:hover) {
    color: var(--text-error, var(--text-normal));
    background: var(--background-modifier-error-hover, var(--background-modifier-hover));
  }
  :global(.ppp-widget-config__body .ppp-cfg-add) {
    align-self: flex-start;
    padding: 0.25rem 0.5rem;
    font-size: var(--font-ui-small);
    background: var(--interactive-normal);
    color: var(--text-normal);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }
  :global(.ppp-widget-config__body .ppp-cfg-add:hover) {
    background: var(--interactive-hover);
  }

  /* Narrow container: stack cfg-items vertically */
  @container widget-config (max-width: 22rem) {
    :global(.ppp-widget-config__body .ppp-cfg-item) {
      flex-direction: column;
      align-items: stretch;
    }
    :global(.ppp-widget-config__body .ppp-cfg-item > label) {
      width: 100%;
    }
  }
</style>
