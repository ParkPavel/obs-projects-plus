<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { customViews } from "src/lib/stores/customViews";
  import { settings } from "src/lib/stores/settings";
  import { i18n } from "src/lib/stores/i18n";
  import type { ViewDefinition, ViewId, ProjectId } from "../../../../../settings/settings";

  export let views: ViewDefinition[] = [];
  export let viewId: ViewId | undefined;
  export let projectId: ProjectId | undefined;
  export let showViewTitles: boolean = true;

  const dispatch = createEventDispatcher<{
    select: ViewId;
    addView: void;
    toggleShowTitles: boolean;
  }>();

  let editingViewId: ViewId | null = null;
  let editingName: string = "";
  
  // Drag-and-drop state
  let draggedIndex: number | null = null;
  let dragOverIndex: number | null = null;
  let isDragging = false;

  function getViewIcon(type: string): string {
    return $customViews[type]?.getIcon() ?? "layout-grid";
  }

  function startEditing(view: ViewDefinition) {
    editingViewId = view.id;
    editingName = view.name;
  }

  function cancelEditing() {
    editingViewId = null;
    editingName = "";
  }

  function saveEditing() {
    if (editingViewId && editingName.trim() && projectId) {
      settings.renameView(projectId, editingViewId, editingName.trim());
    }
    cancelEditing();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      saveEditing();
    } else if (event.key === "Escape") {
      cancelEditing();
    }
  }

  function deleteView(view: ViewDefinition) {
    if (projectId && views.length > 1) {
      settings.deleteView(projectId, view.id);
    }
  }

  function duplicateView(view: ViewDefinition) {
    if (projectId) {
      settings.duplicateView(projectId, view.id);
    }
  }
  
  // Drag-and-drop handlers
  function handleDragStart(event: DragEvent, index: number) {
    if (!event.dataTransfer) return;
    
    draggedIndex = index;
    isDragging = true;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  }
  
  function handleDragEnd(event: DragEvent) {
    isDragging = false;
    draggedIndex = null;
    dragOverIndex = null;
  }
  
  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (!event.dataTransfer) return;
    
    event.dataTransfer.dropEffect = 'move';
    dragOverIndex = index;
  }
  
  function handleDragLeave(event: DragEvent) {
    // Only clear if we're leaving the item entirely
    const relatedTarget = event.relatedTarget as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    
    if (!currentTarget.contains(relatedTarget)) {
      dragOverIndex = null;
    }
  }
  
  function handleDrop(event: DragEvent, toIndex: number) {
    event.preventDefault();
    
    if (draggedIndex !== null && draggedIndex !== toIndex && projectId) {
      settings.reorderViews(projectId, draggedIndex, toIndex);
    }
    
    draggedIndex = null;
    dragOverIndex = null;
  }

  $: t = $i18n.t;
</script>

<div class="section">
  <div class="header">{t("settings-menu.views.title")}</div>
  
  <!-- Toggle show/hide titles -->
  <label class="toggle-row">
    <span>{t("settings-menu.views.show-titles")}</span>
    <input 
      type="checkbox" 
      checked={showViewTitles}
      on:change={(e) => dispatch("toggleShowTitles", e.currentTarget.checked)}
    />
  </label>

  <div class="list" role="listbox" aria-label={t("settings-menu.views.select-view")}>
    {#each views as view, index (view.id)}
      <div 
        class="view-item" 
        class:selected={view.id === viewId}
        class:dragging={isDragging && draggedIndex === index}
        class:drag-over={dragOverIndex === index}
        draggable="true"
        on:dragstart={(e) => handleDragStart(e, index)}
        on:dragend={handleDragEnd}
        on:dragover={(e) => handleDragOver(e, index)}
        on:dragleave={handleDragLeave}
        on:drop={(e) => handleDrop(e, index)}
      >
        <div class="drag-handle" title={t("settings-menu.views.drag-to-reorder")}>
          <Icon name="grip-vertical" size="xs" />
        </div>
        
        <div class="view-icon">
          <Icon name={getViewIcon(view.type)} size="sm" />
        </div>
        
        {#if editingViewId === view.id}
          <input
            class="view-name-input"
            type="text"
            bind:value={editingName}
            on:keydown={handleKeydown}
            on:blur={saveEditing}
            autofocus
          />
        {:else}
          <button 
            class="view-name"
            on:click={() => dispatch("select", view.id)}
          >
            {view.name}
          </button>
        {/if}

        <div class="view-actions">
          <button
            class="action-btn"
            title={t("settings-menu.views.rename")}
            on:click={() => startEditing(view)}
          >
            <Icon name="pencil" size="xs" />
          </button>
          <button
            class="action-btn"
            title={t("settings-menu.views.duplicate")}
            on:click={() => duplicateView(view)}
          >
            <Icon name="copy" size="xs" />
          </button>
          {#if views.length > 1}
            <button
              class="action-btn danger"
              title={t("settings-menu.views.delete")}
              on:click={() => deleteView(view)}
            >
              <Icon name="trash-2" size="xs" />
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  
  <div class="actions">
    <button class="ghost" on:click={() => dispatch("addView")}>
      {t("settings-menu.views.add-view")}
    </button>
  </div>
</div>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .header {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.625rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    min-height: 2.75rem;
  }

  /* Custom toggle switch styling */
  .toggle-row input[type="checkbox"] {
    position: relative;
    width: 2.5rem;
    height: 1.25rem;
    -webkit-appearance: none;
    appearance: none;
    background: var(--background-modifier-border);
    border-radius: 0.625rem;
    cursor: pointer;
    transition: background 0.2s ease;
    outline: none;
    flex-shrink: 0;
  }

  .toggle-row input[type="checkbox"]:checked {
    background: var(--interactive-accent);
  }

  .toggle-row input[type="checkbox"]::before {
    content: '';
    position: absolute;
    width: 0.9375rem;
    height: 0.9375rem;
    border-radius: 50%;
    background: var(--background-primary);
    top: 50%;
    left: 0.15625rem;
    transform: translateY(-50%);
    transition: left 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .toggle-row input[type="checkbox"]:checked::before {
    left: calc(100% - 1.09375rem);
  }

  .toggle-row:hover input[type="checkbox"]:not(:checked) {
    background: var(--background-modifier-border-hover);
  }
  
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 16rem;
    overflow-y: auto;
  }
  
  .view-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    min-height: 2.75rem;
    cursor: grab;
    transition: all 0.2s ease;
  }
  
  .view-item:active {
    cursor: grabbing;
  }
  
  .view-item.dragging {
    opacity: 0.5;
    transform: scale(0.95);
  }
  
  .view-item.drag-over {
    border-color: var(--interactive-accent);
    background: rgba(var(--accent-rgb, 120, 170, 255), 0.1);
    transform: translateY(-2px);
  }
  
  .view-item.selected {
    background: rgba(var(--accent-rgb, 120, 170, 255), 0.16);
    border-color: rgba(var(--accent-rgb, 120, 170, 255), 0.4);
  }
  
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.5rem;
    flex-shrink: 0;
    color: var(--text-faint);
    cursor: grab;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }
  
  .view-item:hover .drag-handle {
    opacity: 1;
  }
  
  .drag-handle:active {
    cursor: grabbing;
  }
  
  .view-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    color: var(--text-muted);
  }
  
  .view-name {
    flex: 1;
    text-align: left;
    padding: 0.25rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.875rem;
    min-height: 1.75rem;
  }
  
  .view-name:hover {
    color: var(--text-accent);
  }
  
  .view-name-input {
    flex: 1;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--interactive-accent, #7b68ee);
    border-radius: 0.25rem;
    background: var(--background-primary);
    color: inherit;
    font-size: 0.875rem;
    min-height: 1.75rem;
  }
  
  .view-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-normal);
  }
  
  .action-btn.danger:hover {
    background: rgba(255, 100, 100, 0.2);
    color: #ff6b6b;
  }
  
  .actions {
    display: flex;
    justify-content: flex-end;
  }
  
  .ghost {
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px dashed rgba(255, 255, 255, 0.18);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.875rem;
    min-height: 2.75rem;
  }
  
  .ghost:hover {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.04);
  }
</style>
