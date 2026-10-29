<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  export let version: unknown = undefined;
  export let disabled = false;
  const dispatch = createEventDispatcher<{ change: import("src/lib/formula/version").VersionedFormula }>();
  $: supported = version === undefined || version === "unified-v1";
</script>

<div class="ppp-formula-mode">
  <div role="group" aria-label={$i18n.t("formula-mode.label")}>
    <span>{$i18n.t("formula-mode.label")}</span>
    <button type="button" {disabled} aria-pressed={version === undefined} on:click={() => dispatch("change", {})}>
      {$i18n.t("formula-mode.legacy")}
    </button>
    <button type="button" {disabled} title={$i18n.t("formula-mode.warning")} aria-pressed={version === "unified-v1"} on:click={() => dispatch("change", { formulaVersion: "unified-v1" })}>
      {$i18n.t("formula-mode.modern")}
    </button>
  </div>
  {#if !supported}<p role="alert">{$i18n.t("formula-errors.version")}</p>{/if}
  {#if version === "unified-v1" || !supported}<p class="ppp-formula-mode-warning">{$i18n.t("formula-mode.warning")}</p>{/if}
</div>

<style>
  .ppp-formula-mode { display: grid; gap: 0.25rem; }
  [role="group"] { display: flex; gap: 0.375rem; align-items: center; flex-wrap: wrap; }
  button[aria-pressed="true"] { background: var(--interactive-accent); color: var(--text-on-accent); }
  p { margin: 0; }
  .ppp-formula-mode-warning { color: var(--text-muted); font-size: var(--font-ui-smaller); }
</style>
