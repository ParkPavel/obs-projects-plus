<script lang="ts">
  import { app } from "src/lib/stores/obsidian";
  import type { CoverBannerConfig } from "../../types";

  export let config: Record<string, unknown>;

  $: cfg = config as unknown as CoverBannerConfig;
  $: src = (cfg?.src ?? "").trim();
  $: fitStyle = cfg?.fitStyle ?? "cover";
  $: position = cfg?.position ?? "center";
  $: overlay = cfg?.overlay ?? "";
  $: widthMode = cfg?.widthMode ?? "full";
  $: widthRem = cfg?.widthRem ?? 32;

  $: widthStyle =
    widthMode === "full"
      ? "100%"
      : widthMode === "half"
        ? "50%"
        : `${widthRem}rem`;

  $: resolvedSrc = src ? resolveSrc(src) : "";

  function resolveSrc(input: string): string {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      return input;
    }
    const a = $app;
    if (!a) return input;
    const file = a.metadataCache.getFirstLinkpathDest(input, "");
    if (file && ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"].includes(file.extension)) {
      return a.vault.getResourcePath(file);
    }
    return input;
  }
</script>

<div class="ppp-cover-banner" style="--ppp-cover-width: {widthStyle}">
  {#if resolvedSrc}
    <img
      src={resolvedSrc}
      alt={overlay || "cover"}
      style="object-fit: {fitStyle}; object-position: center {position};"
    />
    {#if overlay}
      <div class="ppp-cover-overlay">{overlay}</div>
    {/if}
  {:else}
    <div class="ppp-cover-empty">No image — open settings to set a source.</div>
  {/if}
</div>

<style>
  .ppp-cover-banner {
    position: relative;
    width: var(--ppp-cover-width);
    max-width: 100%;
    height: 100%;
    min-height: 4rem;
    border-radius: var(--radius-s);
    overflow: hidden;
    background: var(--background-secondary);
  }

  .ppp-cover-banner img {
    width: 100%;
    height: 100%;
    display: block;
  }

  .ppp-cover-overlay {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
    color: white;
    font-weight: 600;
    font-size: var(--font-ui-medium);
  }

  .ppp-cover-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--text-faint);
    font-size: var(--font-ui-small);
  }
</style>
