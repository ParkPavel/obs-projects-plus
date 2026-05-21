<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ViewDefinition, ViewId } from "src/settings/settings";
  import type { ProjectDefinition, ProjectId } from "src/settings/settings";
  import { i18n } from "../../../lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import PopoverList, {
    type PopoverItem,
  } from "src/ui/components/FloatingPopup/PopoverList.svelte";
  import AddViewButton from "./AddViewButton.svelte";
  import ViewSwitcher from "./ViewSwitcher.svelte";
  import SettingsMenuButton from "./SettingsMenuButton.svelte";
  import ViewSpecificActions from "./ViewSpecificActions.svelte";

  export let views: ViewDefinition[] = [];
  export let viewId: ViewId | undefined;
  export let view: ViewDefinition | undefined = undefined;
  export let projects: ProjectDefinition[] = [];
  export let projectId: ProjectId | undefined;

  $: currentProject = projects.find(p => p.id === projectId);
  $: hideProjectName = currentProject?.name === "Демо-проект";

  const dispatch = createEventDispatcher<{
    addView: void;
    openSettings: MouseEvent;
    centerToday: void;
    toggleAgenda: void;
    freezeColumns: void;
    viewChange: ViewId;
    projectChange: ProjectId;
  }>();

  let activePopover: {
    anchorEl: HTMLElement;
    items: PopoverItem[];
    searchable: boolean;
  } | null = null;

  function openProjectSwitcher(anchor: HTMLElement) {
    activePopover = {
      anchorEl: anchor,
      searchable: true,
      items: projects.map((p) => ({
        label: p.name,
        icon: "layout-grid",
        selected: p.id === projectId,
        handler: () => dispatch("projectChange", p.id),
      })),
    };
  }

  function handlePopoverSelect(
    e: CustomEvent<{ item: PopoverItem; keepOpen: boolean }>,
  ): void {
    if (!e.detail.keepOpen) activePopover = null;
  }
</script>

<nav class="compact-navbar">
  {#if projects.length > 1 && !hideProjectName}
    <button
      class="project-trigger"
      on:click={(e) => openProjectSwitcher(e.currentTarget)}
      title={$i18n.t('nav.project-switcher.tooltip')}
    >
      <span class="project-name">{currentProject?.name ?? ''}</span>
      <svg class="chevron" width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
    </button>
  {:else if currentProject && !hideProjectName}
    <span class="project-name-static">{currentProject.name}</span>
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

<FloatingPopup
  triggerEl={activePopover?.anchorEl ?? null}
  open={activePopover !== null}
  placement="bottom-start"
  role="menu"
  on:close={() => (activePopover = null)}
>
  {#if activePopover}
    <PopoverList
      items={activePopover.items}
      searchable={activePopover.searchable}
      on:select={handlePopoverSelect}
    />
  {/if}
</FloatingPopup>

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
    background: var(--background-secondary);
    backdrop-filter: blur(0.625rem) saturate(180%);
    -webkit-backdrop-filter: blur(0.625rem) saturate(180%);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .project-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-normal);
    font-weight: 600;
    font-size: var(--font-ui-small);
    cursor: pointer;
    flex-shrink: 0;
    max-width: 12rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .project-trigger:hover {
    background: var(--background-modifier-hover);
  }
  .project-trigger:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.125rem;
  }
  .project-name {
    overflow: hidden;
    text-overflow: ellipsis;
    /* #042: ensure ascenders/descenders fit. Without an explicit line-height,
       `overflow: hidden` on an inline flex item with text-overflow ellipsis
       can clip the top of letters under certain font metrics — the bug
       surfaced on Cyrillic project names like «Условия». */
    line-height: 1.4;
  }
  .project-name-static {
    font-weight: 600;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    flex-shrink: 0;
    max-width: 12rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* #042: see .project-name above. */
    line-height: 1.4;
  }
  .chevron {
    flex-shrink: 0;
    opacity: 0.6;
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
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.125rem;
    background: var(--background-modifier-hover);
  }

  /* Mobile responsive */
  @media (max-width: 30rem) {
    .compact-navbar {
      padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
      gap: var(--spacing-xs, 0.25rem);
    }
  }

  /* Reduce header clutter on touch/small devices: hide project title in navbar */
  @media (max-width: 48rem), (pointer: coarse) {
    .project-trigger,
    .project-name-static {
      display: none;
    }
  }
</style>
