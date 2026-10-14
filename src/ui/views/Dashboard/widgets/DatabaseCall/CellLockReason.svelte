<script lang="ts">
  /**
   * B3: why a cell does not edit — a lock and one sentence, shown on focus or
   * tap («Формула — вычисляется», «Роллап из «Клиенты»», …).
   */
  import { Icon } from "obsidian-svelte";

  export let text: string;
</script>

<span class="ppp-t2-lock" aria-hidden="true"><Icon name="lock" size="sm" /></span>
<span class="ppp-t2-reason" role="tooltip">{text}</span>

<style>
  .ppp-t2-lock {
    display: inline-flex;
    flex-shrink: 0;
    margin-left: auto;
    color: var(--text-faint);
  }

  .ppp-t2-reason {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: var(--ppp-z-dropdown);
    max-width: 18em;
    padding: 0.25em 0.5em;
    border: 0.0625em solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    box-shadow: var(--ppp-shadow-md);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    white-space: normal;
  }
</style>
