<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ViewDefinition, ViewId } from "src/settings/settings";
  import AddViewButton from "./AddViewButton.svelte";
  import ViewSwitcher from "./ViewSwitcher.svelte";
  import SettingsMenuButton from "./SettingsMenuButton.svelte";
  import ViewSpecificActions from "./ViewSpecificActions.svelte";
  import SaveStatusChip from "src/ui/components/SaveStatus/SaveStatusChip.svelte";

  export let views: ViewDefinition[] = [];
  export let viewId: ViewId | undefined;
  export let view: ViewDefinition | undefined = undefined;

  const dispatch = createEventDispatcher<{
    addView: void;
    openSettings: MouseEvent;
    centerToday: void;
    toggleAgenda: void;
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
  <ViewSwitcher
    {views}
    activeViewId={viewId}
    onSelect={(id) => dispatch("viewChange", id)}
  />

  <div class="right">
    <SaveStatusChip />
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
    background: var(--background-secondary);
    backdrop-filter: blur(0.625rem) saturate(180%);
    -webkit-backdrop-filter: blur(0.625rem) saturate(180%);
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
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

</style>
