<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import dayjs from "dayjs";
  import { Icon } from "obsidian-svelte";
  import { i18n } from '../../lib/stores/i18n';
  import { TimePicker } from "src/ui/components/TimePicker";

  /**
   * Specifies the date time value.
   */
  export let value: Date | null;

  /**
   * Specifies whether to remove decorations so that it can be embedded in other
   * components.
   */
  export let embed: boolean = false;

  const dispatch = createEventDispatcher<{
    change: Date | null;
    input: Date | null;
  }>();

  let showTimePicker = false;

  function handleChange(event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) {
      dispatch(
        "change",
        event.currentTarget.value
          ? dayjs(event.currentTarget.value).toDate()
          : null
      );
    }
  }

  function handleInput(event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) {
      dispatch(
        "input",
        event.currentTarget.value
          ? dayjs(event.currentTarget.value).toDate()
          : null
      );
    }
  }

  function handleTimePickerChange(event: CustomEvent<string>) {
    if (value) {
      const parts = event.detail.split(':');
      const hours = parseInt(parts[0] || '0', 10);
      const minutes = parseInt(parts[1] || '0', 10);
      
      if (!isNaN(hours) && !isNaN(minutes)) {
        const newDate = dayjs(value).hour(hours).minute(minutes).toDate();
        dispatch("change", newDate);
        dispatch("input", newDate);
      }
    }
    showTimePicker = false;
  }
</script>

<div class="datetime-input-wrapper">
  <input
    type="datetime-local"
    class:embed
    value={value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : null}
    max="9999-12-31T23:59"
    placeholder={$i18n.t('common.datetime-placeholder')}
    title={$i18n.t('common.select-date-time')}
    on:change={handleChange}
    on:input={handleInput}
    on:blur
  />
  <button 
    class="time-picker-toggle"
    on:click={() => showTimePicker = !showTimePicker}
    aria-label="Open time picker"
    title="Visual time picker"
  >
    <Icon name="clock" size="sm" />
  </button>
  
  {#if showTimePicker}
    <div class="time-picker-dropdown">
      <TimePicker 
        value={value ? dayjs(value).format("HH:mm") : "12:00"}
        on:change={handleTimePickerChange}
      />
    </div>
  {/if}
</div>

<style>
  .datetime-input-wrapper {
    position: relative;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  input {
    flex: 1;
    border-radius: var(--ppp-radius-xl);
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
    font-family: var(--font-default);
    padding: var(--ppp-padding-sm) var(--ppp-padding-md);
    color: var(--text-normal);
    font-size: var(--ppp-font-size-base);
    cursor: pointer;
    transition: all var(--ppp-duration-normal) var(--ppp-ease-out);
  }

  input:hover {
    background-color: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .embed {
    margin: 0 8px;
  }
  
  .time-picker-toggle {
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .time-picker-toggle:hover {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .time-picker-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    z-index: 100;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
</style>
