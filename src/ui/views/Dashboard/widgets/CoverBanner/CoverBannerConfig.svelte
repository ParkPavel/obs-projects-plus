<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { CoverBannerConfig } from "../../types";

  export let config: Record<string, unknown>;

  const dispatch = createEventDispatcher<{ change: Record<string, unknown>; close: void }>();

  $: cfg = config as unknown as CoverBannerConfig;

  function update(patch: Partial<CoverBannerConfig>) {
    dispatch("change", { ...cfg, ...patch } as unknown as Record<string, unknown>);
  }

  function handleWidthModeChange(e: Event) {
    update({ widthMode: (e.currentTarget as HTMLSelectElement).value as "full" | "half" | "custom" });
  }

  function handleFitStyleChange(e: Event) {
    update({ fitStyle: (e.currentTarget as HTMLSelectElement).value as "cover" | "contain" });
  }

  function handlePositionChange(e: Event) {
    update({ position: (e.currentTarget as HTMLSelectElement).value as "top" | "center" | "bottom" });
  }

  function handleOverlayChange(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    if (v) {
      update({ overlay: v });
    } else {
      const { overlay: _o, ...rest } = cfg;
      dispatch("change", rest as unknown as Record<string, unknown>);
    }
  }
</script>

<div class="ppp-cb-cfg">
  <div class="ppp-cb-cfg-row">
    <label for="cb-src">{$i18n.t("views.dashboard.cover-banner-config.src", { defaultValue: "Image source" })}</label>
    <input
      id="cb-src"
      type="text"
      placeholder={$i18n.t("views.dashboard.cover-banner-config.src-placeholder", { defaultValue: "vault path or URL" })}
      value={cfg.src ?? ""}
      on:change={(e) => update({ src: e.currentTarget.value })}
    />
  </div>

  <div class="ppp-cb-cfg-row">
    <label for="cb-width">{$i18n.t("views.dashboard.cover-banner-config.width", { defaultValue: "Width" })}</label>
    <select
      id="cb-width"
      value={cfg.widthMode ?? "full"}
      on:change={handleWidthModeChange}
    >
      <option value="full">{$i18n.t("views.dashboard.cover-banner-config.width-full", { defaultValue: "Full" })}</option>
      <option value="half">{$i18n.t("views.dashboard.cover-banner-config.width-half", { defaultValue: "Half" })}</option>
      <option value="custom">{$i18n.t("views.dashboard.cover-banner-config.width-custom", { defaultValue: "Custom" })}</option>
    </select>
  </div>

  {#if cfg.widthMode === "custom"}
    <div class="ppp-cb-cfg-row">
      <label for="cb-widthrem">{$i18n.t("views.dashboard.cover-banner-config.width-rem", { defaultValue: "Width (rem)" })}</label>
      <input
        id="cb-widthrem"
        type="number"
        min="4"
        step="1"
        value={cfg.widthRem ?? 32}
        on:change={(e) => update({ widthRem: Number(e.currentTarget.value) || 32 })}
      />
    </div>
  {/if}

  <div class="ppp-cb-cfg-row">
    <label for="cb-fit">{$i18n.t("views.dashboard.cover-banner-config.fit", { defaultValue: "Fit" })}</label>
    <select
      id="cb-fit"
      value={cfg.fitStyle ?? "cover"}
      on:change={handleFitStyleChange}
    >
      <option value="cover">{$i18n.t("views.dashboard.cover-banner-config.fit-cover", { defaultValue: "Cover" })}</option>
      <option value="contain">{$i18n.t("views.dashboard.cover-banner-config.fit-contain", { defaultValue: "Contain" })}</option>
    </select>
  </div>

  <div class="ppp-cb-cfg-row">
    <label for="cb-pos">{$i18n.t("views.dashboard.cover-banner-config.position", { defaultValue: "Position" })}</label>
    <select
      id="cb-pos"
      value={cfg.position ?? "center"}
      on:change={handlePositionChange}
    >
      <option value="top">{$i18n.t("views.dashboard.cover-banner-config.position-top", { defaultValue: "Top" })}</option>
      <option value="center">{$i18n.t("views.dashboard.cover-banner-config.position-center", { defaultValue: "Center" })}</option>
      <option value="bottom">{$i18n.t("views.dashboard.cover-banner-config.position-bottom", { defaultValue: "Bottom" })}</option>
    </select>
  </div>

  <div class="ppp-cb-cfg-row">
    <label for="cb-overlay">{$i18n.t("views.dashboard.cover-banner-config.overlay", { defaultValue: "Overlay caption" })}</label>
    <input
      id="cb-overlay"
      type="text"
      placeholder={$i18n.t("views.dashboard.cover-banner-config.overlay-placeholder", { defaultValue: "optional" })}
      value={cfg.overlay ?? ""}
      on:change={handleOverlayChange}
    />
  </div>

  <div class="ppp-cb-cfg-actions">
    <button class="mod-cta" on:click={() => dispatch("close")}>
      {$i18n.t("views.dashboard.cover-banner-config.done", { defaultValue: "Done" })}
    </button>
  </div>
</div>

<style>
  .ppp-cb-cfg {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .ppp-cb-cfg-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ppp-cb-cfg-row label {
    width: 8rem;
    flex-shrink: 0;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  .ppp-cb-cfg-row input,
  .ppp-cb-cfg-row select {
    flex: 1;
    font-size: var(--font-ui-small);
  }

  .ppp-cb-cfg-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }
</style>
