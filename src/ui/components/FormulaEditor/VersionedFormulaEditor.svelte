<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { FormulaSemantics } from "src/lib/formula/catalog";
  import { formulaEditorSemantics } from "src/lib/formula/version";
  import FormulaEditor from "./FormulaEditor.svelte";
  import FormulaMode from "./FormulaMode.svelte";
  import { i18n } from "src/lib/stores/i18n";
  export let expression = "";
  export let version: unknown = undefined;
  export let legacy: Exclude<FormulaSemantics, "unified-v1"> = "legacy-computed";
  export let fields: string[] = [];
  export let placeholder = "";
  export let ariaLabel = "";
  export let rows = 6;
  export let disabled = false;
  export let highlight = true;
  export let showApply = false;
  let pending = true;
  let errors: string[] = [];
  let hasContent = !!expression.trim();
  let editor: FormulaEditor;
  const dispatch = createEventDispatcher<{ change: string; commit: string; modechange: import("src/lib/formula/version").VersionedFormula }>();
  $: semantics = formulaEditorSemantics(version, legacy);
</script>

<div class="ppp-versioned-formula-editor">
<FormulaMode {version} {disabled} on:change={(event) => { version = event.detail.formulaVersion; dispatch("modechange", event.detail); }} />
{#if semantics}
  <FormulaEditor bind:this={editor} {expression} {semantics} {fields} {placeholder} {ariaLabel} {rows} {disabled} {highlight}
    on:change={(event) => { hasContent = !!event.detail.trim(); dispatch("change", event.detail); }}
    on:validation={(event) => { pending = event.detail.pending; errors = event.detail.errors; hasContent = !!event.detail.value.trim(); }}
    on:commit={(event) => dispatch("commit", event.detail)} />
{:else}
  <textarea value={expression} {rows} readonly aria-label={ariaLabel || placeholder || $i18n.t("views.dashboard.formula.title")}></textarea>
{/if}
{#if showApply}
  <button type="button" disabled={disabled || !semantics || pending || !!errors.length || !hasContent}
    on:click={() => editor?.commitCurrent()}>{$i18n.t("views.dashboard.formula.apply")}</button>
{/if}
</div>

<style>
  .ppp-versioned-formula-editor { display: grid; gap: 0.375rem; min-width: 0; width: 100%; }
</style>
