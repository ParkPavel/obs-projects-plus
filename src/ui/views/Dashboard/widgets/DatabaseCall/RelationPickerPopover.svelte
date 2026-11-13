<script context="module" lang="ts">let instances = 0;</script>
<script lang="ts">
  /**
   * Target-scoped relations; single pick or explicit Done, Escape cancels.
   * The search query never replaces a stored link or its alias.
   */
  import { createEventDispatcher, onDestroy } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataField, DataFrame, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";
  import SearchField from "src/ui/components/fields/SearchField.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { clampActive, createOptionSearch, optionDomId, stepActive } from "src/ui/components/fields/comboOptions";
  import { createRelationCandidates } from "./relationCandidates";
  import { selectedCandidateIds, serializeRelationSelection, toggleRelationSelection } from "./relationSelection";
  import RelationCountBadge from "./RelationCountBadge.svelte";
  import RelationSelection from "./RelationSelection.svelte";
  import RelationCandidateList from "./RelationCandidateList.svelte";
  import RelationPickerActions from "./RelationPickerActions.svelte";

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
  let inputEl: HTMLInputElement | null = null, interactionEl: HTMLDivElement | null = null;
  let searchField: SearchField | undefined, overlayVisible = false;
  const uid = `ppp-relation-${++instances}`;
  const original = value;
  let selected = new Set(parseRelationLinks(value));
  const source = createRelationCandidates();
  const search = createOptionSearch<{ label: string }>();
  onDestroy(source.destroy);
  $: void source.load(field, api, frame);
  $: candidates = $source.candidates;
  $: loading = $source.loading;
  $: selectedIds = selectedCandidateIds(selected, candidates);
  $: listId = optionDomId(uid, field.name);
  $: suggestions = search.update(candidates.map((label) => ({ label })));
  $: filtered = suggestions(query).map((o) => o.label);
  $: activeIdx = clampActive(active, filtered.length);

  function setQuery(next: string) {
    query = next;
    active = 0;
  }

  function commitSelection(labels: string[]) {
    if (saving || loading || searchField?.isComposing()) return;
    dispatch("commit", serializeRelationSelection(labels, original, multi));
  }

  function choose(label: string) {
    if (saving || searchField?.isComposing() || !source.accepts(label, field, api, frame)) return;
    if (!multi) {
      commitSelection(selectedIds.includes(label) ? [...selected] : [label]);
      return;
    }
    selected = toggleRelationSelection(selected, label, candidates);
  }

  function handleKeydown(e: KeyboardEvent) {
    // An IME candidate's Enter or Escape belongs to the composition.
    if (searchField?.isComposing() || isImeKey(e)) { e.stopPropagation(); return; }
    if (saving || !overlayVisible) return;
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
  function confirmSelection(): void {
    if (multi) commitSelection([...selected]);
    else if (overlayVisible && filtered.length) choose(filtered[clampActive(active, filtered.length)]!);
  }
</script>

<div class="ppp-rel-editor" bind:this={interactionEl}>
  <SearchField
    bind:this={searchField} bind:inputEl readOnly={saving}
    ariaLabel={field.name}
    {query}
    focusOnMount
    inputClass="ppp-rel-picker-search"
    placeholder={$i18n.t("views.dashboard.table-v2.relation-search", { defaultValue: "Search records…" })}
    controls={listId}
    expanded={popupOpen && overlayVisible}
    activeDescendant={overlayVisible && activeIdx >= 0 ? optionDomId(listId, filtered[activeIdx] ?? "") : undefined}
    onConfirm={confirmSelection}
    on:queryChange={(e) => setQuery(e.detail)}
    on:keydown={handleKeydown}
  />
</div>
<FloatingPopup triggerEl={inputEl ?? triggerEl} {interactionEl} bind:open={popupOpen} dismissible={!saving} placement="above-field" role="presentation"
  ariaLabel={field.name} autoFocus={false} on:position={(event) => (overlayVisible = event.detail.visible)} on:close={handlePopupClose}>
<div class="ppp-rel-picker">
  <RelationCountBadge count={selectedIds.length} {loading} />
  {#if multi}<RelationSelection selected={[...selected]} {saving}
    on:remove={(event) => { selected = new Set([...selected].filter(target => target !== event.detail)); }} />{/if}
  <RelationCandidateList {listId} labels={filtered} {selectedIds} active={activeIdx} {multi} {loading} {saving}
    failed={$source.error} showSetup={!hasTargetProject && candidates.length === 0}
    on:choose={(event) => choose(event.detail)} on:retry={() => source.load(field, api, frame)}
    on:setup={() => dispatch("setupRelation")} />
  <RelationPickerActions {multi} {saving} {loading} count={selected.size}
    on:done={() => commitSelection([...selected])} on:clear={() => commitSelection([])} on:cancel={handlePopupClose} />
</div>
</FloatingPopup>

<style>
  .ppp-rel-editor { flex: 1; min-width: 0; }
  .ppp-rel-picker {
    width: 20rem;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

</style>
