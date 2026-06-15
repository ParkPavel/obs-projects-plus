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
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import type { FilterDefinition } from "src/settings/base/settings";
  import FilterPanel from "src/ui/components/FilterPanel/FilterPanel.svelte";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import { getOperatorLabel } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";

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
  <div class="ppp-blockfilter" role="toolbar" aria-label={$i18n.t("views.dashboard.block-filter.aria", { defaultValue: "Block filter" })}>
    {#each conditions as cond, i (`${cond.field}-${i}`)}
      <span class="ppp-blockfilter-pill">
        <span class="ppp-blockfilter-pill-text">{cond.field} {getOperatorLabel(cond.operator)}{cond.value !== undefined && cond.value !== "" ? ` ${cond.value}` : ""}</span>
        {#if !readonly}
          <button
            class="ppp-blockfilter-pill-x clickable-icon"
            on:click={() => removeCondition(i)}
            aria-label={$i18n.t("views.dashboard.block-filter.remove", { defaultValue: "Remove condition" })}
          ><Icon name="x" size="sm" /></button>
        {/if}
      </span>
    {/each}
    {#if !readonly}
      <button
        bind:this={triggerEl}
        class="ppp-blockfilter-add"
        class:ppp-blockfilter-add--active={open}
        on:click={() => (open = !open)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="filter" size="sm" />
        {conditions.length === 0 ? $i18n.t("views.dashboard.block-filter.add", { defaultValue: "Filter" }) : ""}
      </button>
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

  .ppp-blockfilter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: 0.875rem;
    background: transparent;
    color: var(--text-accent);
    font-size: var(--font-ui-smaller);
  }

  .ppp-blockfilter-pill-text {
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-blockfilter-pill-x {
    display: inline-flex;
    align-items: center;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0;
  }

  .ppp-blockfilter-pill-x:hover {
    color: var(--text-normal);
  }

  .ppp-blockfilter-add {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .ppp-blockfilter-add:hover,
  .ppp-blockfilter-add--active {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-blockfilter-popover {
    min-width: 22rem;
    max-width: 28rem;
    max-height: 24rem;
    overflow-y: auto;
    padding: 0.375rem;
  }
</style>
