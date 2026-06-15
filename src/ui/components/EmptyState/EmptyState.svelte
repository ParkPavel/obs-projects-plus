<script lang="ts">
  /**
   * EmptyState — shared zero-state surface (#065, M-VISION-PARITY).
   *
   * One visual language for every "nothing here yet" moment: empty canvas,
   * empty table, empty filter result. Consumers slot CTA buttons into
   * `actions`; the base button styling is provided here so all empty-state
   * CTAs look identical without per-consumer CSS.
   */
  import { Icon } from "obsidian-svelte";

  export let icon = "inbox";
  export let title: string;
  export let hint = "";
</script>

<div class="ppp-empty-state" role="status">
  <span class="ppp-empty-state-icon"><Icon name={icon} /></span>
  <span class="ppp-empty-state-title">{title}</span>
  {#if hint}
    <span class="ppp-empty-state-hint">{hint}</span>
  {/if}
  {#if $$slots.actions}
    <div class="ppp-empty-state-actions">
      <slot name="actions" />
    </div>
  {/if}
</div>

<style>
  .ppp-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--ppp-space-3, 0.375rem);
    padding: var(--ppp-space-8, 2rem) var(--ppp-space-4, 0.5rem);
    color: var(--text-faint);
    text-align: center;
  }

  .ppp-empty-state-icon {
    color: var(--text-faint);
    opacity: 0.6;
  }

  .ppp-empty-state-icon :global(svg) {
    width: 2rem;
    height: 2rem;
  }

  .ppp-empty-state-title {
    font-size: var(--ppp-font-size-base, 0.875rem);
    font-weight: var(--ppp-font-weight-medium, 500);
    color: var(--text-muted);
  }

  .ppp-empty-state-hint {
    font-size: var(--ppp-font-size-sm, 0.75rem);
    color: var(--text-faint);
    max-width: 20rem;
  }

  .ppp-empty-state-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--ppp-space-2, 0.25rem);
    margin-top: var(--ppp-space-2, 0.25rem);
  }

  .ppp-empty-state-actions :global(button) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    font-size: var(--font-ui-small);
    color: var(--interactive-accent);
    background: transparent;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-empty-state-actions :global(button:hover) {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-empty-state-actions :global(button:focus-visible) {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }
</style>
