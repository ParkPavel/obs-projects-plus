<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import type { ProjectDefinition, ProjectId } from "../../../../../settings/settings";

  export let projects: ProjectDefinition[] = [];
  export let projectId: ProjectId | undefined;

  const dispatch = createEventDispatcher<{
    select: ProjectId;
    addProject: void;
    editProject: ProjectId;
    deleteProject: ProjectId;
  }>();
  
  function handleEdit(event: MouseEvent, id: ProjectId) {
    event.stopPropagation();
    dispatch("editProject", id);
  }
  
  function handleDelete(event: MouseEvent, id: ProjectId) {
    event.stopPropagation();
    dispatch("deleteProject", id);
  }
</script>

<div class="section">
  <div class="header">Проекты</div>
  <div class="list" role="listbox" aria-label="Выбор проекта">
    {#each projects as project (project.id)}
      <div class="project-item" class:selected={project.id === projectId}>
        <button
          class="project-btn"
          role="option"
          aria-selected={project.id === projectId}
          on:click={() => dispatch("select", project.id)}
        >
          {project.name}
        </button>
        <div class="project-actions">
          <button 
            class="action-btn" 
            on:click={(e) => handleEdit(e, project.id)}
            title="Редактировать проект"
            aria-label="Редактировать проект"
          >
            <Icon name="pencil" size="xs" />
          </button>
          <button 
            class="action-btn danger" 
            on:click={(e) => handleDelete(e, project.id)}
            title="Удалить проект"
            aria-label="Удалить проект"
          >
            <Icon name="trash-2" size="xs" />
          </button>
        </div>
      </div>
    {/each}
  </div>
  <div class="actions">
    <button class="ghost" on:click={() => dispatch("addProject")}>Создать проект</button>
  </div>
</div>

<style>
  .section { display: flex; flex-direction: column; gap: 0.5rem; }
  .header { font-weight: 600; }
  .list { display: flex; flex-direction: column; gap: 0.375rem; max-height: 14rem; overflow-y: auto; }
  
  .project-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: 0.625rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
  }
  
  .project-item.selected {
    background: rgba(var(--accent-rgb, 120, 170, 255), 0.16);
    border-color: rgba(var(--accent-rgb, 120, 170, 255), 0.6);
  }
  
  .project-btn {
    flex: 1;
    text-align: left;
    padding: 0.375rem 0.5rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    min-height: 2rem;
    border-radius: 0.375rem;
  }
  
  .project-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  
  .project-actions {
    display: flex;
    gap: 0.125rem;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  
  .project-item:hover .project-actions {
    opacity: 1;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 0.375rem;
  }
  
  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-normal);
  }
  
  .action-btn.danger:hover {
    background: rgba(255, 100, 100, 0.2);
    color: var(--text-error, #ff6b6b);
  }
  
  .actions { display: flex; justify-content: flex-end; }
  .ghost {
    padding: 0.5rem 0.75rem;
    border-radius: 0.625rem;
    border: 1px dashed rgba(255, 255, 255, 0.18);
    background: transparent;
    color: inherit;
    cursor: pointer;
    min-height: 2.75rem;
  }
</style>
