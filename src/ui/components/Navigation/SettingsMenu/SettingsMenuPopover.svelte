<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import type {
    ProjectDefinition,
    ProjectId,
    ViewDefinition,
    ViewId,
  } from "../../../../settings/settings";
  import { dataFrame } from "../../../../lib/stores/dataframe";
  import SettingsMenuTabs, { type SettingsTabId } from "./SettingsMenuTabs.svelte";
  import ProjectTab from "./tabs/ProjectTab.svelte";
  import ViewsTab from "./tabs/ViewsTab.svelte";
  import FiltersTab from "./tabs/FiltersTab.svelte";
  import ColorFiltersTab from "./tabs/ColorFiltersTab.svelte";
  import SortTab from "./tabs/SortTab.svelte";
  import ViewConfigTab from "./tabs/ViewConfigTab.svelte";

  export let projects: ProjectDefinition[] = [];
  export let projectId: ProjectId | undefined;
  export let views: ViewDefinition[] = [];
  export let viewId: ViewId | undefined;
  export let position: { x: number; y: number } = { x: 0, y: 0 };
  export let fields: Array<{ name: string; type: string }> = [];
  export let showViewTitles: boolean = true;

  // Get fields from dataFrame store if not passed as prop
  $: resolvedFields = fields.length > 0 ? fields : ($dataFrame?.fields ?? []).map(f => ({ name: f.name, type: f.type }));
  
  // Get records from dataFrame for value suggestions
  $: resolvedRecords = $dataFrame?.records ?? [];

  const dispatch = createEventDispatcher<{
    close: void;
    projectChange: ProjectId;
    viewChange: ViewId;
    addProject: void;
    editProject: ProjectId;
    deleteProject: ProjectId;
    addView: void;
    updateViewConfig: Record<string, any>;
    toggleShowViewTitles: boolean;
  }>();

  let activeTab: SettingsTabId = "viewConfig";
  
  // Calculate safe position avoiding Obsidian sidebars
  let safePosition = { top: '3.5rem', right: '0.5rem', left: 'auto' };
  
  function calculateSafePosition() {
    // Find Obsidian sidebars
    const leftSidebar = document.querySelector('.workspace-split.mod-horizontal.mod-left-split');
    const rightSidebar = document.querySelector('.workspace-split.mod-horizontal.mod-right-split');
    const ribbonLeft = document.querySelector('.workspace-ribbon.mod-left');
    
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
    
    // Position within the plugin container, accounting for sidebars
    safePosition = {
      top: '3.5rem',
      right: `${Math.max(0.5, rightOffset / 16 + 0.5)}rem`,
      left: 'auto'
    };
  }

  function handleOutside(event: MouseEvent) {
    const path = event.composedPath();
    if (popoverElement && !path.includes(popoverElement)) {
      // defer close to allow click handlers to finish
      setTimeout(() => dispatch("close"), 0);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      dispatch("close");
    }
  }

  let popoverElement: HTMLElement | null = null;

  onMount(() => {
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("keydown", handleKeydown, true);
    // Calculate position after mount
    setTimeout(calculateSafePosition, 0);
  });

  onDestroy(() => {
    document.removeEventListener("mousedown", handleOutside, true);
    document.removeEventListener("keydown", handleKeydown, true);
  });

  $: activeView = views.find((view) => view.id === viewId);
  $: currentFilter = activeView?.filter ?? { conjunction: "and" as const, conditions: [] };
  $: currentColors = activeView?.colors ?? { conditions: [] };
  $: currentSort = activeView?.sort ?? { criteria: [] };
</script>

{#if position}
  <div
    class="settings-popover-overlay"
    role="presentation"
    on:click|self={() => dispatch("close")}
  >
    <div 
      class="settings-popover" 
      bind:this={popoverElement} 
      role="dialog" 
      aria-modal="true" 
      tabindex="-1"
      style="top: {safePosition.top}; right: {safePosition.right}; left: {safePosition.left};"
    >
      <div class="popover-header">
        <h3>Настройки</h3>
        <button class="close-btn" on:click={() => dispatch("close")} aria-label="Закрыть">×</button>
      </div>
      
      <SettingsMenuTabs activeTab={activeTab} on:change={(event) => (activeTab = event.detail)} />

      <div class="tab-content">
        {#if activeTab === "projects"}
          <ProjectTab
            {projects}
            {projectId}
            on:select={(event) => dispatch("projectChange", event.detail)}
            on:addProject={() => dispatch("addProject")}
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
          <FiltersTab
            value={currentFilter}
            fields={resolvedFields}
            records={resolvedRecords}
            on:update={(event) => dispatch("updateViewConfig", { filter: event.detail })}
          />
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
          />
        {/if}
      </div>

      <div class="popover-footer">
        <button class="btn-primary" on:click={() => dispatch("close")}>Готово</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-popover-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
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
    background: var(--background-primary, #1e1e1e);
    border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.1));
    box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    z-index: 101;
  }

  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.1));
  }

  .popover-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    width: 1.75rem;
    height: 1.75rem;
    min-width: 2.75rem;
    min-height: 2.75rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .tab-content {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1rem;
    min-height: 10rem;
    max-height: calc(100vh - 20rem);
  }

  .popover-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-start;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.1));
  }

  .btn-primary {
    padding: 0.5rem 1.25rem;
    border-radius: 0.5rem;
    border: none;
    background: var(--interactive-accent, #7b68ee);
    color: var(--text-on-accent, white);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    min-height: 2.75rem;
  }

  .btn-primary:hover {
    opacity: 0.9;
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
