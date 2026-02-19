<script lang="ts">
  import { Checkbox } from "obsidian-svelte";
  import ColorPill from "./ColorPill.svelte";
  import Ellipsis from "./Ellipsis.svelte";

  /**
   * Specifies an optional color of the calendar event.
   */
  export let color: string | null = null;

  /**
   * Specifies an optional checkbox.
   *
   * If undefined, no field has been set.
   * If null, field has been set, but note doesn't have the property.
   */
  export let checked: boolean | null | undefined = undefined;

  /**
   * Internal hover state.
   */
  let hover: boolean = false;
</script>

<div 
  class="calendar-event"
  on:mouseenter={() => (hover = true)} 
  on:mouseleave={() => (hover = false)}
>
  {#if color}
    <ColorPill {color} />
  {/if}

  {#if checked !== undefined && checked !== null}
    <Checkbox bind:checked on:check />
  {:else if checked === null && hover}
    <Checkbox checked={false} on:check />
  {/if}

  <Ellipsis>
    <slot />
  </Ellipsis>
</div>

<style>
  .calendar-event {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: -0.01em;
    background: var(--background-secondary);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1),
                border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
                transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid transparent;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .calendar-event:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .calendar-event:active {
    transform: translateY(0);
    box-shadow: none;
  }

  /* Remove default checkbox margin */
  .calendar-event :global(input[type="checkbox"]) {
    margin: 0;
    width: 0.875rem;
    height: 0.875rem;
  }

  /* Touch device: enlarge touch targets to 44px minimum */
  @media (pointer: coarse) {
    .calendar-event {
      min-height: 2.75rem;
      padding: 0.5rem 0.625rem;
      font-size: 0.8125rem;
    }

    .calendar-event :global(input[type="checkbox"]) {
      width: 1.25rem;
      height: 1.25rem;
    }
  }
</style>
