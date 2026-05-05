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
  export let pipelineSteps: number = 0;

  $: fieldName = String(config["field"] ?? "");
  $: labelField = String(config["labelField"] ?? "name");
  $: sortField = String(config["sortField"] ?? labelField);
  $: sortOrder = config["sortOrder"] === "desc" ? ("desc" as const) : ("asc" as const);
  $: showMode = ["all", "open", "done"].includes(String(config["showMode"] ?? ""))
    ? String(config["showMode"])
    : "all";
  $: limit = Math.max(0, Number(config["limit"] ?? 0) || 0);
  $: items = deriveItems(source, {
    checkField: fieldName,
    labelField,
    sortField,
    sortOrder,
    showMode,
    limit,
  });

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

  function isChecked(value: unknown): boolean {
    return value === true || value === "true";
  }

  function compareValues(a: unknown, b: unknown): number {
    const an = typeof a === "number" ? a : Number.NaN;
    const bn = typeof b === "number" ? b : Number.NaN;
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
    const as = String(a ?? "").toLowerCase();
    const bs = String(b ?? "").toLowerCase();
    return as.localeCompare(bs);
  }

  function deriveItems(
    df: DataFrame,
    opts: {
      checkField: string;
      labelField: string;
      sortField: string;
      sortOrder: "asc" | "desc";
      showMode: string;
      limit: number;
    }
  ): CheckItem[] {
    if (!opts.checkField) return [];

    const base = df.records.map((r) => {
      const checked = isChecked(r.values[opts.checkField]);
      return {
        id: r.id,
        label: displayName(r.values[opts.labelField] ?? r.values["name"] ?? r.values["title"], r.id),
        checked,
        sortValue: r.values[opts.sortField],
      };
    });

    const filtered = base.filter((item) => {
      if (opts.showMode === "open") return !item.checked;
      if (opts.showMode === "done") return item.checked;
      return true;
    });

    filtered.sort((a, b) => {
      const cmp = compareValues(a.sortValue, b.sortValue);
      return opts.sortOrder === "desc" ? -cmp : cmp;
    });

    const capped = opts.limit > 0 ? filtered.slice(0, opts.limit) : filtered;
    return capped.map(({ id, label, checked }) => ({ id, label, checked }));
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
  <div class="ppp-checklist-rules">
    {$i18n.t("views.dashboard.checklist.rules", { defaultValue: "Source" })}: {source.records.length}
    · {$i18n.t("views.dashboard.checklist.rules-field", { defaultValue: "check" })}={fieldName || "—"}
    · {$i18n.t("views.dashboard.checklist.rules-mode", { defaultValue: "mode" })}={showMode}
    · {$i18n.t("views.dashboard.checklist.rules-sort", { defaultValue: "sort" })}={sortField || "name"} {sortOrder}
    · {$i18n.t("views.dashboard.checklist.rules-pipeline", { defaultValue: "pipeline steps" })}={pipelineSteps}
  </div>
  {#if !fieldName}
    <div class="ppp-widget-empty">{$i18n.t("views.dashboard.checklist.select-field")}</div>
  {:else if items.length === 0}
    <div class="ppp-widget-empty">{$i18n.t("views.dashboard.checklist.no-items")}</div>
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
      {items.filter((i) => i.checked).length} / {items.length} {$i18n.t("views.dashboard.checklist.done")}
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

  .ppp-checklist-rules {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-secondary);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
