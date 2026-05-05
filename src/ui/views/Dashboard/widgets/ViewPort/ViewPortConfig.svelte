<script lang="ts">
  /**
   * ViewPortConfig — cog-opened panel for the `view-port` widget.
   * Closes Pillar 4 (INTERFACE RECLAMATION) gap: previously this widget
   * had no cog at all. Controls: embedded view picker (reuses
   * ViewPortSelector), editable label override, header visibility toggle.
   */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import WidgetConfigShell from "../_shared/WidgetConfigShell.svelte";
  import ViewPortSelector from "./ViewPortSelector.svelte";

  export let config: Record<string, unknown> = {};

  const dispatch = createEventDispatcher<{
    change: Record<string, unknown>;
    close: void;
  }>();

  $: viewId = String(config["viewId"] ?? "");
  $: viewLabel = String(config["viewLabel"] ?? "");
  $: headerVisible = config["headerVisible"] !== false;

  let showSelector = false;

  function emit(patch: Record<string, unknown>) {
    dispatch("change", { ...config, ...patch });
  }

  function handleViewSelect(e: CustomEvent<{ id: string; label: string }>) {
    showSelector = false;
    emit({ viewId: e.detail.id, viewLabel: e.detail.label });
  }

  function onLabelInput(e: Event) {
    emit({ viewLabel: (e.currentTarget as HTMLInputElement).value });
  }

  function onHeaderToggle(e: Event) {
    emit({ headerVisible: (e.currentTarget as HTMLInputElement).checked });
  }
</script>

<WidgetConfigShell
  title={$i18n.t("views.dashboard.viewport.config.title", { defaultValue: "Embedded view" })}
  subtitle={$i18n.t("views.dashboard.viewport.config.subtitle", { defaultValue: "Pick which saved view renders inside this widget." })}
  on:close={() => dispatch("close")}
>
  <div class="ppp-cfg-list">
    <div class="ppp-cfg-item">
      <label class="ppp-viewport-config__field">
        {$i18n.t("views.dashboard.viewport.config.view", { defaultValue: "View" })}
        <div class="ppp-viewport-config__picker">
          <button
            type="button"
            class="ppp-viewport-config__picker-btn"
            on:click={() => (showSelector = !showSelector)}
          >
            {viewId
              ? (viewLabel || viewId)
              : $i18n.t("views.dashboard.viewport.select", { defaultValue: "Pick a view…" })}
            <span aria-hidden="true">▾</span>
          </button>
          {#if showSelector}
            <ViewPortSelector on:select={handleViewSelect} />
          {/if}
        </div>
      </label>
    </div>

    <div class="ppp-cfg-item">
      <label class="ppp-viewport-config__field">
        {$i18n.t("views.dashboard.viewport.config.label", { defaultValue: "Label override" })}
        <input
          type="text"
          value={viewLabel}
          placeholder={$i18n.t("views.dashboard.viewport.config.label-placeholder", { defaultValue: "Shown in widget header" })}
          on:input={onLabelInput}
        />
      </label>
    </div>

    <div class="ppp-cfg-item">
      <label class="ppp-viewport-config__toggle">
        <input type="checkbox" checked={headerVisible} on:change={onHeaderToggle} />
        <span>{$i18n.t("views.dashboard.viewport.config.header-visible", { defaultValue: "Show inline header" })}</span>
      </label>
    </div>
  </div>
</WidgetConfigShell>

<style>
  .ppp-viewport-config__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  .ppp-viewport-config__field input[type="text"] {
    width: 100%;
  }

  .ppp-viewport-config__picker {
    position: relative;
  }

  .ppp-viewport-config__picker-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: var(--font-ui-small);
  }

  .ppp-viewport-config__toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    cursor: pointer;
  }
</style>
