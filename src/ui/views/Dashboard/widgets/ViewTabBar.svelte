<script lang="ts">
  /**
   * Dashboard V2 (DG-5) — multi-view tab bar.
   *
   * #088 (W1, NOTION_GRADE_PIPELINE): tabs are managed where they live —
   * `+` opens a view-type chooser (Table/Board/Calendar/Gallery), each tab
   * has a ⋯ menu (rename inline / delete, guarded for the last tab),
   * double-click renames. All menus go through the canonical contextMenu.
   */
  import { createEventDispatcher, tick } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { openContextMenu } from "src/lib/contextMenu";
  import type { ViewTab } from "../types";

  export let tabs: ViewTab[];
  export let activeTabId: string;
  export let readonly = false;

  const dispatch = createEventDispatcher<{
    tabSwitch: string;
    tabAdd: ViewTab["viewType"];
    tabRemove: string;
    tabRename: { id: string; label: string };
  }>();

  const VIEW_ICONS: Record<ViewTab["viewType"], string> = {
    table: "table",
    board: "columns",
    calendar: "calendar",
    gallery: "layout-grid",
    list: "list",
    timeline: "gantt-chart",
    chart: "bar-chart-2",
    stats: "trending-up",
  };

  /** View types offered for creation (V2 active set). */
  const CREATABLE: ReadonlyArray<{ type: ViewTab["viewType"]; key: string; def: string }> = [
    { type: "table", key: "views.dashboard.database-call.view-type.table", def: "Table" },
    { type: "board", key: "views.dashboard.database-call.view-type.board", def: "Board" },
    { type: "calendar", key: "views.dashboard.database-call.view-type.calendar", def: "Calendar" },
    { type: "gallery", key: "views.dashboard.database-call.view-type.gallery", def: "Gallery" },
  ];

  let renamingId: string | null = null;
  let renameValue = "";
  let renameEl: HTMLInputElement | null = null;

  function handleTabClick(id: string) {
    if (id !== activeTabId) dispatch("tabSwitch", id);
  }

  function openAddMenu(e: MouseEvent) {
    openContextMenu(
      CREATABLE.map((v) => ({
        title: $i18n.t(v.key, { defaultValue: v.def }),
        icon: VIEW_ICONS[v.type],
        onClick: () => dispatch("tabAdd", v.type),
      })),
      e
    );
  }

  async function startRename(tab: ViewTab) {
    renamingId = tab.id;
    renameValue = tab.label;
    await tick();
    renameEl?.focus();
    renameEl?.select();
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      dispatch("tabRename", { id: renamingId, label: renameValue.trim() });
    }
    renamingId = null;
  }

  function openTabMenu(tab: ViewTab, e: MouseEvent) {
    if (readonly) return;
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(
      [
        {
          title: $i18n.t("views.dashboard.database-call.tab-rename", { defaultValue: "Rename" }),
          icon: "pencil",
          onClick: () => void startRename(tab),
        },
        {
          title: $i18n.t("views.dashboard.database-call.tab-delete", { defaultValue: "Delete view" }),
          icon: "trash",
          danger: true,
          disabled: tabs.length <= 1,
          onClick: () => dispatch("tabRemove", tab.id),
        },
      ],
      e
    );
  }
</script>

<div class="ppp-view-tab-bar" role="tablist">
  {#each tabs as tab (tab.id)}
    {#if renamingId === tab.id}
      <input
        bind:this={renameEl}
        class="ppp-view-tab-rename"
        type="text"
        bind:value={renameValue}
        on:keydown={(e) => {
          if (e.key === "Enter") commitRename();
          else if (e.key === "Escape") renamingId = null;
        }}
        on:blur={commitRename}
      />
    {:else}
      <button
        class="ppp-view-tab"
        class:ppp-view-tab--active={tab.id === activeTabId}
        role="tab"
        aria-selected={tab.id === activeTabId}
        aria-controls="ppp-tab-panel-{tab.id}"
        on:click={() => handleTabClick(tab.id)}
        on:dblclick={() => { if (!readonly) void startRename(tab); }}
        on:contextmenu={(e) => openTabMenu(tab, e)}
      >
        <span class="ppp-view-tab-icon" aria-hidden="true">
          <Icon name={VIEW_ICONS[tab.viewType] ?? "layout-grid"} size="sm" />
        </span>
        <span class="ppp-view-tab-label">{tab.label}</span>
        {#if tab.id === activeTabId && !readonly}
          <span
            class="ppp-view-tab-more"
            role="button"
            tabindex="-1"
            aria-label={$i18n.t("views.dashboard.database-call.tab-menu", { defaultValue: "View options" })}
            on:click|stopPropagation={(e) => openTabMenu(tab, e)}
            on:keydown={() => {}}
          ><Icon name="more-horizontal" size="sm" /></span>
        {/if}
      </button>
    {/if}
  {/each}
  {#if !readonly}
    <button
      class="ppp-view-tab-add clickable-icon"
      on:click={openAddMenu}
      aria-label={$i18n.t("views.dashboard.database-call.tab-add", { defaultValue: "Add view" })}
      title={$i18n.t("views.dashboard.database-call.tab-add", { defaultValue: "Add view" })}
    >+</button>
  {/if}
</div>

<style>
  .ppp-view-tab-bar {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    /* ios-l1 L2: tiles keep their width, the strip scrolls natively. A shade per edge; a `local`
       cover riding with the content hides it at the end, so a shade means "more" — no script. */
    background:
      linear-gradient(to right, var(--background-secondary) 50%, transparent) left / 2em 100% no-repeat local,
      linear-gradient(to left, var(--background-secondary) 50%, transparent) right / 2em 100% no-repeat local,
      linear-gradient(to right, var(--background-modifier-box-shadow), transparent) left / 0.75em 100% no-repeat,
      linear-gradient(to left, var(--background-modifier-box-shadow), transparent) right / 0.75em 100% no-repeat,
      var(--background-secondary);
    min-width: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .ppp-view-tab {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: var(--font-ui-small, 0.875rem);
    white-space: nowrap;
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-view-tab--active {
    background: var(--background-primary);
    color: var(--text-accent);
    font-weight: 600;
    box-shadow: 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05);
  }

  .ppp-view-tab-icon { display: flex; align-items: center; flex-shrink: 0; }

  .ppp-view-tab-label {
    max-width: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ppp-view-tab-more {
    display: inline-flex;
    align-items: center;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    transition: opacity 120ms ease;
  }

  /* Hover-revealed only where hover exists; a finger has no hover to find it. The active tab
     out-ranked the plain hover tint by source order; `:not` keeps that inside the gate. */
  @media (hover: hover) and (pointer: fine) {
    .ppp-view-tab:hover:not(.ppp-view-tab--active) { background: var(--background-modifier-hover); color: var(--text-normal); }
    .ppp-view-tab-more { opacity: 0; }
    .ppp-view-tab:hover .ppp-view-tab-more, .ppp-view-tab:focus-visible .ppp-view-tab-more { opacity: 1; }
    .ppp-view-tab-more:hover { color: var(--text-normal); }
    .ppp-view-tab-add:hover { background: var(--background-modifier-hover); color: var(--text-normal); }
  }

  .ppp-view-tab-rename {
    height: 1.75rem;
    max-width: 10rem;
    font-size: var(--font-ui-small);
  }

  .ppp-view-tab-add {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 1rem;
    margin-left: 0.25rem;
  }

  /* On touch the shades are the cue, so the scrollbar can go. ios-t1: tabs are a target tall,
     and the active tab's menu fills that height in its own box beside the label. */
  @media (pointer: coarse) {
    .ppp-view-tab-bar { scrollbar-width: none; }
    .ppp-view-tab { padding-block: 0; min-height: var(--ppp-touch-target-min); }
    .ppp-view-tab-more { align-self: stretch; justify-content: center; min-width: var(--ppp-touch-target-min); }
    .ppp-view-tab-add { width: var(--ppp-touch-target-min); height: var(--ppp-touch-target-min); }
  }
</style>
