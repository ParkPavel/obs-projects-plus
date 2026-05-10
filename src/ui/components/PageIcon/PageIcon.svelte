<script lang="ts">
  import { setIcon } from "obsidian";

  /**
   * Raw value from the icon field. May be:
   *   - emoji grapheme (e.g. "📄", "🚀")
   *   - lucide icon name (e.g. "file-text", "rocket")
   *   - empty/null → nothing renders
   */
  export let value: unknown = null;

  /** Visual size in rem. Default matches inline text height. */
  export let size: number = 1;

  let host: HTMLSpanElement | null = null;

  $: trimmed = typeof value === "string" ? value.trim() : "";
  $: kind = detectKind(trimmed);

  function detectKind(s: string): "emoji" | "lucide" | "none" {
    if (!s) return "none";
    if (/^[A-Za-z][A-Za-z0-9-]*$/.test(s)) return "lucide";
    return "emoji";
  }

  $: if (host && kind === "lucide") {
    host.empty?.();
    host.textContent = "";
    setIcon(host, trimmed);
  } else if (host && kind !== "lucide") {
    host.textContent = "";
  }
</script>

{#if kind === "emoji"}
  <span class="ppp-page-icon ppp-page-icon--emoji" style="--ppp-icon-size: {size}rem">{trimmed}</span>
{:else if kind === "lucide"}
  <span class="ppp-page-icon ppp-page-icon--lucide" bind:this={host} style="--ppp-icon-size: {size}rem"></span>
{/if}

<style>
  .ppp-page-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--ppp-icon-size, 1rem);
    height: var(--ppp-icon-size, 1rem);
    flex: 0 0 auto;
    line-height: 1;
    font-size: calc(var(--ppp-icon-size, 1rem) * 0.875);
  }
  .ppp-page-icon--lucide :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
