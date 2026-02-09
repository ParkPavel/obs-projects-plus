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
  on:change={handleChange}
  on:input={handleInput}
  on:blur
/>

<style>
  input {
    border-radius: var(--ppp-radius-xl);
    border: 1px solid var(--background-modifier-border);
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
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .embed {
    margin: 0 8px;
  }
</style>
