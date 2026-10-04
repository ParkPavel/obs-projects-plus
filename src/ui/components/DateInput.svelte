<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import dayjs from "dayjs";
  import { i18n } from '../../lib/stores/i18n';

  /**
   * Specifies the date value.
   */
  export let value: Date | null;

  /**
   * Specifies whether to remove decorations so that it can be embedded in other
   * components.
   */
  export let embed: boolean = false;

  /**
   * Specifies whether the input rejects edits — the peek's read-only path
   * (#158 C1/C3) has no other way to stop a native date picker from writing.
   */
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    change: Date | null;
    input: Date | null;
  }>();

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
</script>

<input
  type="date"
  class:embed
  value={value ? dayjs(value).format("YYYY-MM-DD") : null}
  max="9999-12-31"
  placeholder={$i18n.t('common.date-placeholder')}
  title={$i18n.t('common.select-date')}
  disabled={disabled}
  on:change={handleChange}
  on:input={handleInput}
  on:blur
/>

<style>
  input {
    border-radius: var(--ppp-radius-xl);
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    background-color: var(--background-primary);
    font-family: var(--font-default);
    padding: var(--ppp-padding-sm) var(--ppp-padding-md);
    color: var(--text-normal);
    font-size: var(--ppp-font-size-base);
    cursor: pointer;
    transition: all var(--ppp-duration-normal) var(--ppp-ease-out);
    width: 100%;
  }

  input:hover {
    background-color: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 0.125rem var(--interactive-accent-hover);
  }

  .embed {
    margin: 0 0.5rem;
  }
</style>
