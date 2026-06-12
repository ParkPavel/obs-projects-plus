<script lang="ts">
  /**
   * RelationPickerPopover — #081 (W1, NOTION_GRADE_PIPELINE). The Relation
   * cell editor: search + (multi)select over the records of the target
   * project (`RelationFieldConfig.targetProjectId` via
   * `api.resolveExternalFrame`), falling back to wikilink targets already
   * present in this column. Single-select commits on click; multi-select
   * accumulates and commits on Done. Esc cancels.
   */
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataField, DataFrame, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { RelationFieldConfig } from "src/settings/base/settings";
  import { wikilinkLabels } from "./tableCanon";

  export let field: DataField;
  export let value: Optional<DataValue>;
  export let api: ViewApi;
  export let frame: DataFrame;

  const dispatch = createEventDispatcher<{
    commit: Optional<DataValue>;
    cancel: void;
  }>();

  $: multi = field.repeated === true;

  let query = "";
  let inputEl: HTMLInputElement | null = null;
  let candidates: string[] = [];
  let loading = true;

  function baseName(id: string): string {
    return (id.split("/").pop() ?? id).replace(/\.md$/, "");
  }

  function currentLabels(): string[] {
    if (Array.isArray(value)) return value.flatMap((v) => wikilinkLabels(String(v)));
    if (typeof value === "string" && value) return wikilinkLabels(value);
    return [];
  }

  let selected = new Set(currentLabels());

  onMount(async () => {
    const rel = (field.typeConfig as { relation?: RelationFieldConfig } | undefined)?.relation;
    if (rel?.targetProjectId && api.resolveExternalFrame) {
      const target = await api.resolveExternalFrame(rel.targetProjectId).catch(() => null);
      candidates = target?.records.map((r) => baseName(r.id)) ?? [];
    }
    if (candidates.length === 0) {
      // Fallback: every wikilink target already used in this column.
      const seen = new Set<string>();
      for (const r of frame.records) {
        const v = r.values[field.name];
        for (const raw of Array.isArray(v) ? v : v != null ? [v] : []) {
          for (const label of wikilinkLabels(String(raw))) seen.add(label);
        }
      }
      candidates = [...seen];
    }
    candidates.sort((a, b) => a.localeCompare(b));
    loading = false;
    await tick();
    inputEl?.focus();
  });

  $: filtered = candidates.filter(
    (c) => query.trim() === "" || c.toLowerCase().includes(query.trim().toLowerCase())
  );

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
    if (e.key === "Escape") {
      e.preventDefault();
      dispatch("cancel");
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      choose(filtered[0]!);
    }
  }
</script>

<div class="ppp-rel-picker" role="dialog" aria-label={field.name}>
  <input
    bind:this={inputEl}
    class="ppp-rel-picker-search"
    type="text"
    bind:value={query}
    placeholder={$i18n.t("views.dashboard.table-v2.relation-search", { defaultValue: "Search records…" })}
    on:keydown={handleKeydown}
  />
  <div class="ppp-rel-picker-list" role="listbox" aria-multiselectable={multi}>
    {#if loading}
      <span class="ppp-rel-picker-hint">…</span>
    {:else if filtered.length === 0}
      <span class="ppp-rel-picker-hint">
        {$i18n.t("views.dashboard.table-v2.relation-empty", { defaultValue: "No records to link" })}
      </span>
    {:else}
      {#each filtered as label (label)}
        <button
          class="ppp-rel-picker-item"
          role="option"
          aria-selected={selected.has(label)}
          on:mousedown|preventDefault={() => choose(label)}
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
      <button class="ppp-rel-picker-done mod-cta" on:mousedown|preventDefault={() => commitSelection([...selected])}>
        {$i18n.t("views.dashboard.table-v2.relation-done", { defaultValue: "Done" })}
      </button>
    {/if}
    <button class="ppp-rel-picker-cancel" on:mousedown|preventDefault={() => dispatch("cancel")}>
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

  .ppp-rel-picker-search {
    height: 1.75rem;
    font-size: var(--font-ui-small);
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

  .ppp-rel-picker-item:hover {
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
