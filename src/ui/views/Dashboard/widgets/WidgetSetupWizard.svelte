<script lang="ts">
  /**
   * WidgetSetupWizard — #067 F1. Zero-config prompt for widgets that need
   * configuration before first render (chart, stats). Dispatches
   * `configure`; the host seeds defaults and opens the config panel.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let icon: string;
  export let message: string;

  const dispatch = createEventDispatcher<{ configure: void }>();
</script>

<div class="ppp-widget-setup-wizard">
  <span class="ppp-widget-setup-icon"><Icon name={icon} size="lg" /></span>
  <span>{message}</span>
  <button class="ppp-widget-setup-btn" on:click={() => dispatch("configure")}>
    {$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure" })}
  </button>
</div>

<style>
  .ppp-widget-setup-wizard {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--ppp-space-sm, 0.25rem);
    padding: var(--ppp-space-xl, 1.5rem);
    color: var(--text-muted);
  }

  .ppp-widget-setup-icon {
    font-size: 1.5rem;
  }

  .ppp-widget-setup-btn {
    margin-top: var(--ppp-space-sm, 0.25rem);
    padding: 0.25rem 0.75rem;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--interactive-accent);
    cursor: pointer;
    font-size: var(--font-ui-small);
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-widget-setup-btn:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
</style>
