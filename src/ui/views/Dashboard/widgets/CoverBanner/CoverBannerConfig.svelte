<script lang="ts">
  import { createEventDispatcher } from "svelte";
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
    <label for="cb-src">Image source</label>
    <input
      id="cb-src"
      type="text"
      placeholder="vault path or URL"
      value={cfg.src ?? ""}
      on:change={(e) => update({ src: e.currentTarget.value })}
    />
  </div>

  <div class="ppp-cb-cfg-row">
    <label for="cb-width">Width</label>
    <select
      id="cb-width"
      value={cfg.widthMode ?? "full"}
      on:change={handleWidthModeChange}
    >
      <option value="full">Full</option>
      <option value="half">Half</option>
      <option value="custom">Custom</option>
    </select>
  </div>

  {#if cfg.widthMode === "custom"}
    <div class="ppp-cb-cfg-row">
      <label for="cb-widthrem">Width (rem)</label>
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
    <label for="cb-fit">Fit</label>
    <select
      id="cb-fit"
      value={cfg.fitStyle ?? "cover"}
      on:change={handleFitStyleChange}
    >
      <option value="cover">Cover</option>
      <option value="contain">Contain</option>
    </select>
  </div>

  <div class="ppp-cb-cfg-row">
    <label for="cb-pos">Position</label>
    <select
      id="cb-pos"
      value={cfg.position ?? "center"}
      on:change={handlePositionChange}
    >
      <option value="top">Top</option>
      <option value="center">Center</option>
      <option value="bottom">Bottom</option>
    </select>
  </div>

  <div class="ppp-cb-cfg-row">
    <label for="cb-overlay">Overlay caption</label>
    <input
      id="cb-overlay"
      type="text"
      placeholder="optional"
      value={cfg.overlay ?? ""}
      on:change={handleOverlayChange}
    />
  </div>

  <div class="ppp-cb-cfg-actions">
    <button class="mod-cta" on:click={() => dispatch("close")}>Done</button>
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
