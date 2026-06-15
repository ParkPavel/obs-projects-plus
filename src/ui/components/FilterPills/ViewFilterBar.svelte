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
  import { createEventDispatcher } from "svelte";
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

  const dispatch = createEventDispatcher<{ change: FilterDefinition | undefined }>();

  let open = false;
  let triggerEl: HTMLButtonElement | null = null;

  $: conditions = (filter?.conditions ?? []).filter((c) => c.enabled !== false);

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

  .ppp-viewfilter-popover {
    min-width: 22rem;
    max-width: 28rem;
    max-height: 24rem;
    overflow-y: auto;
    padding: 0.375rem;
  }
</style>
