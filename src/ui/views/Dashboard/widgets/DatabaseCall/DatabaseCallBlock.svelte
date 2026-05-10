<script lang="ts">
  /**
   * Dashboard V2 (DG-2) — database-call block MVP.
   *
   * Renders ViewTabBar + active tab's view (Table/Board/Calendar/...).
   * Each tab owns its config; switching preserves state. Sprint 2 MVP
   * reuses parent frame; independent source loading deferred to S3+.
   */
  import { createEventDispatcher } from "svelte";
  import type {
    DataFrame,
    DataRecord,
    DataField,
  } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ViewTab, DataTableConfig, FieldPreset } from "../../types";
  import type { ProjectDefinition } from "src/settings/settings";

  import ViewTabBar from "../ViewTabBar.svelte";
  import DataTableWidget from "../DataTable/DataTableWidget.svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let frame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let fields: DataField[];
  export let tableConfig: DataTableConfig | undefined;
  export let fieldPresets: FieldPreset[] = [];
  export let activeFieldPresetId: string | undefined = undefined;
  export let project: ProjectDefinition | undefined = undefined;
  export let config: Record<string, unknown>;

  const dispatch = createEventDispatcher<{
    configChange: Record<string, unknown>;
    tableConfigChange: DataTableConfig;
    fieldPresetsChange: {
      fieldPresets: FieldPreset[];
      activeFieldPresetId: string | undefined;
    };
  }>();

  $: tabs = (config["viewTabs"] as ViewTab[]) ?? [];
  $: activeTabId = String(config["activeTabId"] ?? tabs[0]?.id ?? "");
  $: activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  $: activeTabTableConfig = activeTab?.config as DataTableConfig | undefined;

  function handleTabSwitch(e: CustomEvent<string>) {
    dispatch("configChange", {
      ...config,
      activeTabId: e.detail,
    });
  }

  function handleTabAdd() {
    const newTab: ViewTab = {
      id: `tab-${Date.now()}`,
      label: "New View",
      viewType: "table",
      config: {},
    };
    dispatch("configChange", {
      ...config,
      viewTabs: [...tabs, newTab],
      activeTabId: newTab.id,
    });
  }

  function handleDataTableConfigChange(e: CustomEvent<DataTableConfig>) {
    if (!activeTab) return;
    const updatedTabs = tabs.map((t) =>
      t.id === activeTab.id
        ? { ...t, config: e.detail as unknown as Record<string, unknown> }
        : t
    );
    dispatch("configChange", {
      ...config,
      viewTabs: updatedTabs,
    });
  }
</script>

<div class="ppp-database-call-block">
  {#if tabs.length === 0}
    <div class="ppp-database-call-empty">
      <span class="ppp-database-call-empty-icon">📊</span>
      <span>{$i18n.t("views.dashboard.database-call.empty", {
        defaultValue: "No views configured"
      })}</span>
      <button
        class="ppp-database-call-empty-btn"
        on:click={handleTabAdd}
      >
        {$i18n.t("views.dashboard.database-call.add-first", {
          defaultValue: "Add first view"
        })}
      </button>
    </div>
  {:else}
    <ViewTabBar
      {tabs}
      {activeTabId}
      on:tabSwitch={handleTabSwitch}
      on:tabAdd={handleTabAdd}
    />
    <div
      class="ppp-database-call-content"
      role="tabpanel"
      id="ppp-tab-panel-{activeTabId}"
      aria-labelledby="ppp-tab-{activeTabId}"
    >
      {#if activeTab}
        {#if activeTab.viewType === "table"}
          <DataTableWidget
            {frame}
            {api}
            {readonly}
            {getRecordColor}
            {fields}
            config={activeTabTableConfig}
            {fieldPresets}
            {activeFieldPresetId}
            {project}
            on:configChange={handleDataTableConfigChange}
            on:fieldPresetsChange={(e) => dispatch("fieldPresetsChange", e.detail)}
          />
        {:else}
          <div class="ppp-database-call-placeholder">
            <span>{$i18n.t("views.dashboard.database-call.view-not-implemented", {
              defaultValue: "{{viewType}} view not yet implemented",
              viewType: activeTab.viewType
            })}</span>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .ppp-database-call-block {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .ppp-database-call-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--text-muted);
  }

  .ppp-database-call-empty-icon {
    font-size: 2rem;
  }

  .ppp-database-call-empty-btn {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--interactive-accent);
    cursor: pointer;
    font-size: var(--font-ui-small, 0.875rem);
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-database-call-empty-btn:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-database-call-content {
    flex: 1;
    overflow: auto;
  }

  .ppp-database-call-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--text-faint);
    font-style: italic;
  }
</style>
