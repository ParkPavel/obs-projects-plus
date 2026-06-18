<script lang="ts">
  // FormulaConstructorFull — composition wrapper around the lean
  // FormulaConstructor (#077, slice 2). Adds the Anatomy chrome that input-only
  // surfaces do not need: a toolbar (Help toggle + validation badge), an
  // optional preview slot, and the metadata-driven FormulaHelpPanel.
  //
  // The lean FormulaConstructor stays input-only; this wrapper is for surfaces
  // that previously hand-rolled their own toolbar + help list.

  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import FormulaConstructor, {
    type FormulaSnippet,
  } from "./FormulaConstructor.svelte";
  import FormulaHelpPanel from "./FormulaHelpPanel.svelte";

  type HelpCategory = {
    title: string;
    entries: ReadonlyArray<{ signature: string; doc?: string }>;
  };

  export let value: string = "";
  export let fields: string[] = [];
  export let validate: ((expr: string, fields: string[]) => string[]) | undefined =
    undefined;
  export let snippets: FormulaSnippet[] | undefined = undefined;
  export let placeholder: string = "";
  export let rows: number = 6;
  export let highlight: boolean = true;
  export let helpExtraCategories: HelpCategory[] = [];

  const dispatch = createEventDispatcher<{
    change: string;
    commit: void;
  }>();

  let showHelp = false;

  // Error count for the validation badge. Reuses the PASSED validate so no
  // second validation engine is introduced (invariant #7).
  $: errorCount =
    validate && value.trim() ? validate(value, fields).length : 0;

  function handleChange(e: CustomEvent<string>) {
    value = e.detail;
    dispatch("change", value);
  }

  function insertFromHelp(signature: string) {
    // Append the signature at the end; FormulaConstructor owns the textarea so
    // we route through value + change to stay the single source of truth.
    const sep = value.trim() === "" ? "" : value.endsWith(" ") ? "" : " ";
    value = `${value}${sep}${signature}`;
    dispatch("change", value);
  }
</script>

<div class="ppp-fcf">
  <div class="ppp-fcf-toolbar">
    <div class="ppp-fcf-toolbar-group">
      <button
        type="button"
        class="ppp-fcf-btn"
        class:active={showHelp}
        on:click={() => (showHelp = !showHelp)}
        title={$i18n.t("views.calendar.agenda.custom.advanced-filter.toolbar-help")}
        aria-label={$i18n.t("views.calendar.agenda.custom.advanced-filter.toolbar-help")}
        aria-pressed={showHelp}
      >
        <span class="ppp-fcf-btn-icon" aria-hidden="true">?</span>
        <span>{$i18n.t("views.calendar.agenda.custom.advanced-filter.toolbar-help")}</span>
      </button>
    </div>
    <div class="ppp-fcf-hint">
      {#if errorCount > 0}
        <span class="ppp-fcf-hint-error">
          {$i18n.t("views.calendar.agenda.custom.advanced-filter.hint-error", { count: errorCount })}
        </span>
      {:else if value.trim()}
        <span class="ppp-fcf-hint-valid">
          {$i18n.t("views.calendar.agenda.custom.advanced-filter.hint-valid")}
        </span>
      {:else}
        <span class="ppp-fcf-hint-info">
          {$i18n.t("views.calendar.agenda.custom.advanced-filter.hint-ctrl-space")}
        </span>
      {/if}
    </div>
  </div>

  {#if showHelp}
    <div class="ppp-fcf-help">
      <FormulaHelpPanel
        extraCategories={helpExtraCategories}
        onInsert={insertFromHelp}
      />
    </div>
  {/if}

  <div class="ppp-fcf-body">
    <FormulaConstructor
      {value}
      {fields}
      {...(validate ? { validate } : {})}
      {...(snippets ? { snippets } : {})}
      {placeholder}
      {rows}
      {highlight}
      on:change={handleChange}
      on:commit={() => dispatch("commit")}
    />

    <slot name="preview" />
  </div>
</div>

<style>
  .ppp-fcf {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    overflow: hidden;
  }

  .ppp-fcf-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-1) var(--size-4-2);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    gap: var(--size-4-2);
  }

  .ppp-fcf-toolbar-group {
    display: flex;
    gap: var(--size-4-1);
  }

  .ppp-fcf-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ppp-fcf-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 50%;
    border: 0.0625rem solid currentColor;
    font-size: 0.625rem;
    font-weight: 700;
    line-height: 1;
  }

  .ppp-fcf-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-fcf-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .ppp-fcf-hint {
    font-size: var(--font-ui-smaller);
    padding: 0 var(--size-4-1);
  }

  .ppp-fcf-hint-error { color: var(--text-error); font-weight: 600; }
  .ppp-fcf-hint-valid { color: var(--color-green); font-weight: 500; }
  .ppp-fcf-hint-info { color: var(--text-faint); }

  .ppp-fcf-help {
    padding: var(--size-4-2);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    max-height: 14rem;
    overflow-y: auto;
  }

  .ppp-fcf-body {
    padding: 0 var(--size-4-2) var(--size-4-2);
  }
</style>
