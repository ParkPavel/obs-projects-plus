<script lang="ts">
  // MPLAN-008 — Minimalist list rendering of dataframe records.
  // Pipeline (filter / sort / transform) is applied upstream by
  // `WidgetHost.svelte`; this widget owns rendering only.

  import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
  import type { DataListConfig } from "../../types";
  import { deriveListItems } from "./deriveListItems";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { setContext } from "svelte";
  import RelationListView from "src/ui/views/YamlVisualizer/RelationListView.svelte";
  import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";

  export let config: Record<string, unknown> | undefined = undefined;
  export let source: DataFrame;
  export let pipelineSteps: number = 0;

  $: listConfig = (config ?? { fields: [] }) as unknown as DataListConfig;
  $: items = deriveListItems(source, listConfig);

  // #045.3 — RelationListView reads `sourcePath` from Svelte context to
  // route clicks through `app.workspace.openLinkText(link, sourcePath)`.
  // The first record's id is a reasonable default for the source path.
  $: setContext("sourcePath", source.records[0]?.id ?? "");

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

<div class="ppp-list-widget">
  <div class="ppp-list-rules">
    {$i18n.t("views.dashboard.list.rules", { defaultValue: "Records" })}: {source.records.length}
    · {$i18n.t("views.dashboard.list.rules-fields", { defaultValue: "fields" })}={(listConfig.fields ?? []).length}
    · {$i18n.t("views.dashboard.checklist.rules-pipeline", { defaultValue: "pipeline steps" })}={pipelineSteps}
  </div>
  {#if items.length === 0}
    <div class="ppp-widget-empty">
      {$i18n.t("views.dashboard.list.empty", { defaultValue: "No records" })}
    </div>
  {:else}
    <ul class="ppp-list">
      {#each items as item (item.id)}
        <li class="ppp-list-row">
          <button
            type="button"
            class="ppp-list-title"
            on:click={() => open(item.id)}
            on:auxclick={(e) => { if (e.button === 1) open(item.id, "tab"); }}
            title={item.title}
          >{item.title}</button>
          {#if item.fields.length > 0}
            <span class="ppp-list-fields">
              {#each item.fields as f (f.name)}
                {#if f.type === DataFieldType.Relation}
                  {@const links = parseRelationLinks(f.value)}
                  {#if links.length > 0}
                    <span class="ppp-list-field">
                      <span class="ppp-list-field-name">{f.name}</span>
                      <span class="ppp-list-field-value ppp-list-field-value--relation">
                        <RelationListView items={links} maxVisible={3} />
                      </span>
                    </span>
                  {/if}
                {:else}
                  {@const text = format(f.value)}
                  {#if text}
                    <span class="ppp-list-field">
                      <span class="ppp-list-field-name">{f.name}</span>
                      <span class="ppp-list-field-value">{text}</span>
                    </span>
                  {/if}
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
  .ppp-list-widget {
    padding: 0.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .ppp-list-rules {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-secondary);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ppp-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  .ppp-list-row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }
  .ppp-list-row:last-child {
    border-bottom: none;
  }
  .ppp-list-title {
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
  .ppp-list-title:hover {
    text-decoration: underline;
  }
  .ppp-list-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    overflow: hidden;
  }
  .ppp-list-field {
    display: inline-flex;
    gap: 0.25rem;
    align-items: baseline;
  }
  .ppp-list-field-name {
    color: var(--text-faint);
  }
  .ppp-list-field-value {
    color: var(--text-normal);
  }
  /* #045.3 — relation value wrapper aligns the inline pill list with
     adjacent baseline-aligned text values; the pills themselves carry
     their own background and chip styling from RelationListView. */
  .ppp-list-field-value--relation {
    display: inline-flex;
    align-items: center;
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
