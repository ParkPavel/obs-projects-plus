<script lang="ts">
  import type { DataFrame, DataField } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import ChecklistItem from "./ChecklistItem.svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let config: Record<string, unknown>;
  export let source: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let fields: DataField[] = [];

  $: fieldName = String(config["field"] ?? "");
  $: items = deriveItems(source, fieldName);

  interface CheckItem {
    id: string;
    label: string;
    checked: boolean;
  }

  /** Extract display name from wiki-link "[[path|name]]" or fallback to basename */
  function displayName(raw: unknown, id: string): string {
    const s = String(raw ?? "");
    // Match [[....|display]] or [[display]]
    const m = s.match(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/);
    if (m) return m[1]!;
    // Fallback: basename without extension
    if (id) {
      const start = id.lastIndexOf("/") + 1;
      const end = id.lastIndexOf(".");
      if (end > start) return id.substring(start, end);
    }
    return s || id;
  }

  function deriveItems(df: DataFrame, field: string): CheckItem[] {
    if (!field) return [];
    return df.records.map((r) => ({
      id: r.id,
      label: displayName(r.values["name"] ?? r.values["title"], r.id),
      checked: r.values[field] === true || r.values[field] === "true",
    }));
  }

  function handleToggle(item: CheckItem) {
    if (readonly) return;
    const record = source.records.find((r) => r.id === item.id);
    if (!record) return;
    const updated = { id: record.id, values: { ...record.values, [fieldName]: !item.checked } };
    api.updateRecord(updated, fields.length ? fields : source.fields);
  }
</script>

<div class="ppp-checklist-widget">
  {#if !fieldName}
    <div class="ppp-widget-empty">{$i18n.t("views.database.checklist.select-field")}</div>
  {:else if items.length === 0}
    <div class="ppp-widget-empty">{$i18n.t("views.database.checklist.no-items")}</div>
  {:else}
    <ul class="ppp-checklist-list">
      {#each items as item (item.id)}
        <ChecklistItem
          {item}
          {readonly}
          on:toggle={() => handleToggle(item)}
        />
      {/each}
    </ul>
    <div class="ppp-checklist-footer">
      {items.filter((i) => i.checked).length} / {items.length} {$i18n.t("views.database.checklist.done")}
    </div>
  {/if}
</div>

<style>
  .ppp-checklist-widget {
    padding: 0.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ppp-checklist-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    max-height: 20rem;
    overflow-y: auto;
  }

  .ppp-checklist-footer {
    padding: 0.25rem 0.5rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    text-align: right;
    border-top: 1px solid var(--background-modifier-border);
  }

  .ppp-widget-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    color: var(--text-faint);
    font-style: italic;
  }
</style>
