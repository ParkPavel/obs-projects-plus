<script lang="ts">
  /**
   * BlockFilterBar — #099.1 (NOTION_DM_RESEARCH §2, Закон 5).
   *
   * The block's filter. w4-p10a (N8): one "Filter · N" button in the block's
   * row (the pills' own row took a line of the block); the builder popup is the ONE
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
  import FilterPills from "src/ui/components/FilterPills/FilterPills.svelte";
  import { Icon } from "obsidian-svelte";

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

</script>

{#if !readonly || conditions.length > 0}
  <!-- w4-p10a (N8, Codex design A): one button, "Filter · N", in the block's
       row beside its views — the pills' own row is gone. N counts the switched
       on conditions; none, no number. It opens the same editor (on a phone the
       sheet); read-only, the conditions as pills. -->
  <div class="ppp-blockfilter">
    <button
      bind:this={triggerEl}
      type="button"
      class="ppp-blockfilter-button clickable-icon"
      class:ppp-blockfilter-button--on={conditions.length > 0}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={conditions.length > 0
        ? `${$i18n.t("views.dashboard.block-filter.add", { defaultValue: "Filter" })}: ${conditions.length}`
        : $i18n.t("views.dashboard.block-filter.add", { defaultValue: "Filter" })}
      on:click={() => (open = !open)}
    >
      <Icon name="filter" size="sm" />
      {#if conditions.length > 0}<span class="ppp-blockfilter-count">{conditions.length}</span>{/if}
    </button>
    <FloatingPopup {triggerEl} bind:open placement="bottom-start" role="dialog"
      ariaLabel={$i18n.t("views.dashboard.block-filter.aria", { defaultValue: "Block filter" })}>
      <div class="ppp-blockfilter-popover">
        {#if readonly}
          <FilterPills
            {conditions}
            readonly
            ariaLabel={$i18n.t("views.dashboard.block-filter.aria", { defaultValue: "Block filter" })}
            addLabel={$i18n.t("views.dashboard.block-filter.add", { defaultValue: "Filter" })}
            removeLabel={$i18n.t("views.dashboard.block-filter.remove", { defaultValue: "Remove condition" })}
          />
        {:else}
          <FilterPanel
            value={filter}
            fields={fields.map((f) => ({ name: f.name, type: f.type }))}
            {records}
            scopeLabel={$i18n.t("views.dashboard.block-filter.scope", { defaultValue: "This block — all its views" })}
            on:update={handleUpdate}
          />
        {/if}
      </div>
    </FloatingPopup>
  </div>
{/if}

<style>
  .ppp-blockfilter {
    display: flex;
    flex: none;
    align-items: center;
  }

  .ppp-blockfilter-button {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    min-height: var(--ppp-touch-target-min);
    padding: 0 0.375em;
    color: var(--text-muted);
  }

  .ppp-blockfilter-button--on {
    color: var(--interactive-accent);
  }

  .ppp-blockfilter-count {
    font-size: var(--font-ui-smaller);
    font-variant-numeric: tabular-nums;
  }

  .ppp-blockfilter-popover {
    /* #182, and the ticket's own diagnosis was wrong — see its entry. The
       mobile sheet is NOT sized by the widget it was opened from: measurement
       (`A182_mobileSheet.acceptance.test.ts`) shows `container-type` and
       `overflow: hidden` create no containing block for `position: fixed`, so
       the sheet is the screen either way. What was real is simpler: on a phone
       narrower than 22rem this minimum pushed the content off the edge.
       `100%` and not `100cqi` — the popup's parent is the sheet, and a
       container unit would measure a widget that has nothing to do with it. */
    min-width: min(22rem, 100%);
    max-width: 28rem;
    max-height: 24rem;
    overflow-y: auto;
    padding: 0.375rem;
  }
</style>
