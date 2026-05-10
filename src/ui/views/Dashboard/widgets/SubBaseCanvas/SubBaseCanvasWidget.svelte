<script lang="ts">
  // R5-009 — Sub-base canvas widget. Displays a tab strip; the active
  // sub-base's filtered records render below as a list (title + inline
  // fields). Sub-base CRUD is owned by this widget, decoupled from
  // DataTable.

  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { SubBaseCanvasConfig } from "../../types";
  import type { SubBaseDefinition } from "src/lib/database/subBase";
  import { createSubBase } from "src/lib/database/subBase";
  import SubBaseTabs from "../DataTable/SubBaseTabs.svelte";
  import { deriveSubBaseItems, type SubBaseLike } from "./deriveSubBasePartition";
  import { resolveInverseAcrossSubBases } from "src/lib/relations/crossSubBase";
  import { deriveListItems } from "../DataList/deriveListItems";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { createEventDispatcher } from "svelte";

  export let config: Record<string, unknown> | undefined = undefined;
  export let source: DataFrame;
  export let readonly = false;

  const dispatch = createEventDispatcher<{ change: SubBaseCanvasConfig }>();

  $: cfg = (config ?? { subBases: [], fields: [] }) as unknown as SubBaseCanvasConfig;
  $: subBases = cfg.subBases ?? [];
  $: tabsModel = subBases.map(
    (sb): SubBaseDefinition => ({
      id: sb.id,
      name: sb.name,
      filter: sb.filter,
      inheritColumns: true,
    })
  );
  $: activeId = cfg.activeSubBaseId ?? subBases[0]?.id ?? null;
  $: active = activeId ? subBases.find((sb) => sb.id === activeId) : undefined;
  $: activeLike = active
    ? ({ id: active.id, name: active.name, filter: active.filter } satisfies SubBaseLike)
    : undefined;

  // R5-010 inverse mode: find sources that reference inverseTargetId via inverseRelationField,
  // partitioned by SubBase predicates. Falls back to normal forward derivation when not configured.
  // Matching is flexible: exact ID, then basename (no extension), then name/title field value.
  // This lets the config store a short user-friendly key like "ProjectA" instead of the full path.
  $: inverseTarget = (() => {
    const key = cfg.inverseTargetId;
    if (!key) return undefined;
    return (
      source.records.find((r) => r.id === key) ??
      source.records.find((r) => {
        const slash = Math.max(r.id.lastIndexOf("/"), r.id.lastIndexOf("\\"));
        const base = slash >= 0 ? r.id.slice(slash + 1) : r.id;
        const dot = base.lastIndexOf(".");
        const name = dot > 0 ? base.slice(0, dot) : base;
        return name.toLowerCase() === key.toLowerCase();
      }) ??
      source.records.find((r) => {
        for (const f of ["name", "title", "Name", "Title"]) {
          const v = r.values[f];
          if (typeof v === "string" && v.toLowerCase() === key.toLowerCase()) return true;
        }
        return false;
      })
    );
  })();
  $: inverseResults =
    inverseTarget && cfg.inverseRelationField
      ? resolveInverseAcrossSubBases(inverseTarget, cfg.inverseRelationField, source, tabsModel)
      : null;

  $: items = (() => {
    if (inverseResults && activeId) {
      const match = inverseResults.find((r) => r.subBaseId === activeId);
      // Wrap the inverse DataRecord[] as a minimal frame so deriveListItems
      // can project titleField + inline fields without duplicating logic.
      const syntheticFrame = { fields: source.fields, records: match?.targets ?? [] };
      return deriveListItems(syntheticFrame, {
        ...(cfg.titleField !== undefined ? { titleField: cfg.titleField } : {}),
        fields: cfg.fields ?? [],
        ...(cfg.limit !== undefined ? { limit: cfg.limit } : {}),
      });
    }
    return deriveSubBaseItems(source, activeLike, {
      ...(cfg.titleField !== undefined ? { titleField: cfg.titleField } : {}),
      fields: cfg.fields ?? [],
      ...(cfg.limit !== undefined ? { limit: cfg.limit } : {}),
    });
  })();

  function emit(next: SubBaseCanvasConfig): void {
    dispatch("change", next);
  }

  function handleSelect(e: CustomEvent<{ id: string }>): void {
    emit({ ...cfg, activeSubBaseId: e.detail.id });
  }

  function handleAdd(): void {
    const id = `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const name = $i18n.t("views.dashboard.sub-base.new", { defaultValue: "New tab" });
    const created = createSubBase(id, name);
    const next = [
      ...subBases,
      { id: created.id, name: created.name, filter: created.filter },
    ];
    emit({ ...cfg, subBases: next, activeSubBaseId: id });
  }

  function handleRename(e: CustomEvent<{ id: string; name: string }>): void {
    const next = subBases.map((sb) =>
      sb.id === e.detail.id ? { ...sb, name: e.detail.name } : sb
    );
    emit({ ...cfg, subBases: next });
  }

  function handleRemove(e: CustomEvent<{ id: string }>): void {
    const next = subBases.filter((sb) => sb.id !== e.detail.id);
    const nextActive = activeId === e.detail.id ? next[0]?.id : activeId;
    emit({
      ...cfg,
      subBases: next,
      ...(nextActive !== undefined ? { activeSubBaseId: nextActive } : { activeSubBaseId: undefined as unknown as string }),
    });
  }

  function format(value: unknown): string {
    if (value == null || value === "") return "";
    if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }

  function open(id: string, mode: false | "tab" = false) {
    $app.workspace.openLinkText(id, id, mode);
  }
</script>

<div class="ppp-sbc-widget">
  <SubBaseTabs
    subBases={tabsModel}
    activeId={activeId}
    {readonly}
    on:select={handleSelect}
    on:add={handleAdd}
    on:rename={handleRename}
    on:remove={handleRemove}
  />

  <div class="ppp-sbc-rules">
    {$i18n.t("views.dashboard.sub-base.rules", { defaultValue: "Records" })}: {items.length}
    · {$i18n.t("views.dashboard.sub-base.tabs", { defaultValue: "tabs" })}={subBases.length}
    {#if inverseResults}· ↩ inverse{/if}
  </div>

  {#if subBases.length === 0}
    <div class="ppp-widget-empty">
      {$i18n.t("views.dashboard.sub-base.empty", { defaultValue: "Add a tab to get started" })}
    </div>
  {:else if items.length === 0}
    <div class="ppp-widget-empty">
      {$i18n.t("views.dashboard.sub-base.no-records", { defaultValue: "No records match this tab" })}
    </div>
  {:else}
    <ul class="ppp-sbc-list">
      {#each items as item (item.id)}
        <li class="ppp-sbc-row">
          <button
            type="button"
            class="ppp-sbc-title"
            on:click={() => open(item.id)}
            on:auxclick={(e) => { if (e.button === 1) open(item.id, "tab"); }}
            title={item.title}
          >{item.title}</button>
          {#if item.fields.length > 0}
            <span class="ppp-sbc-fields">
              {#each item.fields as f (f.name)}
                {@const text = format(f.value)}
                {#if text}
                  <span class="ppp-sbc-field">
                    <span class="ppp-sbc-field-name">{f.name}</span>
                    <span class="ppp-sbc-field-value">{text}</span>
                  </span>
                {/if}
              {/each}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .ppp-sbc-widget {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.375rem;
  }
  .ppp-sbc-rules {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-secondary);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ppp-sbc-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  .ppp-sbc-row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }
  .ppp-sbc-row:last-child { border-bottom: none; }
  .ppp-sbc-title {
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--link-color);
    cursor: pointer;
    text-align: left;
    flex: 0 0 auto;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-sbc-title:hover { text-decoration: underline; }
  .ppp-sbc-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    overflow: hidden;
  }
  .ppp-sbc-field {
    display: inline-flex;
    gap: 0.25rem;
    align-items: baseline;
  }
  .ppp-sbc-field-name { color: var(--text-faint); }
  .ppp-sbc-field-value { color: var(--text-normal); }
  .ppp-widget-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    color: var(--text-faint);
    font-style: italic;
  }
</style>
