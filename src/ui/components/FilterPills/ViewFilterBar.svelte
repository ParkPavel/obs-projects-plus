<script lang="ts">
  /**
   * ViewFilterBar — quick view-filter pills for the main view shell (#077).
   *
   * Owns the view's FilterDefinition presentation: renders FilterPills plus a
   * FloatingPopup hosting the canonical FilterPanel. Pills are a fast
   * view/remove surface; the full editor still lives in SettingsMenu. No
   * parallel filter engine — evaluation stays with the canonical applyFilter
   * pipeline in View.svelte; this component only edits the definition.
   */
  import { createEventDispatcher, tick } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import type { FilterDefinition } from "src/settings/base/settings";
  import FilterPanel from "src/ui/components/FilterPanel/FilterPanel.svelte";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import FilterPills from "src/ui/components/FilterPills/FilterPills.svelte";

  export let filter: FilterDefinition | undefined = undefined;
  export let fields: DataField[] = [];
  export let records: DataRecord[] = [];
  export let readonly = false;

  const dispatch = createEventDispatcher<{
    change: FilterDefinition | undefined;
    /** #184: name this filter and keep it as a source of the project. */
    saveAsSource: string;
  }>();

  let open = false;
  let triggerEl: HTMLButtonElement | null = null;
  let naming = false;
  let sourceName = "";
  let nameEl: HTMLInputElement | null = null;

  $: conditions = (filter?.conditions ?? []).filter((c) => c.enabled !== false);
  // #184. The action appears only once the filter HAS matched something the
  // user can see. That is the brief's verify-after-write rule and it is also
  // the honest constraint: a saved selection with no conditions equals the
  // project it came from, so naming one would produce a source that means
  // nothing. The bar is the right home precisely because the filter is already
  // visible here and has already been applied to what is on screen.
  $: canSave = !readonly && conditions.length > 0;

  async function startNaming() {
    naming = true;
    sourceName = "";
    await tick();
    nameEl?.focus();
  }

  function commitName() {
    const trimmed = sourceName.trim();
    naming = false;
    sourceName = "";
    // A blank name is a cancel, not an unnamed source: the name is the only
    // thing that will identify this selection in a picker later.
    if (trimmed) dispatch("saveAsSource", trimmed);
  }

  function handleUpdate(e: CustomEvent<FilterDefinition>) {
    const next = e.detail;
    dispatch("change", next.conditions.length > 0 ? next : undefined);
  }

  function removeCondition(index: number) {
    if (!filter) return;
    const remaining = filter.conditions.filter((_, i) => i !== index);
    dispatch("change", remaining.length > 0 ? { ...filter, conditions: remaining } : undefined);
  }
</script>

{#if !readonly || conditions.length > 0}
  <div class="ppp-viewfilter">
    <FilterPills
      {conditions}
      {readonly}
      bind:triggerEl
      {open}
      ariaLabel={$i18n.t("views.filter.bar.aria", { defaultValue: "View filter" })}
      addLabel={$i18n.t("views.filter.bar.add", { defaultValue: "Filter" })}
      on:remove={(e) => removeCondition(e.detail)}
      on:addClick={() => (open = !open)}
    />
    {#if canSave}
      {#if naming}
        <input
          bind:this={nameEl}
          class="ppp-viewfilter-name"
          type="text"
          bind:value={sourceName}
          placeholder={$i18n.t("views.filter.bar.save-name", { defaultValue: "Name this selection…" })}
          aria-label={$i18n.t("views.filter.bar.save-name", { defaultValue: "Name this selection…" })}
          on:keydown={(e) => {
            if (e.key === "Enter") commitName();
            else if (e.key === "Escape") { naming = false; sourceName = ""; }
          }}
          on:blur={commitName}
        />
      {:else}
        <button
          class="ppp-viewfilter-save"
          on:click={startNaming}
          title={$i18n.t("views.filter.bar.save-tip", { defaultValue: "Keep this filter as a source of the project, so a block can show it" })}
        >
          {$i18n.t("views.filter.bar.save", { defaultValue: "Save as source" })}
        </button>
      {/if}
    {/if}
    {#if !readonly}
      <FloatingPopup {triggerEl} bind:open placement="bottom-start" role="dialog"
        ariaLabel={$i18n.t("views.filter.bar.aria", { defaultValue: "View filter" })}>
        <div class="ppp-viewfilter-popover">
          <FilterPanel
            value={filter}
            fields={fields.map((f) => ({ name: f.name, type: f.type }))}
            {records}
            scopeLabel={$i18n.t("views.filter.bar.scope", { defaultValue: "This view" })}
            on:update={handleUpdate}
          />
        </div>
      </FloatingPopup>
    {/if}
  </div>
{/if}

<style>
  .ppp-viewfilter {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
  }

  .ppp-viewfilter-save {
    border: none;
    background: transparent;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
    padding: 0.125rem 0.25rem;
    border-radius: var(--radius-s, 0.25rem);
  }

  .ppp-viewfilter-save:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-viewfilter-name {
    height: 1.5rem;
    max-width: 14rem;
    font-size: var(--font-ui-smaller);
  }

  .ppp-viewfilter-popover {
    min-width: 22rem;
    max-width: 28rem;
    max-height: 24rem;
    overflow-y: auto;
    padding: 0.375rem;
  }
</style>
