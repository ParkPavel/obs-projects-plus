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
  /* #201 — a mark, not a button.
     It used to paint `--background-modifier-error-hover` (Obsidian's saturated
     error fill) under `--text-error` (its saturated error foreground): red on
     red, and a live run showed the result as a solid red rectangle with no
     legible text at all. Every other `--text-error` in this tree sits on the
     ambient surface or on a faint tint of itself; this was the one place that
     put it on a second red.
     So: no fill at rest, a hairline in the text's own colour, and a hover tint
     mixed FROM that colour — derived, so it cannot drift into the same
     lightness band as the text the way two independent error tokens can.
     It stays a real <button>: focus, Enter and Space come free with the
     element, and the retry it triggers is the only way back from a failed
     write. "Not a button" is about shape, not about operability. */
  .save-status-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem;
    border: 0.0625rem solid var(--text-error);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    line-height: 1.4;
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .save-status-chip:hover {
    background: color-mix(in srgb, var(--text-error) 12%, transparent);
  }
  .save-status-chip:active {
    background: color-mix(in srgb, var(--text-error) 20%, transparent);
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
