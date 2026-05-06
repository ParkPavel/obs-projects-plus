<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher, tick } from "svelte";

  export let show: boolean;

  let cancelBtn: HTMLButtonElement | null = null;

  $: if (show) {
    tick().then(() => cancelBtn?.focus());
  }

  const dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
  }>();
</script>

{#if show}
  <div
    class="ppp-template-confirm-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ppp-template-confirm-title"
    aria-describedby="ppp-template-confirm-desc"
    on:click|self={() => dispatch("cancel")}
    on:keydown={(e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dispatch("cancel");
      }
    }}
  >
    <div class="ppp-template-confirm">
      <h3 id="ppp-template-confirm-title">{$i18n.t("views.dashboard.canvas.template-replace-title", { defaultValue: "Replace current layout?" })}</h3>
      <p id="ppp-template-confirm-desc">{$i18n.t("views.dashboard.canvas.template-replace-confirm", { defaultValue: "Applying a template will replace current widgets. Continue?" })}</p>
      <div class="ppp-template-confirm-actions">
        <button class="ppp-btn ppp-btn--secondary" bind:this={cancelBtn} on:click={() => dispatch("cancel")}>
          {$i18n.t("views.dashboard.canvas.template-replace-cancel", { defaultValue: "Cancel" })}
        </button>
        <button class="ppp-btn ppp-btn--danger" on:click={() => dispatch("confirm")}>
          {$i18n.t("views.dashboard.canvas.template-replace-apply", { defaultValue: "Apply template" })}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .ppp-template-confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-popover, 30);
  }

  .ppp-template-confirm {
    width: min(28rem, calc(100vw - 2rem));
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    box-shadow: var(--shadow-l);
    padding: 0.875rem;
  }

  .ppp-template-confirm h3 {
    margin: 0 0 0.375rem;
    font-size: var(--font-ui-medium);
    color: var(--text-normal);
  }

  .ppp-template-confirm p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .ppp-template-confirm-actions {
    margin-top: 0.75rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
