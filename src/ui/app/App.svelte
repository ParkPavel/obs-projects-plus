<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";

  import { createProject } from "src/lib/dataApi";
  import { api } from "src/lib/stores/api";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import { ViewApi } from "src/lib/viewApi";
  import { CreateProjectModal } from "src/ui/modals/createProjectModal";
  import { AddViewModal } from "src/ui/modals/addViewModal";
  import { ConfirmDialogModal } from "src/ui/modals/confirmDialog";
  import CompactNavBar from "src/ui/components/Navigation/CompactNavBar.svelte";
  import SettingsMenuPopover from "src/ui/components/Navigation/SettingsMenu/SettingsMenuPopover.svelte";
  import { createDemoProject } from "./onboarding/demoProject";
  import { OnboardingModal } from "./onboarding/onboardingModal";
  import View from "./View.svelte";
  import DataFrameProvider from "./DataFrameProvider.svelte";
  import type {
    ProjectId,
    ProjectDefinition,
    ViewId,
  } from "src/settings/settings";

  export let projectId: ProjectId | undefined;
  export let viewId: ViewId | undefined;

  const dispatch = createEventDispatcher();

  $: ({ projects } = $settings);

  $: defaultProject = projects.find((project) => project.isDefault);

  $: {
    // If current projectId doesn't exist in projects array (project was deleted),
    // update projectId to the default or first project
    if (projectId && !projects.find((p) => p.id === projectId)) {
      const newProjectId = defaultProject?.id || projects[0]?.id;
      projectId = newProjectId;
      // Dispatch event so parent can save state
      dispatch('projectIdChange', newProjectId);
    }
  }

  $: project =
    projects.find((project) => projectId === project.id) ||
    defaultProject ||
    projects[0];

  $: views = project?.views || [];

  // Make view reactive to settings changes (for centerOn, agendaOpen, freeze, etc.)
  $: view = (() => {
    const found = views.find((v) => viewId === v.id);
    if (!found && views.length > 0) {
      // Side effect: update viewId if not found
      viewId = views[0]?.id;
      return views[0];
    }
    return found;
  })();

  onMount(() => {
    if (!projects.length) {
      new OnboardingModal(
        $app,
        // Create from scratch.
        () => {
          new CreateProjectModal(
            $app,
            $i18n.t("modals.project.create.title"),
            $i18n.t("modals.project.create.cta"),
            settings.addProject,
            createProject()
          ).open();
        },
        // Try demo project.
        () => {
          createDemoProject($app.vault);
        }
      ).open();
    }
  });

  function mergeViewConfig(next: Record<string, any>) {
    if (!project || !view) {
      return;
    }
    
    // Separate filter/colors/sort from config updates
    const { filter, colors, sort, ...configUpdates } = next;
    
    // Update view with all changes at once
    const updatedView = {
      ...view,
      ...(filter !== undefined ? { filter } : {}),
      ...(colors !== undefined ? { colors } : {}),
      ...(sort !== undefined ? { sort } : {}),
      config: { ...(view.config ?? {}), ...configUpdates },
    };
    
    settings.updateView(project.id, updatedView);
  }

  function handleAddView(project: ProjectDefinition | undefined) {
    if (!project) return;
    new AddViewModal($app, project, (projectId, view) => {
      settings.addView(projectId, view);
      dispatch("viewIdChange", view.id);
      viewId = view.id;
    }).open();
  }

  let settingsMenuOpen = false;
  let settingsMenuPosition = { x: 0, y: 0 };

  function handleOpenSettings(event: MouseEvent) {
    if (!event) {
      // Fallback position if no event
      settingsMenuPosition = { x: window.innerWidth - 300, y: 60 };
      settingsMenuOpen = true;
      return;
    }
    // Use clientX/Y since currentTarget won't be available after dispatch
    const x = event.clientX ?? window.innerWidth - 300;
    const y = event.clientY ?? 60;
    settingsMenuPosition = { x: Math.max(0, x - 200), y: y + 8 };
    settingsMenuOpen = true;
  }

  function closeSettingsMenu() {
    settingsMenuOpen = false;
  }

  function handleUpdateViewConfig(event: CustomEvent<Record<string, any>>) {
    mergeViewConfig(event.detail ?? {});
  }

  function handleCenterToday() {
    mergeViewConfig({ centerOn: "today" });
    dispatch("centerToday", { projectId: project?.id, viewId: view?.id });
  }

  function handleToggleAgenda() {
    const current = view?.config?.["agendaOpen"] ?? false;
    mergeViewConfig({ agendaOpen: !current });
    dispatch("toggleAgenda", { projectId: project?.id, viewId: view?.id, open: !current });
  }

  function handleFreezeColumns() {
    const current = (view?.config?.["freezeAll"] ?? view?.config?.["freezeColumns"]) ?? false;
    const next = !current;
    mergeViewConfig({ freezeAll: next, freezeColumns: next });
    dispatch("freezeColumns", { projectId: project?.id, viewId: view?.id, frozen: next });
  }
</script>

<!--
	@component

	App is the main application component and coordinates between the View and
	the Toolbar.
-->
<div class="projects-container">
  <CompactNavBar
    {views}
    viewId={view?.id}
    {view}
    on:viewChange={(event) => (viewId = event.detail)}
    on:addView={() => handleAddView(project)}
    on:openSettings={(event) => handleOpenSettings(event.detail)}
    on:centerToday={handleCenterToday}
    on:toggleAgenda={handleToggleAgenda}
    on:freezeColumns={handleFreezeColumns}
  />

  <div class="projects-main">
    {#if project}
      <DataFrameProvider {project} let:frame let:source>
        {#if project && view && source}
          <View
            {project}
            {view}
            readonly={source.readonly()}
            api={new ViewApi(source, $api)}
            onConfigChange={settings.updateViewConfig}
            {frame}
          />
        {/if}
        <slot {project} {view} {source} {frame} />
      </DataFrameProvider>
    {/if}
  </div>

  {#if settingsMenuOpen}
    <SettingsMenuPopover
      {projects}
      projectId={project?.id}
      {views}
      viewId={view?.id}
      position={settingsMenuPosition}
      showViewTitles={$settings.preferences.showViewTitles ?? true}
      on:close={closeSettingsMenu}
      on:projectChange={(event) => {
        projectId = event.detail;
        dispatch("projectIdChange", event.detail);
        closeSettingsMenu();
      }}
      on:viewChange={(event) => {
        viewId = event.detail;
      }}
      on:addProject={() => {
        new CreateProjectModal(
          $app,
          $i18n.t("modals.project.create.title"),
          $i18n.t("modals.project.create.cta"),
          settings.addProject,
          createProject()
        ).open();
      }}
      on:editProject={(event) => {
        const projectToEdit = $settings.projects.find(p => p.id === event.detail);
        if (projectToEdit) {
          new CreateProjectModal(
            $app,
            $i18n.t("modals.project.edit.title"),
            $i18n.t("modals.project.edit.cta"),
            (updatedProject) => settings.updateProject(updatedProject),
            projectToEdit
          ).open();
        }
      }}
      on:deleteProject={(event) => {
        const projectToDelete = $settings.projects.find(p => p.id === event.detail);
        if (projectToDelete) {
          new ConfirmDialogModal(
            $app,
            $i18n.t("modals.project.delete.title"),
            $i18n.t("modals.project.delete.message", { project: projectToDelete.name }),
            $i18n.t("modals.project.delete.cta"),
            () => {
              settings.deleteProject(event.detail);
              // If deleted project was active, switch to first available
              if (projectId === event.detail) {
                const remaining = $settings.projects.filter(p => p.id !== event.detail);
                if (remaining.length > 0 && remaining[0]) {
                  projectId = remaining[0].id;
                  dispatch("projectIdChange", projectId);
                }
              }
            }
          ).open();
        }
      }}
      on:addView={() => handleAddView(project)}
      on:updateViewConfig={handleUpdateViewConfig}
      on:toggleShowViewTitles={(event) => {
        settings.updatePreferences({
          ...$settings.preferences,
          showViewTitles: event.detail,
        });
      }}
    />
  {/if}
</div>

<style>
  .projects-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .projects-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
  }
</style>
