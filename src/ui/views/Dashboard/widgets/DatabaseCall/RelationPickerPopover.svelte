<script lang="ts">
  /**
   * RelationPickerPopover — #081 (W1, NOTION_GRADE_PIPELINE). The Relation
   * Searches the target project, or this column's links when unconfigured.
   * A single pick commits; multiple picks commit on Done. Escape cancels.
   * SearchField owns the query; arrow keys and Enter navigate candidates.
   * IME composition suppresses navigation and commit.
   */
  import { createEventDispatcher, onDestroy } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataField, DataFrame, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";
  import SearchField from "src/ui/components/fields/SearchField.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { clampActive, filterOptions, optionDomId, stepActive } from "src/ui/components/fields/comboOptions";
  import { createRelationCandidates } from "./relationCandidates";
  import { selectedCandidateIds, serializeRelationSelection, toggleRelationSelection } from "./relationSelection";
  import RelationCountBadge from "./RelationCountBadge.svelte";
  import RelationSelection from "./RelationSelection.svelte";
  import RelationCandidateList from "./RelationCandidateList.svelte";

  export let field: DataField;
  export let value: Optional<DataValue>;
  export let api: ViewApi;
  export let frame: DataFrame;
  export let triggerEl: HTMLElement | null = null;
  export let saving = false;

  const dispatch = createEventDispatcher<{
    commit: Optional<DataValue>;
    cancel: void;
    setupRelation: void;
  }>();

  $: multi = field.repeated === true;
  $: hasTargetProject = !!((field.typeConfig as { relation?: { targetProjectId?: string } } | undefined)?.relation?.targetProjectId);

  let query = "";
  let active = 0;
  let popupOpen = true;
  const original = value;
  let selected = new Set(parseRelationLinks(value));
  const source = createRelationCandidates();
  onDestroy(source.destroy);
  $: void source.load(field, api, frame);
  $: candidates = $source.candidates;
  $: loading = $source.loading;
  $: selectedIds = selectedCandidateIds(selected, candidates);

  $: listId = optionDomId("ppp-rel-list", field.name);
  $: filtered = filterOptions(candidates.map((label) => ({ label })), query).map((o) => o.label);
  $: activeIdx = clampActive(active, filtered.length);

  function setQuery(next: string) {
    query = next;
    active = 0;
  }

  function commitSelection(labels: string[]) {
    if (saving) return;
    dispatch("commit", serializeRelationSelection(labels, original, multi));
  }

  function choose(label: string) {
    if (saving || !source.accepts(label, field, api, frame)) return;
    if (!multi) {
      commitSelection(selectedIds.includes(label) ? [...selected] : [label]);
      return;
    }
    selected = toggleRelationSelection(selected, label, candidates);
  }

  function handleKeydown(e: KeyboardEvent) {
    // An IME candidate's Enter or Escape belongs to the composition.
    if (isImeKey(e)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = stepActive(clampActive(active, filtered.length), e.key === "ArrowDown" ? 1 : -1, filtered.length);
    } else if (e.key === "Enter" && filtered.length > 0) {
      // Read live (not activeIdx): two keys can land before the derived index settles.
      e.preventDefault();
      choose(filtered[clampActive(active, filtered.length)]!);
    }
  }

  function handlePopupClose(): void {
    if (saving) return;
    dispatch("cancel");
  }
</script>

<FloatingPopup {triggerEl} bind:open={popupOpen} dismissible={!saving} placement="bottom-start" role="dialog"
  ariaLabel={field.name} autoFocus={false} on:close={handlePopupClose}>
<div class="ppp-rel-picker">
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
  <RelationCountBadge count={selectedIds.length} {loading} />
  {#if multi}<RelationSelection selected={[...selected]} {saving}
    on:remove={(event) => { selected = new Set([...selected].filter(target => target !== event.detail)); }} />{/if}
  <RelationCandidateList {listId} labels={filtered} {selectedIds} active={activeIdx} {multi} {loading} {saving}
    failed={$source.error} showSetup={!hasTargetProject && candidates.length === 0}
    on:choose={(event) => choose(event.detail)} on:retry={() => source.load(field, api, frame)}
    on:setup={() => dispatch("setupRelation")} />
  <div class="ppp-rel-picker-actions">
    {#if multi}
      <span class="ppp-rel-picker-count">{selected.size}</span>
      <button type="button" class="ppp-rel-picker-done mod-cta" disabled={saving || loading} on:mousedown|preventDefault on:click={() => commitSelection([...selected])}>
        {$i18n.t("views.dashboard.table-v2.relation-done", { defaultValue: "Done" })}
      </button>
    {/if}
    {#if !multi}<button type="button" class="ppp-rel-picker-clear" disabled={saving} on:mousedown|preventDefault on:click={() => commitSelection([])}>{$i18n.t("common.clear")}</button>{/if}
    <button type="button" class="ppp-rel-picker-cancel" disabled={saving} on:mousedown|preventDefault on:click={() => dispatch("cancel")}>
      {$i18n.t("views.dashboard.table-v2.relation-cancel", { defaultValue: "Cancel" })}
    </button>
  </div>
</div>
</FloatingPopup>

<style>
  .ppp-rel-picker {
    width: 20rem;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
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
  .ppp-rel-picker-clear,
  .ppp-rel-picker-cancel {
    padding: 0.2rem 0.6rem;
    font-size: var(--font-ui-small);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-rel-picker-cancel, .ppp-rel-picker-clear {
    border: 0.0625rem solid var(--background-modifier-border);
    background: transparent;
    color: var(--text-muted);
  }
</style>
