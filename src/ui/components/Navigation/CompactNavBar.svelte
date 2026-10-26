<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Platform } from "obsidian";
  import { moveToViewHeader } from "src/ui/actions/moveToViewHeader";
  import type { ViewDefinition, ViewId } from "src/settings/settings";
  import AddViewButton from "./AddViewButton.svelte";
  import ViewSwitcher from "./ViewSwitcher.svelte";
  import SettingsMenuButton from "./SettingsMenuButton.svelte";
  import ViewSpecificActions from "./ViewSpecificActions.svelte";
  import SaveStatusChip from "src/ui/components/SaveStatus/SaveStatusChip.svelte";
  import BlockOutlineButton from "src/ui/views/Dashboard/layout/BlockOutlineButton.svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { blockOutlineStore } from "src/ui/views/Dashboard/layout/blockOutline";

  // w4-p10a (N15): a dashboard's table of contents, when the view publishes one.
  const outlineStore = blockOutlineStore();
  $: outline = outlineStore ? $outlineStore : null;
  let addBlockEl: HTMLButtonElement | null = null;

  export let views: ViewDefinition[] = [];
  export let viewId: ViewId | undefined;
  export let view: ViewDefinition | undefined = undefined;
  /** Agenda state for the icon/label; undefined falls back to the view config. */
  export let agendaOpen: boolean | undefined = undefined;

  const dispatch = createEventDispatcher<{
    addView: void;
    openSettings: MouseEvent;
    centerToday: void;
    toggleAgenda: void;
    setInterval: string;
    freezeColumns: void;
    viewChange: ViewId;
  }>();
</script>

<!--
  #197: the navbar carries views and actions, and says nothing about projects.

  It used to change shape with the project count — a switcher above one project,
  a static label at one, nothing at zero — and every one of those forms competed
  with the view switcher for the same row. The settings panel already owned this
  and owned more of it: its Projects tab selects, renames, deletes and creates,
  where the navbar could only select. So this is a deletion, not a move.

  What went with it: the check that compared the current project's name against
  the demo project's, spelled as a literal, and the media query that already hid
  the whole block on narrow and touch screens — the product had conceded the
  point there first. Neither name is written here, because the test guarding
  this decision scans the file for them and cannot tell a mention from a use.
-->
<nav class="compact-navbar">
  <!-- i3-nav: on a phone the tabs live in the leaf header (moveToViewHeader). -->
  <div class="compact-navbar-tabs" use:moveToViewHeader={Platform.isPhone === true}>
    <ViewSwitcher
      {views}
      activeViewId={viewId}
      onSelect={(id) => dispatch("viewChange", id)}
    />
  </div>

  {#if outline && outline.items.length > 1}
    <BlockOutlineButton {outline} />
  {/if}
  {#if outline?.insert}
    <!-- w4-p10 (N7): «+ Block» after the selected block, else the one on screen. -->
    <button bind:this={addBlockEl} type="button" class="ppp-block-add clickable-icon" data-block-add
      aria-label={$i18n.t("views.dashboard.insert.add", { defaultValue: "Add block" })}
      title={$i18n.t("views.dashboard.insert.add", { defaultValue: "Add block" })}
      on:click={() => outline?.insert?.(addBlockEl)}>+ {$i18n.t("views.dashboard.insert.block", { defaultValue: "Block" })}</button>
  {/if}

  <div class="right">
    <SaveStatusChip />
    <AddViewButton onAdd={() => dispatch("addView")}/>
    <SettingsMenuButton onOpen={(event) => dispatch("openSettings", event)}/>
    <ViewSpecificActions
      {view}
      {agendaOpen}
      onCenterToday={() => dispatch("centerToday")}
      onToggleAgenda={() => dispatch("toggleAgenda")}
      onFreezeColumns={() => dispatch("freezeColumns")}
      onSetInterval={(interval) => dispatch("setInterval", interval)}
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
    background: var(--background-secondary);
    backdrop-filter: blur(0.625rem) saturate(180%);
    -webkit-backdrop-filter: blur(0.625rem) saturate(180%);
    border-bottom: var(--ppp-border-width) solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  /* The tab strip's wrapper takes the room the strip took before it. */
  .compact-navbar-tabs {
    display: flex;
    flex: 1 1 0;
    min-width: 0;
  }

  /* i3-nav: in the leaf header (a phone) the strip fills the title's place
     and the plugin bar keeps only the tools, at the end of the row. */
  :global(.ppp-tabs-in-header .view-header-title) {
    display: none;
  }
  /* w4-p09 (N1): a theme may style the header, not hide the strip in it.
     Things shows the title container only on hover (a phone has none);
     Minimal hides it with "hide tab title" and in focus mode. */
  :global(.ppp-tabs-in-header .view-header-title-container) {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    opacity: 1 !important;
    visibility: visible !important;
  }
  :global(.ppp-tabs-in-header .view-header-title-container > .compact-navbar-tabs) {
    width: 100%;
  }
  :global(.ppp-tabs-in-header .compact-navbar) {
    justify-content: flex-end;
  }

  /* ios-l1 L3: the actions take their own width first and never shrink; the
     view strip gets only what is left (`flex: 1 1 0` in ViewSwitcher) and
     clips at its own edge, so a tab can scroll but cannot reach an icon. */
  .right {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs, 0.375rem);
    flex: 0 0 auto;
  }

  /* theme-compat: anchored to the navbar. A bare `:global(.clickable-icon)`
     here restyled every clickable icon in Obsidian (the ribbon, the tab
     header) once the plugin view mounted. R0.35 keeps it from coming back. */
  .compact-navbar :global(.clickable-icon) {
    padding: 0.625rem;
    border-radius: 0.625rem;
  }

  .compact-navbar :global(.clickable-icon:focus-visible) {
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

</style>
