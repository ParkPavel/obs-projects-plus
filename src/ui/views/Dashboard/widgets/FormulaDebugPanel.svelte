<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let message: string = "";
  export let cursorPosition: number = -1;
  export let expression: string = "";

  let expanded = true;

  const dispatch = createEventDispatcher<{ dismiss: void }>();

  async function copyError() {
    const payload = [
      `message: ${message}`,
      cursorPosition >= 0 ? `cursor: ${cursorPosition}` : null,
      expression ? `expression: ${expression}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
      }
    } catch {
      // best-effort copy; silently ignore if clipboard unavailable (mobile sandbox, etc.)
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      dispatch("dismiss");
    }
  }
</script>

<div
  class="ppp-formula-debug"
  role="region"
  aria-label={$i18n.t("views.dashboard.formula.debug-title")}
  on:keydown={handleKey}
>
  <div class="ppp-formula-debug-header">
    <button
      class="ppp-formula-debug-toggle"
      type="button"
      aria-expanded={expanded}
      on:click={() => (expanded = !expanded)}
    >
      <span class="ppp-formula-debug-caret" class:ppp-formula-debug-caret--open={expanded}>?</span>
      <span class="ppp-formula-debug-title">
        {$i18n.t("views.dashboard.formula.debug-title")} — {$i18n.t("views.dashboard.formula.runtime-error")}
      </span>
    </button>
    <div class="ppp-formula-debug-actions">
      <button class="ppp-formula-debug-btn" type="button" on:click={copyError}>
        {$i18n.t("views.dashboard.formula.debug-copy")}
      </button>
      <button
        class="ppp-formula-debug-btn"
        type="button"
        on:click={() => dispatch("dismiss")}
      >
        {$i18n.t("views.dashboard.formula.debug-dismiss")}
      </button>
    </div>
  </div>
  {#if expanded}
    <div class="ppp-formula-debug-body">
      <pre class="ppp-formula-debug-message">{message}</pre>
      {#if cursorPosition >= 0}
        <div class="ppp-formula-debug-cursor">
          {$i18n.t("views.dashboard.formula.debug-cursor")}: {cursorPosition}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ppp-formula-debug {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--text-error);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-secondary);
  }

  .ppp-formula-debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.5rem;
    gap: 0.5rem;
  }

  .ppp-formula-debug-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: none;
    background: none;
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }

  .ppp-formula-debug-caret {
    display: inline-block;
    transition: transform 0.15s;
  }

  .ppp-formula-debug-caret--open {
    transform: rotate(90deg);
  }

  .ppp-formula-debug-title {
    text-transform: none;
  }

  .ppp-formula-debug-actions {
    display: inline-flex;
    gap: 0.25rem;
  }

  .ppp-formula-debug-btn {
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .ppp-formula-debug-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-formula-debug-body {
    padding: 0.375rem 0.5rem;
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ppp-formula-debug-message {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    color: var(--text-error);
  }

  .ppp-formula-debug-cursor {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }
</style>
