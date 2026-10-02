<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { get } from "svelte/store";

  import { Notice } from "obsidian";
  import { Icon } from "obsidian-svelte";
  import { v4 as uuidv4 } from "uuid";
  import { createProject } from "src/lib/dataApi";
  import { buildDerivedSource, projectSourceOptions, sourceNameTaken } from "src/lib/datasources/namedSource";
  import { api } from "src/lib/stores/api";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import { isMobileDevice } from "src/lib/stores/ui";
  import { agendaDrawer, toggle as toggleAgendaDrawer } from "src/lib/stores/agendaDrawer";
  import { fileSystem } from "src/lib/stores/fileSystem";
  import { ViewApi } from "src/lib/viewApi";
  import { resolveExternalFrame } from "src/lib/externalFrameResolver";
  import { bumpExternalFrameInvalidation, projectsCacheKey } from "src/lib/stores/externalFrameInvalidation";
  // #016 (Phase 1, Option A) — transform-cache invalidation is wired into the
  // dataFrame store mutators themselves so it fires atomically (synchronously
  // before each `update()`), eliminating the previous TOCTOU race between
  // a 300 ms-debounced `invalidateTransformAll()` and the un-debounced
  // `dataFrame.merge()` in events.ts.
  // Layering: App.svelte (UI layer) owns the wiring; it cannot live in
  // events.ts (Shell layer) because that would break the
  // Shell → UI → Engine → Data dependency direction.
  import { invalidateAll as invalidateTransformAll } from "src/lib/dashboard-engine/transformCache";
  import { registerDataFrameInvalidation } from "src/lib/stores/dataframe";
  import { getAPI, isPluginEnabled } from "obsidian-dataview";
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import { CreateProjectModal } from "src/ui/modals/createProjectModal";
  import { AddViewModal } from "src/ui/modals/addViewModal";
  import { ConfirmDialogModal } from "src/ui/modals/confirmDialog";
  import CompactNavBar from "src/ui/components/Navigation/CompactNavBar.svelte";
  import SettingsMenuPopover from "src/ui/components/Navigation/SettingsMenu/SettingsMenuPopover.svelte";
  import { createDemoWithNotices } from "./onboarding/demoRun";
  import ProjectsEmptyState from "./ProjectsEmptyState.svelte";
  import { OnboardingModal } from "./onboarding/onboardingModal";
  import View from "./View.svelte";
  import DataFrameProvider from "./DataFrameProvider.svelte";
  import ViewFilterBar from "src/ui/components/FilterPills/ViewFilterBar.svelte";
  import { noticeFor } from "src/lib/errors/errorText";

  /** #202 — a refusal, so it carries a code; the success below does not. */
  const SOURCE_NAME_TAKEN = "PPP-701";
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

  // Phone agenda drawer (session store, shared with CalendarView). Keyed by the project id
  // because CalendarView is mounted with `project`, not the view id; both sides use this key.
  $: agendaDrawerKey = project?.id;
  // Navbar icon/label: the drawer on a phone, the view config (undefined) on desktop.
  $: navAgendaOpen = $isMobileDevice
    ? (agendaDrawerKey ? $agendaDrawer[agendaDrawerKey] === true : false)
    : undefined;

  // ios-l1 L1 — in short landscape the filter row gives its height back and
  // the navbar carries one button that opens the same popover. `filterOpen` is
  // the bar's own open state, bound through; the count stands in for the
  // pills the row would have shown.
  let filterOpen = false;
  let filterTriggerEl: HTMLButtonElement | null = null;
  $: activeFilterCount = (view?.filter?.conditions ?? []).filter((c) => c.enabled !== false).length;

  // ios-l1 L1 — the phone bottom sheet is fixed to the window's bottom edge and
  // capped at 85vh, which in short landscape rises above this navbar and covers
  // the very button that toggles it. The room it may take is the window below
  // the navbar's bottom edge — i.e. the top of `.projects-main`, grid row 2 —
  // measured rather than written down, since the navbar's height is its own.
  // Exposed as `--ppp-below-nav-h`; the short-landscape rule below hands it to
  // the sheet, which inherits it because on phones it is not portalled.
  let mainEl: HTMLDivElement | null = null;
  let belowNav: string | null = null;
  function measureBelowNav() {
    if (!mainEl) return;
    const win = mainEl.ownerDocument.defaultView ?? window;
    const room = win.innerHeight - mainEl.getBoundingClientRect().top;
    belowNav = room > 0 ? `${Math.floor(room)}px` : null;
  }
  onMount(() => {
    const win = mainEl?.ownerDocument.defaultView ?? window;
    measureBelowNav();
    // `.projects-main` changes size when the leaf does or when the navbar's
    // height does — the two things that move the navbar's bottom edge.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureBelowNav) : null;
    if (mainEl) observer?.observe(mainEl);
    win.addEventListener("resize", measureBelowNav);
    return () => {
      observer?.disconnect();
      win.removeEventListener("resize", measureBelowNav);
    };
  });

  // #077 — quick view-filter pills. Writes the edited FilterDefinition back to
  // the active view; empty clears to a no-condition filter. Engine evaluation
  // stays in View.svelte via the canonical applyFilter pipeline.
  function handleViewFilterPillsChange(
    next: import("src/settings/base/settings").FilterDefinition | undefined
  ) {
    if (!project || !view) return;
    settings.updateView(project.id, {
      ...view,
      filter: next ?? { conjunction: "and", conditions: [] },
    });
  }

  /**
   * #184 — keep the view's current filter as a source of the project.
   *
   * The project editor was the obvious home and is the wrong one: it holds a
   * definition, not a frame, so it has no fields to build a condition against
   * and a selection saved there with an empty filter equals its own base. Here
   * the filter is already visible and has already narrowed what is on screen,
   * which is the brief's verify-after-write answer — you name something you
   * have watched work.
   *
   * The write goes through `settings.updateProject`, the same path the project
   * editor uses, so nothing about how a project is stored is new.
   */
  function handleSaveFilterAsSource(name: string) {
    if (!project || !view) return;
    const filter = view.filter;
    // Guarded here as well as in the bar: the bar hides the action without
    // conditions, and a selection equal to its own base would still be
    // useless if some other caller reached this.
    if (!filter || filter.conditions.length === 0) return;
    // A name already in use is refused rather than silently accepted. The bar
    // tells the user the name is what will identify this selection later, and
    // two sources sharing a label are indistinguishable in the only picker
    // that exists — so the promise has to be enforced where it is made.
    if (sourceNameTaken(projectSourceOptions(project).sources, name)) {
      new Notice(noticeFor(SOURCE_NAME_TAKEN, { name }));
      return;
    }
    settings.updateProject({
      ...project,
      additionalSources: [
        ...(project.additionalSources ?? []),
        buildDerivedSource(name, filter, uuidv4()),
      ],
    });
    // Deliberately describes what is now TRUE and observable — the source is in
    // the project and the block picker will list it — rather than claiming the
    // write reached disk. Settings are persisted by a fire-and-forget
    // subscription in main.ts whose failure only reaches the console, so
    // "Saved" would be a claim this code cannot make. That gap is real and is
    // filed as its own ticket rather than papered over here.
    new Notice(
      $i18n.t("views.filter.bar.saved", {
        defaultValue: '"{{name}}" is now a source of this project — pick it in the block settings',
        name,
      })
    );
  }

  // Pillar 5 (Phase 5 UI): closure capturing current stores for sibling-project
  // frame resolution. An in-memory cache prevents re-querying the same source
  // repeatedly within a session. Invalidated on vault changes + on settings.projects
  // mutations to keep correlation widgets reasonably fresh.
  const externalFrameCache = new Map<string, Promise<DataFrame | null>>();

  function invalidateExternalFrameCache() {
    externalFrameCache.clear();
    // Signal downstream preloaders (e.g. DatabaseViewCanvas) that already
    // resolved sibling-project frames may be stale and must be re-fetched
    // even if the referenced id set is unchanged.
    bumpExternalFrameInvalidation();
    // NOTE (#016): transform-cache invalidation is no longer fired from here.
    // It is registered as a synchronous callback on the dataFrame store (see
    // `registerDataFrameInvalidation` in onMount below), guaranteeing it runs
    // atomically with `dataFrame.merge()` / `deleteRecord()` etc. before any
    // Svelte subscriber re-evaluates `executeTransformCached`.
  }

  onMount(() => {
    const appInstance = $app;
    const events = [
      appInstance.vault.on("modify", invalidateExternalFrameCache),
      appInstance.vault.on("create", invalidateExternalFrameCache),
      appInstance.vault.on("delete", invalidateExternalFrameCache),
      appInstance.vault.on("rename", invalidateExternalFrameCache),
    ];
    // #016 — atomic transform-cache invalidation tied to dataFrame mutations.
    // Returns an unsubscribe handle; idempotent for the same callback ref so
    // remounting App in another leaf is safe.
    const unregisterTransformInvalidation = registerDataFrameInvalidation(
      invalidateTransformAll,
    );
    return () => {
      for (const ref of events) appInstance.vault.offref(ref);
      unregisterTransformInvalidation();
    };
  });

  // Invalidate when projects are added, removed or renamed, or their source or
  // field configuration changes (rollups are folded into sibling frames).
  let lastProjectsKey = "";
  $: {
    const key = projectsCacheKey($settings.projects ?? []);
    if (key !== lastProjectsKey) {
      lastProjectsKey = key;
      invalidateExternalFrameCache();
    }
  }

  // Stable closure: survives $settings / $app / $fileSystem ticks so
  // `new ViewApi(...)` below is not rebuilt on every reactive update.
  // Current store values are read lazily on each invocation.
  const resolveFrameById = (id: string): Promise<DataFrame | null> => {
    if (!id) return Promise.resolve(null);
    const cached = externalFrameCache.get(id);
    if (cached) return cached;
    const currentApp = get(app);
    let dataviewApi;
    try {
      dataviewApi = isPluginEnabled(currentApp) ? getAPI(currentApp) : undefined;
    } catch {
      dataviewApi = undefined;
    }
    const currentSettings = get(settings);
    const promise = resolveExternalFrame(id, {
      fileSystem: get(fileSystem),
      preferences: currentSettings.preferences,
      projects: currentSettings.projects,
      dataviewApi,
      app: currentApp,
    }).then((df) => {
      // Do not keep null results in the cache so a transient failure (e.g.
      // Dataview loading) can be retried on next access.
      if (df === null) externalFrameCache.delete(id);
      return df;
    });
    externalFrameCache.set(id, promise);
    return promise;
  };

  /**
   * 3.6.1 — the demo from any entry point in this view (first-run window,
   * empty screen, project menu): the three linked projects, then the
   * practice's overview opened. `true` once the demo exists.
   */
  async function createDemo(): Promise<boolean> {
    const result = await createDemoWithNotices($app.vault, (nextProject, nextView) => {
      projectId = nextProject;
      dispatch("projectIdChange", nextProject);
      viewId = nextView;
      dispatch("viewIdChange", nextView);
    });
    return result !== null;
  }

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
        // 3.6.1 — the three linked demo projects: the window's primary path.
        createDemo
      ).open();
    }
  });

  function openCreateProject() {
    new CreateProjectModal(
      $app,
      $i18n.t("modals.project.create.title"),
      $i18n.t("modals.project.create.cta"),
      settings.addProject,
      createProject()
    ).open();
  }

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
    if ($isMobileDevice) {
      // Phone: the drawer is session state, never the persisted desktop flag
      const open = toggleAgendaDrawer(agendaDrawerKey);
      dispatch("toggleAgenda", { projectId: project?.id, viewId: view?.id, open });
      return;
    }
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
<div class="projects-container" style:--ppp-below-nav-h={belowNav}>
  <CompactNavBar
    {views}
    viewId={view?.id}
    {view}
    agendaOpen={navAgendaOpen}
    on:viewChange={(event) => (viewId = event.detail)}
    on:addView={() => handleAddView(project)}
    on:openSettings={(event) => handleOpenSettings(event.detail)}
    on:centerToday={handleCenterToday}
    on:toggleAgenda={handleToggleAgenda}
    on:freezeColumns={handleFreezeColumns}
  >
    <svelte:fragment slot="filter">
      {#if view}
        <button
          bind:this={filterTriggerEl}
          class="ppp-nav-filter clickable-icon"
          class:ppp-nav-filter--active={activeFilterCount > 0}
          aria-label={$i18n.t("views.filter.bar.aria", { defaultValue: "View filter" })}
          title={$i18n.t("views.filter.bar.aria", { defaultValue: "View filter" })}
          aria-haspopup="dialog"
          aria-expanded={filterOpen}
          on:click={() => (filterOpen = !filterOpen)}
        >
          <Icon name="filter" size="sm" />
          {#if activeFilterCount > 0}<span class="ppp-nav-filter-count">{activeFilterCount}</span>{/if}
        </button>
      {/if}
    </svelte:fragment>
  </CompactNavBar>

  <div class="projects-main" bind:this={mainEl}>
    {#if project}
      <DataFrameProvider {project} let:frame let:source>
        {#if project && view && source}
          <ViewFilterBar
            filter={view.filter}
            fields={frame.fields}
            records={frame.records}
            readonly={source.readonly()}
            bind:open={filterOpen}
            anchor={filterTriggerEl}
            on:change={(e) => handleViewFilterPillsChange(e.detail)}
            on:saveAsSource={(e) => handleSaveFilterAsSource(e.detail)}
          />
          <!-- ios-s1: the view gets the room LEFT after the filter row, not
               the whole of `.projects-main`. See `.ppp-view-fill` below. -->
          <div class="ppp-view-fill">
            <View
              {project}
              {view}
              readonly={source.readonly()}
              api={new ViewApi(source, $api, resolveFrameById)}
              onConfigChange={settings.updateViewConfig}
              {frame}
            />
          </div>
        {/if}
        <slot {project} {view} {source} {frame} />
      </DataFrameProvider>
    {:else if $settings.projects.length === 0}
      <ProjectsEmptyState on:createDemo={() => void createDemo()} on:createProject={openCreateProject} />
    {/if}
  </div>

  <!--
    #190 — the area a panel may occupy. It shares grid row 2 with
    `.projects-main`, so its top edge IS the nav bar's bottom edge and no header
    height is written anywhere. It is empty until something portals into it
    (`portalToOverlay`), and it is present in every leaf even when the peek has
    never been opened — do not delete it as unused markup.

    Its position here is load-bearing and no test can see it:
    `SettingsMenuPopover` below declares the SAME layer (`--ppp-z-overlay`), and
    at equal z-index the later node in the DOM wins. Move the layer after the
    popover and the settings menu slides under an open panel; the popover
    renders conditionally, so nothing would catch it.
  -->
  <div class="ppp-app-overlay"></div>

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
      on:addProject={openCreateProject}
      on:createDemo={() => {
        closeSettingsMenu();
        void createDemo();
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
  /* #190: two rows — the nav bar sizes itself, everything else gets the rest.
     A grid rather than a column flex because the overlay layer has to share a
     cell with `.projects-main`, which is what makes the panel start exactly
     where the header ends without anyone writing the header's height down.

     mobile-k1: the column is `minmax(0, 1fr)`. An implicit column is `auto`,
     so wide content (navbar, calendar) made it wider than a phone and, with
     `overflow: hidden` still scrollable programmatically, the root could be
     shifted sideways. */
  .projects-container {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    overflow: hidden;
  }

  .projects-main {
    grid-row: 2;
    grid-column: 1;
    /* #190: the containing block for the fallback branch of `portalToOverlay`,
       and — with a z-index — a stacking context, so a popup inside the view
       cannot paint over the layer above it. */
    position: relative;
    z-index: var(--ppp-z-base);
    display: flex;
    flex-direction: column;
    min-height: 0;
    /* v3.2.8: overflow-x: hidden prevents horizontal expansion that pushes sidebar off-screen */
    overflow-x: hidden;
    overflow-y: auto;
    /* v3.1.0: Prevent scroll chaining to Obsidian body on mobile */
    overscroll-behavior: contain;
  }

  /* ios-s1. `View`'s root is `height: 100%` of `.projects-main`, and the
     filter row sits above it in the same column, so every view was one filter
     row taller than its room (measured: the phone agenda drawer ended 52 px
     below the window). The overhang made `.projects-main` scroll, but a board,
     a calendar or an agenda contain their own overscroll, so a finger inside
     them could never reach it — the bottom of every view was simply lost.
     A flexed item with a zero basis in a column of definite height has a
     definite height, so the view's `100%` now resolves to what is left. */
  .ppp-view-fill {
    flex: 1 1 0;
    min-height: 0;
  }

  /* ios-s1 — the end of each view above Obsidian's bottom bar.

     The host variable, not a measurement and not our own arithmetic:
     Obsidian (1.13 app.css) defines `--view-bottom-spacing` on `.is-phone`,
     0 by default and navbar height + home-indicator inset under
     `.is-floating-nav` / `.auto-full-screen`, and its own Bases view reserves
     exactly this at the end of its card and table containers. Reading the
     same value keeps us level with the host, never doubles it, and is 0 on
     desktop and tablets (unset there, hence the fallback).

     The space goes INSIDE the box that actually scrolls each view, so content
     still slides under the translucent bar and the last item can be lifted
     above it. Each scroller below owns it once; nothing above them is shrunk.
     The ones another component owns are reached from here, the way the
     short-landscape rule below already reaches the navbar and filter row:
       - the dashboard scrolls in its `ViewContent`; the canvas root fills that
         at `min-height: 100%`, so the space is its own bottom padding, inside
         that 100%;
       - the calendar's month and year layers scroll in their `ViewContent`
         the same way (week/day/timeline scroll in their own wrapper, which
         reserves the space itself in InfiniteHorizontalCalendar). */
  .projects-main :global(.ppp-database-root),
  .projects-main :global(.view-layer--month.view-layer--active),
  .projects-main :global(.view-layer--year.view-layer--active) {
    box-sizing: border-box;
    padding-bottom: var(--view-bottom-spacing, 0);
  }

  /* ios-s1: on touch the settings panel is capped at the window below the
     plugin navbar (SettingsMenuPopover's `--below-nav`) and scrolls as one,
     so its "Done" footer ended under the host bar. A trailing spacer of the
     host's own height lets it scroll clear; a spacer rather than padding
     because the panel is a flex column, where end padding is not reliably
     part of the scrollable overflow in WebKit. */
  .projects-container :global(.settings-popover--below-nav::after) {
    content: "";
    flex: none;
    height: var(--view-bottom-spacing, 0);
  }

  /* #190. No size of its own: it IS the second grid row, in the same cell as
     `.projects-main`.

     `clip`, not `hidden` — `hidden` would make this a scroll container, and the
     closed panel parked at `translateX(100%)` would become scrollable overflow.
     `.projects-container` above says `hidden` for its own reasons; the two are
     not the same case and must not be "aligned".

     `pointer-events: none` so an empty layer over the whole view is not a
     transparent lid; whatever is portalled in re-enables them for itself. */
  .ppp-app-overlay {
    grid-row: 2;
    grid-column: 1;
    position: relative;
    overflow: clip;
    pointer-events: none;
    z-index: var(--ppp-z-overlay);
  }

  /* ios-l1 L1: the navbar's filter button exists only for the short-landscape
     rule below; everywhere else the filter row is on screen and is the trigger. */
  .ppp-nav-filter {
    display: none;
  }

  /* ios-l1 L1 — short landscape. A phone on its side leaves the plugin well
     under 18rem of height, and a two-row navbar plus a filter row took 41% of
     it before the view began. Here the chrome is one row: tab icon and label
     side by side at the same 2.75rem touch height, and the filter row folded
     into a navbar button that opens the very same popover.

     One query, kept on the shell, so the three components it reaches into
     cannot disagree about when the phone is "short". `em` in a media query is
     the initial font size, so 30em does not move with the theme. Only the
     rows inside the grid change: the navbar stays in row 1 and the #190 layer
     in row 2, so nothing anchored to the navbar's bottom edge moves. */
  @media (orientation: landscape) and (max-height: 30em) {
    /* The sheet stops at the navbar instead of covering it; its own
       `overflow-y: auto` scrolls whatever no longer fits. 85vh stays the
       fallback until the first measurement lands. The room measured here runs
       to the window's bottom edge, under Obsidian's bar; the sheet keeps the
       host's `--view-bottom-spacing` clear INSIDE this cap (FloatingPopup), so
       the cap itself is not reduced a second time. */
    .projects-container {
      --ppp-bottom-sheet-max-h: var(--ppp-below-nav-h, 85vh);
    }

    .projects-container :global(.compact-navbar) {
      padding-block: 0;
    }

    .projects-container :global(.view-switcher .view-item) {
      flex-direction: row;
      gap: 0.375rem;
      padding-block: 0;
    }

    /* A read-only bar has no popover, so its pills stay: they are the only
       place its active filter is visible. */
    .projects-container :global(.ppp-viewfilter--editable) {
      padding: 0;
    }

    .projects-container :global(.ppp-viewfilter--editable > .ppp-filterpills),
    .projects-container :global(.ppp-viewfilter--editable > .ppp-viewfilter-save),
    .projects-container :global(.ppp-viewfilter--editable > .ppp-viewfilter-name) {
      display: none;
    }

    .ppp-nav-filter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      min-width: 2.75rem;
      min-height: 2.75rem;
    }
  }

  .ppp-nav-filter--active {
    color: var(--text-accent);
  }

  .ppp-nav-filter-count {
    font-size: var(--font-ui-smaller);
    font-weight: var(--font-semibold, 600);
  }
</style>
