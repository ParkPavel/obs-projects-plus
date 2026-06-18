<script lang="ts">
  // FormulaHelpPanel — metadata-driven function reference (#077, slice 1).
  // Reads getAllFormulaMetadata() and renders one <section> per category.
  // `extraCategories` is the escape hatch for surfaces whose functions live
  // outside the metadata registry (e.g. Calendar agenda IS_OVERDUE/HAS_ANY_OF).

  import { i18n } from "src/lib/stores/i18n";
  import { groupFormulaMetadata } from "./formulaHelpGroups";

  export let extraCategories: ReadonlyArray<{
    title: string;
    entries: ReadonlyArray<{ signature: string; doc?: string }>;
  }> = [];
  export let onInsert: ((signature: string) => void) | undefined = undefined;

  const groups = groupFormulaMetadata();

  $: categoryTitle = (category: string) =>
    $i18n.t(`views.dashboard.formula.help-category.${category}`);
</script>

<div class="ppp-fhp">
  {#each groups as group}
    <section class="ppp-fhp-section">
      <h4 class="ppp-fhp-title">{categoryTitle(group.category)}</h4>
      {#each group.entries as entry}
        <div class="ppp-fhp-entry">
          {#if onInsert}
            <button
              type="button"
              class="ppp-fhp-code ppp-fhp-code--btn"
              on:click={() => onInsert?.(entry.signature)}
            >{entry.signature}</button>
          {:else}
            <code class="ppp-fhp-code">{entry.signature}</code>
          {/if}
          {#if entry.doc}
            <span class="ppp-fhp-doc">{entry.doc}</span>
          {/if}
        </div>
      {/each}
    </section>
  {/each}

  {#each extraCategories as group}
    <section class="ppp-fhp-section">
      <h4 class="ppp-fhp-title">{group.title}</h4>
      {#each group.entries as entry}
        <div class="ppp-fhp-entry">
          {#if onInsert}
            <button
              type="button"
              class="ppp-fhp-code ppp-fhp-code--btn"
              on:click={() => onInsert?.(entry.signature)}
            >{entry.signature}</button>
          {:else}
            <code class="ppp-fhp-code">{entry.signature}</code>
          {/if}
          {#if entry.doc}
            <span class="ppp-fhp-doc">{entry.doc}</span>
          {/if}
        </div>
      {/each}
    </section>
  {/each}
</div>

<style>
  .ppp-fhp {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.5rem 0.75rem;
  }

  .ppp-fhp-section {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .ppp-fhp-title {
    margin: 0 0 0.15rem;
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ppp-fhp-entry {
    display: flex;
    flex-direction: column;
    gap: 0.0625rem;
  }

  .ppp-fhp-code {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.1rem 0.375rem;
    background: var(--code-background);
    border: none;
    border-radius: var(--radius-s);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    color: var(--code-normal);
    line-height: 1.5;
  }

  .ppp-fhp-code--btn {
    cursor: pointer;
  }

  .ppp-fhp-code--btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-accent);
  }

  .ppp-fhp-doc {
    padding: 0 0.375rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    line-height: 1.4;
  }
</style>
