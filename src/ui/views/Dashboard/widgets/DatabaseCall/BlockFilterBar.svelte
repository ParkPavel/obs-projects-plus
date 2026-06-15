<script lang="ts">
  /**
   * BlockFilterBar — #099.1 (NOTION_DM_RESEARCH §2, Закон 5).
   *
   * The block's filter as Notion-style pills: every enabled condition is a
   * visible, one-click-removable pill; the builder popup is the ONE
   * canonical FilterPanel and every change applies INSTANTLY (its `update`
   * event) — no Save. Storage: `WidgetDataContext.subFilter`
   * (SPEC §3.4), evaluation: canonical filterEvaluator in the block.
   */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import type { FilterDefinition } from "src/settings/base/settings";
  import FilterPanel from "src/ui/components/FilterPanel/FilterPanel.svelte";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import { FilterPills } from "src/ui/components/FilterPills";

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
  <div class="ppp-blockfilter">
    <FilterPills
      {conditions}
      {readonly}
      bind:triggerEl
      {open}
      ariaLabel={$i18n.t("views.dashboard.block-filter.aria", { defaultValue: "Block filter" })}
      addLabel={$i18n.t("views.dashboard.block-filter.add", { defaultValue: "Filter" })}
      removeLabel={$i18n.t("views.dashboard.block-filter.remove", { defaultValue: "Remove condition" })}
      on:remove={(e) => removeCondition(e.detail)}
      on:addClick={() => (open = !open)}
    />
    {#if !readonly}
      <FloatingPopup {triggerEl} bind:open placement="bottom-start" role="dialog"
        ariaLabel={$i18n.t("views.dashboard.block-filter.aria", { defaultValue: "Block filter" })}>
        <div class="ppp-blockfilter-popover">
          <FilterPanel
            value={filter}
            fields={fields.map((f) => ({ name: f.name, type: f.type }))}
            {records}
            scopeLabel={$i18n.t("views.dashboard.block-filter.scope", { defaultValue: "This block — all its views" })}
            on:update={handleUpdate}
          />
        </div>
      </FloatingPopup>
    {/if}
  </div>
{/if}

<style>
  .ppp-blockfilter {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-blockfilter-popover {
    min-width: 22rem;
    max-width: 28rem;
    max-height: 24rem;
    overflow-y: auto;
    padding: 0.375rem;
  }
</style>
