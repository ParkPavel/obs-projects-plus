<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { requestSaveRetry, saveStatus } from "src/lib/settings/saveStatus";
  import { resolveError } from "src/lib/errors/errorText";

  // #185 — visible only while the state it reports is real. `saving` is not
  // shown: a spinner on every keystroke is noise, and the silent retries are
  // deliberately invisible (most write failures are transient).
  $: failed = $saveStatus.kind === "failed";
  // #200 — the third standing state. It is NOT folded into `failed`, because
  // the mark's only action is a retry and a retry here is the overwrite of
  // somebody else's change: the same control would mean the opposite thing.
  $: diverged = $saveStatus.kind === "diverged";
  // #202 — the code comes from the status rather than being fixed here, so the
  // mark says whatever the writer actually reported. `$i18n` is read inside the
  // reactive statement so the cause follows a language change.
  $: resolved =
    $saveStatus.kind === "failed" || $saveStatus.kind === "diverged"
      ? resolveError($saveStatus.code)
      : { code: "", caption: "", cause: "" };
  // The cause is appended to the existing `title`, per SPEC 201 §4: the tooltip
  // mechanism does not change, only what fills it.
  $: tooltip = [
    $i18n.t(failed ? "save-status.failed.tooltip" : "save-status.diverged.tooltip"),
    resolved.cause,
  ]
    .filter((part) => part.length > 0)
    .join(" ");
</script>

{#if failed}
  <button
    class="save-status-chip"
    type="button"
    title={tooltip}
    on:click={() => requestSaveRetry()}
  >
    <span class="dot" aria-hidden="true"></span>
    <span class="label">{$i18n.t("save-status.failed.label")}</span>
    <span class="code">{resolved.code}</span>
  </button>
{:else if diverged}
  <!-- #200 — a mark, and this one really is not a button. There is no action
       to offer: the write already happened and the file no longer holds it, so
       a retry would overwrite the version that replaced ours. A disabled
       button would still say "there is something to press here"; a span says
       what is true, and the tooltip carries the explanation. -->
  <span class="save-status-chip is-diverged" title={tooltip}>
    <span class="dot" aria-hidden="true"></span>
    <span class="label">{$i18n.t("save-status.diverged.label")}</span>
    <span class="code">{resolved.code}</span>
  </span>
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
    white-space: nowrap;
    /* #202, from the audit: the mark grew a code and sat in a row that already
       carries the view switcher and three actions. Refusing to shrink there
       pushes the header into horizontal overflow on a narrow pane — a mark
       that reports a problem must not create a layout one. It gives up the
       label first (below) and never the code: the code is the part a user
       quotes, and the dot plus the error colour still say what state it is. */
    min-width: 0;
    flex-shrink: 1;
  }
  /* #200 — the diverged mark is a caution, not a failure, and it is inert. The
     colour follows that: the warning token instead of the error one, the
     default cursor instead of a pointer, and no hover or active tint, because
     there is nothing to press. Everything else — the hairline, the dot, the
     code slot — is deliberately identical, so the two states read as one
     family of mark rather than as two unrelated widgets. */
  .save-status-chip.is-diverged {
    border-color: var(--text-warning);
    color: var(--text-warning);
    cursor: default;
  }
  .save-status-chip.is-diverged .dot {
    background: var(--text-warning);
  }
  .save-status-chip:not(.is-diverged):hover {
    background: color-mix(in srgb, var(--text-error) 12%, transparent);
  }
  .save-status-chip:not(.is-diverged):active {
    background: color-mix(in srgb, var(--text-error) 20%, transparent);
  }
  .save-status-chip:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.125rem;
  }
  /* #202 — the code slot SPEC 201 §4 reserved. Tabular figures so the mark's
     width does not jitter as the number changes, and no colour of its own: a
     differently coloured token inside a coloured mark would be the same
     "colour inside a colour" mistake #201 removed, one scale down. Only the
     separator is dimmed, which is the low-emphasis idiom already in
     WidgetShell and AgendaSidebar. */
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .code {
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  /* Why truncation and not a container query hiding the label: nothing above
     this component declares `container-type`, so a `@container` rule here
     would never match — a dead rule that looks like a safeguard is worse than
     none. Making the navbar row a query container is a structural change to a
     shared row, which SPEC 201 §5 hands to an architect rather than to this
     fix. Truncation answers the overflow the audit actually found, with the
     code — the part a user quotes — never the part that is cut. */
  .code::before {
    content: "·";
    padding-right: 0.25rem;
    color: var(--text-faint);
  }
  .dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--text-error);
    flex-shrink: 0;
  }
</style>
