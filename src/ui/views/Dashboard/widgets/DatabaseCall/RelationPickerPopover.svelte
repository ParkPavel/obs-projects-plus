<script lang="ts">
  /**
   * RelationPickerPopover — #081 (W1, NOTION_GRADE_PIPELINE). The Relation
   * cell editor: search + (multi)select over the records of the target
   * project (`RelationFieldConfig.targetProjectId` via
   * `api.resolveExternalFrame`), falling back to wikilink targets already
   * present in this column. Single-select commits on click; multi-select
   * accumulates and commits on Done. Esc cancels. stab-forms: the search is the
   * shared SearchField; ArrowDown/Up move the active option and Enter takes it
   * (the top match until the user moves); IME composition suppresses the keys.
   */
  import { createEventDispatcher, onMount } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataField, DataFrame, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";
  import SearchField from "src/ui/components/fields/SearchField.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { clampActive, filterOptions, optionDomId, reveal, stepActive } from "src/ui/components/fields/comboOptions";
  import { loadRelationCandidates } from "./relationCandidates";
  import RelationCountBadge from "./RelationCountBadge.svelte";

  export let field: DataField;
  export let value: Optional<DataValue>;
  export let api: ViewApi;
  export let frame: DataFrame;

  const dispatch = createEventDispatcher<{
    commit: Optional<DataValue>;
    cancel: void;
    setupRelation: void;
  }>();

  $: multi = field.repeated === true;
  $: hasTargetProject = !!((field.typeConfig as { relation?: { targetProjectId?: string } } | undefined)?.relation?.targetProjectId);

  let query = "";
  let active = 0;
  let candidates: string[] = [];
  let loading = true;
  let resolvedCount = 0;

  let selected = new Set(parseRelationLinks(value));

  onMount(async () => {
    candidates = await loadRelationCandidates(field, api, frame);
    loading = false;
    resolvedCount = parseRelationLinks(value).filter((label) => candidates.includes(label)).length;
  });

  $: listId = optionDomId("ppp-rel-list", field.name);
  $: filtered = filterOptions(candidates.map((label) => ({ label })), query).map((o) => o.label);
  // The option Enter takes: the top match until the user moves; clamped when the list shrinks.
  $: activeIdx = clampActive(active, filtered.length);

  function setQuery(next: string) {
    query = next;
    active = 0;
  }

  function commitSelection(labels: string[]) {
    const links = labels.map((l) => `[[${l}]]`);
    dispatch("commit", multi ? links : links[0] ?? "");
  }

  function choose(label: string) {
    if (!multi) {
      commitSelection([label]);
      return;
    }
    if (selected.has(label)) selected.delete(label);
    else selected.add(label);
    selected = new Set(selected);
  }

  function handleKeydown(e: KeyboardEvent) {
    // An IME candidate's Enter or Escape belongs to the composition.
    if (isImeKey(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      dispatch("cancel");
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = stepActive(clampActive(active, filtered.length), e.key === "ArrowDown" ? 1 : -1, filtered.length);
    } else if (e.key === "Enter" && filtered.length > 0) {
      // Read live (not activeIdx): two keys can land before the derived index settles.
      e.preventDefault();
      choose(filtered[clampActive(active, filtered.length)]!);
    }
  }
</script>

<div class="ppp-rel-picker" role="dialog" aria-label={field.name}>
  <SearchField
    {query}
    focusOnMount
    inputClass="ppp-rel-picker-search"
    placeholder={$i18n.t("views.dashboard.table-v2.relation-search", { defaultValue: "Search records…" })}
    controls={listId}
    activeDescendant={activeIdx >= 0 ? optionDomId(listId, filtered[activeIdx] ?? "") : undefined}
    on:queryChange={(e) => setQuery(e.detail)}
    on:keydown={handleKeydown}
  />
  <RelationCountBadge count={resolvedCount} {loading} />
  <div class="ppp-rel-picker-list" id={listId} role="listbox" aria-multiselectable={multi}>
    {#if loading}
      <span class="ppp-rel-picker-hint">…</span>
    {:else if filtered.length === 0}
      {#if !hasTargetProject && candidates.length === 0}
        <button class="ppp-rel-picker-setup" on:mousedown|preventDefault on:click={() => dispatch("setupRelation")}>{$i18n.t("relation-setup.open", { defaultValue: "Link database…" })}</button>
      {:else}
        <span class="ppp-rel-picker-hint">{$i18n.t("views.dashboard.table-v2.relation-empty", { defaultValue: "No records to link" })}</span>
      {/if}
    {:else}
      {#each filtered as label, i (label)}
        <button
          id={optionDomId(listId, label)}
          class="ppp-rel-picker-item"
          class:ppp-rel-picker-item--active={i === activeIdx}
          role="option"
          aria-selected={selected.has(label)}
          use:reveal={i === activeIdx}
          on:mousedown|preventDefault
          on:click={() => choose(label)}
        >
          {#if multi}
            <input type="checkbox" checked={selected.has(label)} tabindex="-1" />
          {/if}
          <span class="ppp-rel-picker-label">{label}</span>
        </button>
      {/each}
    {/if}
  </div>
  <div class="ppp-rel-picker-actions">
    {#if multi}
      <span class="ppp-rel-picker-count">{selected.size}</span>
      <button class="ppp-rel-picker-done mod-cta" on:mousedown|preventDefault on:click={() => commitSelection([...selected])}>
        {$i18n.t("views.dashboard.table-v2.relation-done", { defaultValue: "Done" })}
      </button>
    {/if}
    <button class="ppp-rel-picker-cancel" on:mousedown|preventDefault on:click={() => dispatch("cancel")}>
      {$i18n.t("views.dashboard.table-v2.relation-cancel", { defaultValue: "Cancel" })}
    </button>
  </div>
</div>

<style>
  .ppp-rel-picker {
    position: absolute;
    top: calc(100% + 0.375rem);
    left: 0;
    min-width: 14rem;
    max-width: 20rem;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    box-shadow: var(--ppp-shadow-md);
    z-index: 4;
    padding: 0.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ppp-rel-picker-list {
    max-height: 12rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .ppp-rel-picker-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.375rem;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    text-align: left;
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-rel-picker-item:hover,
  .ppp-rel-picker-item--active {
    background: var(--background-modifier-hover);
  }

  .ppp-rel-picker-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-rel-picker-hint {
    padding: 0.375rem;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .ppp-rel-picker-setup {
    padding: 0.25rem 0.375rem;
    font-size: var(--font-ui-small);
    color: var(--interactive-accent);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .ppp-rel-picker-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
  }

  .ppp-rel-picker-count {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    margin-right: auto;
  }

  .ppp-rel-picker-done,
  .ppp-rel-picker-cancel {
    padding: 0.2rem 0.6rem;
    font-size: var(--font-ui-small);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-rel-picker-cancel {
    border: 0.0625rem solid var(--background-modifier-border);
    background: transparent;
    color: var(--text-muted);
  }
</style>
