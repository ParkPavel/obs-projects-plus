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
    gap: 6px;
    align-items: center;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: -0.01em;
    background: var(--background-secondary);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid transparent;
    -webkit-user-select: none;
    user-select: none;
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
    width: 14px;
    height: 14px;
  }
</style>
