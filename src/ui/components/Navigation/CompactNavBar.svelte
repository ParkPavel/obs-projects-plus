<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ProjectDefinition, ProjectId, ViewDefinition, ViewId } from "src/settings/settings";
  import { i18n } from "../../../lib/stores/i18n";
  import AddViewButton from "./AddViewButton.svelte";
  import ViewSwitcher from "./ViewSwitcher.svelte";
  import SettingsMenuButton from "./SettingsMenuButton.svelte";
  import ViewSpecificActions from "./ViewSpecificActions.svelte";

  export let projects: ProjectDefinition[] = [];
  export let projectId: ProjectId | undefined;
  export let views: ViewDefinition[] = [];
  export let viewId: ViewId | undefined;
  export let view: ViewDefinition | undefined = undefined;

  const dispatch = createEventDispatcher<{
    addView: void;
    openSettings: MouseEvent;
    centerToday: void;
    toggleAgenda: void;
    freezeColumns: void;
    projectChange: ProjectId;
    viewChange: ViewId;
  }>();

  $: activeProjectLabel = $i18n.t('navigation.active-project') ?? 'Active project';

  function handleProjectChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    dispatch("projectChange", target.value as ProjectId);
  }
</script>

<nav class="compact-navbar">
  {#if projects.length > 1}
    <div class="project-switcher" aria-label={activeProjectLabel}>
      <select
        bind:value={projectId}
        on:change={handleProjectChange}
      >
        {#each projects as project (project.id)}
          <option value={project.id}>{project.name}</option>
        {/each}
      </select>
    </div>
  {/if}

  <ViewSwitcher
    {views}
    activeViewId={viewId}
    onSelect={(id) => dispatch("viewChange", id)}
  />

  <div class="right">
    <AddViewButton onAdd={() => dispatch("addView")}/>
    <SettingsMenuButton onOpen={(event) => dispatch("openSettings", event)}/>
    <ViewSpecificActions
      {view}
      onCenterToday={() => dispatch("centerToday")}
      onToggleAgenda={() => dispatch("toggleAgenda")}
      onFreezeColumns={() => dispatch("freezeColumns")}
    />
  </div>
</nav>

<style>
  .compact-navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm, 0.5rem);
    padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 0.75rem);
    min-height: 2.5rem;
    position: sticky;
    top: 0;
    z-index: 90;
    background: rgba(var(--background-rgb, 34, 34, 34), 0.85);
    backdrop-filter: blur(0.625rem) saturate(180%);
    -webkit-backdrop-filter: blur(0.625rem) saturate(180%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .project-switcher select {
    min-height: 2.25rem;
    padding: 0.375rem 0.625rem;
    border-radius: 0.625rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(var(--background-rgb, 34, 34, 34), 0.85);
    color: inherit;
  }

  .project-switcher select:focus {
    outline: 2px solid rgba(var(--accent-rgb, 120, 170, 255), 0.6);
  }

  .right {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs, 0.375rem);
    flex-shrink: 0;
  }

  :global(.clickable-icon) {
    padding: 0.625rem;
    border-radius: 0.625rem;
  }

  :global(.clickable-icon:focus-visible) {
    outline: 2px solid rgba(var(--accent-rgb, 120, 170, 255), 0.7);
    outline-offset: 0.125rem;
    background: rgba(var(--accent-rgb, 120, 170, 255), 0.12);
  }

  /* Mobile responsive */
  @media (max-width: 30rem) {
    .compact-navbar {
      padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
      gap: var(--spacing-xs, 0.25rem);
    }
    .project-switcher select {
      max-width: 8rem;
      font-size: 0.75rem;
    }
  }
</style>
