<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";
  import { focusTrap } from "src/lib/a11y/focusTrap";
  import type {
    ProjectDefinition,
    ProjectId,
    ViewDefinition,
    ViewId,
  } from "../../../../settings/settings";
  import type { FilterDefinition } from "src/settings/base/settings";
  import type { DataSource as StoredDataSource } from "src/settings/v3/settings";
  import { sourceNameTaken } from "src/lib/datasources/namedSource";
  import { dataFrame } from "../../../../lib/stores/dataframe";
  import { applyRollupColumns } from "src/lib/relations/rollupColumns";
  import SettingsMenuTabs, { type SettingsTabId } from "./SettingsMenuTabs.svelte";
  import ProjectTab from "./tabs/ProjectTab.svelte";
  import ViewsTab from "./tabs/ViewsTab.svelte";
  import FilterPanel from "src/ui/components/FilterPanel/FilterPanel.svelte";
  import ColorFiltersTab from "./tabs/ColorFiltersTab.svelte";
  import SortTab from "./tabs/SortTab.svelte";
  import ViewConfigTab from "./tabs/ViewConfigTab.svelte";
  import { i18n } from "../../../../lib/stores/i18n";
  import { isTouchDevice } from "../../../../lib/stores/ui";

  export let projects: ProjectDefinition[] = [];
  export let projectId: ProjectId | undefined;
  export let views: ViewDefinition[] = [];
  export let viewId: ViewId | undefined;
  export let position: { x: number; y: number } = { x: 0, y: 0 };
  export let fields: Array<{ name: string; type: string; derived?: boolean }> = [];
  export let showViewTitles: boolean = true;
  /**
   * chrome-filters: whether the project's source can be written. A read-only
   * source cannot take a new derived source, so the Filters tab offers no
   * "Save as source" there (the shell guards the write as well).
   */
  export let readonly = false;
  /** The project's sources, for the duplicate-name guard of "Save as source". */
  export let sources: readonly StoredDataSource[] = [];

  // Get fields from dataFrame store if not passed as prop. `derived` travels
  // too: the gallery's card-field list marks formulas and rollups with ƒ.
  // chrome-filters: the store holds the notes' own fields; the view folds the
  // project's declared rollups in as columns later (View.svelte), so a card
  // could show a rollup the settings never listed. The declared rollups are
  // added here the same way the view adds them (no records, so no values).
  $: activeProject = projects.find((p) => p.id === projectId);
  $: storeFields = $dataFrame?.fields ?? [];
  $: frameFields = activeProject?.fieldConfig
    ? applyRollupColumns({ fields: storeFields, records: [] }, activeProject.fieldConfig, activeProject.id, new Map()).fields
    : storeFields;
  $: resolvedFields = fields.length > 0 ? fields : frameFields.map(f => ({ name: f.name, type: f.type, derived: f.derived }));
  
  // Get records from dataFrame for value suggestions
  $: resolvedRecords = $dataFrame?.records ?? [];

  const dispatch = createEventDispatcher<{
    close: void;
    projectChange: ProjectId;
    viewChange: ViewId;
    addProject: void;
    createDemo: void;
    editProject: ProjectId;
    deleteProject: ProjectId;
    addView: void;
    updateViewConfig: Record<string, any>;
    toggleShowViewTitles: boolean;
    /** #184 / chrome-filters: the trimmed, unused name for the view's filter. */
    saveFilterAsSource: string;
  }>();

  let activeTab: SettingsTabId = "viewConfig";
  
  // Calculate safe position avoiding Obsidian sidebars and header overlap
  let safePosition: { top: string; right: string; left: string; maxHeight: string | null } =
    { top: '3.5rem', right: '0.5rem', left: 'auto', maxHeight: null };

  /**
   * ios-l1: on touch the panel must not cover the plugin's own navbar. The
   * 56 floor below is Obsidian's header, and a phone's plugin navbar sits well
   * under it, so the panel landed on top of the tabs and buttons it configures.
   * Found through this panel's own leaf — `document.querySelector` could
   * answer with another leaf's navbar. Null off touch and when not found, so
   * desktop keeps exactly the position it always had.
   */
  function navbarBottom(): number | null {
    if (!$isTouchDevice || !popoverElement) return null;
    const nav = popoverElement.closest(".projects-container")?.querySelector(":scope > .compact-navbar");
    return nav ? nav.getBoundingClientRect().bottom : null;
  }
  
  function calculateSafePosition() {
    // Find Obsidian sidebars
    const leftSidebar = activeDocument.querySelector('.workspace-split.mod-horizontal.mod-left-split');
    const rightSidebar = activeDocument.querySelector('.workspace-split.mod-horizontal.mod-right-split');
    const ribbonLeft = activeDocument.querySelector('.workspace-ribbon.mod-left');
    
    let leftOffset = 0;
    let rightOffset = 0;
    
    // Check left sidebar
    if (leftSidebar && !leftSidebar.classList.contains('is-sidedock-collapsed')) {
      const leftRect = leftSidebar.getBoundingClientRect();
      leftOffset = leftRect.right;
    }
    
    // Check ribbon (leftmost bar with icons)
    if (ribbonLeft) {
      const ribbonRect = ribbonLeft.getBoundingClientRect();
      if (ribbonRect.right > leftOffset) {
        leftOffset = ribbonRect.right;
      }
    }
    
    // Check right sidebar
    if (rightSidebar && !rightSidebar.classList.contains('is-sidedock-collapsed')) {
      const rightRect = rightSidebar.getBoundingClientRect();
      rightOffset = window.innerWidth - rightRect.left;
    }
    
    // Position within viewport, anchored near click point and accounting for sidebars
    const anchoredTopPx = Math.max(56, Math.min(window.innerHeight - 120, (position?.y ?? 60) + 8));
    // Touch: never above the navbar's bottom edge, and only as tall as the
    // room left beneath it — the panel then scrolls as a whole (see the
    // `--below-nav` rule), because its tab area alone has a floor taller than
    // a landscape phone leaves.
    const navBottom = navbarBottom();
    const topPx = navBottom === null ? anchoredTopPx : Math.max(anchoredTopPx, navBottom + 8);

    safePosition = {
      top: `${topPx / 16}rem`,
      right: `${Math.max(0.5, rightOffset / 16 + 0.5)}rem`,
      left: 'auto',
      maxHeight: navBottom === null ? null : `${Math.max(0, window.innerHeight - topPx - 8) / 16}rem`,
    };
  }

  function handleOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target?.closest?.("[data-settings-dropdown]")) return;
    const path = event.composedPath();
    if (popoverElement && !path.includes(popoverElement)) {
      // defer close to allow click handlers to finish
      setTimeout(() => dispatch("close"), 0);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      // chrome-filters: Escape in the source-name field abandons the name, not
      // the whole panel. This listener runs in the capture phase, before the
      // field's own, so it has to know.
      if (naming) {
        cancelNaming();
        return;
      }
      dispatch("close");
    }
  }

  let popoverElement: HTMLElement | null = null;

  onMount(() => {
    activeDocument.addEventListener("mousedown", handleOutside, true);
    activeDocument.addEventListener("keydown", handleKeydown, true);
    // Calculate position after mount
    setTimeout(calculateSafePosition, 0);
  });

  $: if (position) {
    calculateSafePosition();
  }

  onDestroy(() => {
    activeDocument.removeEventListener("mousedown", handleOutside, true);
    activeDocument.removeEventListener("keydown", handleKeydown, true);
  });

  $: activeView = views.find((view) => view.id === viewId);
  let currentFilter: FilterDefinition;
  $: currentFilter = activeView?.filter ?? { conjunction: "and", conditions: [] };
  $: currentColors = activeView?.colors ?? { conditions: [] };
  $: currentSort = activeView?.sort ?? { criteria: [] };

  // ── chrome-filters: the Filters tab is the one place a view is filtered ──
  // The header filter row is gone, so this tab carries what it did: how many
  // conditions are narrowing the view, a way to drop them all at once, and
  // "Save as source" (#184).

  /** Enabled conditions, nested groups included. */
  function enabledCount(def: FilterDefinition | undefined): number {
    if (!def) return 0;
    const own = def.conditions.filter((c) => c.enabled !== false).length;
    return own + (def.groups ?? []).reduce((sum, g) => sum + enabledCount(g), 0);
  }
  $: activeConditionCount = enabledCount(currentFilter);
  $: hasAnyCondition = currentFilter.conditions.length > 0 || (currentFilter.groups?.length ?? 0) > 0;
  // FilterPanel copies its value once, on mount; a clear made here must reach
  // it, so the panel is re-keyed when the filter is cleared from outside it,
  // and remounts empty even before the cleared filter comes back as a prop.
  let filterPanelKey = 0;
  let pendingClear = false;
  const EMPTY_FILTER: FilterDefinition = { conjunction: "and", conditions: [] };
  function settleClear(_saved: FilterDefinition): void {
    pendingClear = false;
  }
  $: settleClear(currentFilter);
  $: panelFilter = pendingClear ? EMPTY_FILTER : currentFilter;

  function clearFilter() {
    dispatch("updateViewConfig", { filter: { conjunction: "and", conditions: [] } });
    pendingClear = true;
    filterPanelKey += 1;
    cancelNaming();
  }

  // #184: the action exists only once a top-level condition is narrowing the
  // view — a saved selection with nothing enabled equals the project it came
  // from — and never on a source that cannot be written.
  $: canSaveSource = !readonly && currentFilter.conditions.some((c) => c.enabled !== false);
  let naming = false;
  let sourceName = "";
  let nameError = "";
  let nameEl: HTMLInputElement | null = null;
  // The action can disappear while a name is half typed (the last condition
  // disabled, the source turning read-only); the naming state goes with it, so
  // Escape closes the panel again instead of cancelling an invisible field.
  $: if (!canSaveSource && naming) cancelNaming();

  async function startNaming() {
    naming = true;
    sourceName = "";
    nameError = "";
    await tick();
    nameEl?.focus();
  }

  function cancelNaming() {
    naming = false;
    sourceName = "";
    nameError = "";
  }

  function commitName() {
    if (!naming) return;
    const trimmed = sourceName.trim();
    // A blank name is a cancel, not an unnamed source: the name is the only
    // thing that will identify this selection in a picker later.
    if (!trimmed) {
      cancelNaming();
      return;
    }
    // Refused here, where the user can still change it; the shell refuses a
    // taken name again with its coded notice (PPP-701).
    if (sourceNameTaken(sources, trimmed)) {
      nameError = $i18n.t("views.filter.bar.save-name-taken", { name: trimmed });
      return;
    }
    cancelNaming();
    dispatch("saveFilterAsSource", trimmed);
  }

  function handleNameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitName();
    } else if (event.key === "Escape") {
      cancelNaming();
    }
  }
</script>

{#if position}
  <div
    class="settings-popover-overlay"
    role="presentation"
    on:click|self={() => dispatch("close")}
  >
    <div 
      class="settings-popover"
      class:settings-popover--below-nav={safePosition.maxHeight !== null}
      bind:this={popoverElement}
      use:focusTrap
      role="dialog" 
      aria-modal="true" 
      tabindex="-1"
      style="top: {safePosition.top}; right: {safePosition.right}; left: {safePosition.left};"
      style:max-height={safePosition.maxHeight}
    >
      <div class="popover-header">
        <h3>{$i18n.t('settings-menu.title')}</h3>
        <button class="close-btn" on:click={() => dispatch("close")} aria-label={$i18n.t('common.close')}>×</button>
      </div>
      
      <SettingsMenuTabs activeTab={activeTab} on:change={(event) => (activeTab = event.detail)} />

      <div class="tab-content">
        {#if activeTab === "projects"}
          <ProjectTab
            {projects}
            {projectId}
            on:select={(event) => dispatch("projectChange", event.detail)}
            on:addProject={() => dispatch("addProject")}
            on:createDemo={() => dispatch("createDemo")}
            on:editProject={(event) => dispatch("editProject", event.detail)}
            on:deleteProject={(event) => dispatch("deleteProject", event.detail)}
          />
        {:else if activeTab === "views"}
          <ViewsTab
            {views}
            {viewId}
            {projectId}
            {showViewTitles}
            on:select={(event) => dispatch("viewChange", event.detail)}
            on:addView={() => dispatch("addView")}
            on:toggleShowTitles={(event) => dispatch("toggleShowViewTitles", event.detail)}
          />
        {:else if activeTab === "filters"}
          <div class="ppp-filters-tab">
            <div class="ppp-filters-summary" data-filters-summary>
              <span class="ppp-filters-summary-text" data-filters-active={activeConditionCount}>
                {activeConditionCount > 0
                  ? $i18n.t("settings-menu.filters.active", { count: activeConditionCount, defaultValue: "Active conditions: {{count}}" })
                  : $i18n.t("settings-menu.filters.none-active", { defaultValue: "No active conditions" })}
              </span>
              {#if hasAnyCondition}
                <button type="button" class="ppp-filters-clear" data-filters-action="clear" on:click={clearFilter}>
                  {$i18n.t("settings-menu.filters.clear-all", { defaultValue: "Clear all" })}
                </button>
              {/if}
            </div>
            {#key filterPanelKey}
              <FilterPanel
                value={panelFilter}
                fields={resolvedFields}
                records={resolvedRecords}
                scopeLabel={$i18n.t('settings.filters.scope-view', { defaultValue: 'View filter' })}
                on:update={(event) => dispatch("updateViewConfig", { filter: event.detail })}
              />
            {/key}
            {#if canSaveSource}
              <div class="ppp-filters-save" data-filters-save>
                {#if naming}
                  <input
                    bind:this={nameEl}
                    class="ppp-filters-save-name"
                    type="text"
                    bind:value={sourceName}
                    placeholder={$i18n.t("views.filter.bar.save-name", { defaultValue: "Name this selection…" })}
                    aria-label={$i18n.t("views.filter.bar.save-name", { defaultValue: "Name this selection…" })}
                    aria-invalid={nameError !== ""}
                    on:input={() => (nameError = "")}
                    on:keydown={handleNameKeydown}
                  />
                  <div class="ppp-filters-save-actions">
                    <button type="button" class="mod-cta" data-filters-action="save-confirm" on:click={commitName}>
                      {$i18n.t("common.save")}
                    </button>
                    <button type="button" data-filters-action="save-cancel" on:click={cancelNaming}>
                      {$i18n.t("common.cancel")}
                    </button>
                  </div>
                  {#if nameError}
                    <span class="ppp-filters-save-error" role="alert">{nameError}</span>
                  {/if}
                {:else}
                  <button
                    type="button"
                    class="ppp-filters-save-start"
                    data-filters-action="save"
                    on:click={startNaming}
                  >{$i18n.t("views.filter.bar.save", { defaultValue: "Save as source" })}</button>
                  <span class="ppp-filters-save-hint">{$i18n.t("views.filter.bar.save-tip", { defaultValue: "Keep this filter as a source of the project, so a block can show it" })}</span>
                {/if}
              </div>
            {/if}
          </div>
        {:else if activeTab === "colors"}
          <ColorFiltersTab
            value={currentColors}
            fields={resolvedFields}
            records={resolvedRecords}
            on:update={(event) => dispatch("updateViewConfig", { colors: event.detail })}
          />
        {:else if activeTab === "sort"}
          <SortTab
            value={currentSort}
            fields={resolvedFields}
            on:update={(event) => dispatch("updateViewConfig", { sort: event.detail })}
          />
        {:else if activeTab === "viewConfig"}
          <ViewConfigTab
            view={activeView}
            fields={resolvedFields}
            on:update={(event) => dispatch("updateViewConfig", event.detail)}
            on:navigateTab={(event) => (activeTab = event.detail)}
          />
        {/if}
      </div>

      <div class="popover-footer">
        <button class="btn-primary" on:click={() => dispatch("close")}>{$i18n.t('settings-menu.done')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-popover-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--ppp-z-overlay, 30);
    background: transparent;
    pointer-events: auto;
  }

  .settings-popover {
    position: absolute;
    top: 3.5rem;
    right: 0.5rem;
    left: auto;
    width: min(22rem, calc(100% - 1rem));
    max-height: calc(100% - 5rem);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 0.75rem;
    background: var(--background-primary);
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    box-shadow: var(--shadow-lg, 0 0.5rem 2rem rgba(0, 0, 0, 0.25));
    pointer-events: auto;
    z-index: var(--ppp-z-modal, 40);
    animation: ppp-popover-enter var(--ppp-duration-slow, 0.25s) var(--ppp-ease-out, cubic-bezier(0, 0, 0.2, 1));
  }

  /* ios-l1: below the navbar on touch the room can be shorter than the tab
     area's own floor, so the panel scrolls as one instead of clipping the
     footer's "Done" out of reach. */
  .settings-popover--below-nav {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .settings-popover--below-nav .tab-content {
    flex: 0 0 auto;
    max-height: none;
    overflow-y: visible;
  }

  @keyframes ppp-popover-enter {
    from {
      opacity: 0;
      transform: translateY(-0.25rem) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: var(--ppp-border-width) solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .popover-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    width: 2rem;
    height: 2rem;
    min-width: 2rem;
    min-height: 2rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color var(--ppp-duration-fast, 0.1s) ease,
                color var(--ppp-duration-fast, 0.1s) ease;
  }

  @media (hover: hover) and (pointer: fine) {
    .close-btn:hover {
      background: var(--background-modifier-hover);
      color: var(--text-normal);
    }
  }

  /* ios-t1: the close button is the panel's only corner exit on a phone, so it
     is finger-sized there; the header row grows to hold it. */
  @media (pointer: coarse) {
    .close-btn {
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
      min-width: var(--ppp-touch-target-min);
      min-height: var(--ppp-touch-target-min);
    }
  }

  .tab-content {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1rem;
    min-height: 10rem;
    max-height: calc(100vh - 20rem);
    overscroll-behavior: contain;
  }

  /* chrome-filters: the Filters tab — summary row, the panel, then "Save as
     source". Everything wraps inside the panel's width; nothing here sets a
     width of its own. */
  .ppp-filters-tab {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .ppp-filters-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }

  .ppp-filters-summary-text {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    min-width: 0;
  }

  .ppp-filters-clear,
  .ppp-filters-save-start,
  .ppp-filters-save-actions button {
    min-height: 2rem;
    font-size: var(--font-ui-small);
  }

  .ppp-filters-save {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding-top: 0.5rem;
    border-top: var(--ppp-border-width) solid var(--background-modifier-border);
    min-width: 0;
  }

  .ppp-filters-save-start {
    align-self: flex-start;
  }

  .ppp-filters-save-name {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .ppp-filters-save-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .ppp-filters-save-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
  }

  .ppp-filters-save-error {
    font-size: var(--font-ui-smaller);
    color: var(--text-error);
  }

  /* ios-t1 conventions: finger-sized controls on a coarse pointer. */
  @media (pointer: coarse) {
    .ppp-filters-clear,
    .ppp-filters-save-start,
    .ppp-filters-save-actions button,
    .ppp-filters-save-name {
      min-height: var(--ppp-touch-target-min);
    }
  }

  .popover-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-start;
    padding: 0.75rem 1rem;
    border-top: var(--ppp-border-width) solid var(--background-modifier-border);
  }

  .btn-primary {
    padding: 0.5rem 1.25rem;
    border-radius: 0.5rem;
    border: none;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    min-height: 2.75rem;
  }

  @media (hover: hover) and (pointer: fine) {
    .btn-primary:hover {
      opacity: 0.9;
    }
  }

  /* Responsive for smaller containers */
  @media (max-width: 30rem) {
    .settings-popover {
      width: calc(100% - 1rem);
      max-height: calc(100% - 6rem);
      top: 3rem;
      right: 0.5rem;
    }
  }
</style>
