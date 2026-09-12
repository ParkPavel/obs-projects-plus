<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { requestSaveRetry, saveStatus } from "src/lib/settings/saveStatus";

  // #185 — visible only while the state it reports is real. `saving` is not
  // shown: a spinner on every keystroke is noise, and the silent retries are
  // deliberately invisible (most write failures are transient).
  $: failed = $saveStatus.kind === "failed";
</script>

{#if failed}
  <button
    class="save-status-chip"
    type="button"
    title={$i18n.t("save-status.failed.tooltip")}
    on:click={() => requestSaveRetry()}
  >
    <span class="dot" aria-hidden="true"></span>
    <span class="label">{$i18n.t("save-status.failed.label")}</span>
  </button>
{/if}

<style>
  /* A standing mark, not a toast: the state it reports is standing too, and a
     Notice that has faded leaves the user in exactly today's silence. */
  .save-status-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem;
    border: 0.0625rem solid var(--background-modifier-error);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-modifier-error-hover, var(--background-secondary-alt));
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    line-height: 1.4;
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .save-status-chip:hover {
    background: var(--background-modifier-error);
  }
  .save-status-chip:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.125rem;
  }
  .dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--text-error);
    flex-shrink: 0;
  }
</style>
