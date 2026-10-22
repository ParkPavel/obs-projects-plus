<script lang="ts">
  /**
   * WidgetHeaderActions — B7: the block header carries ONE action control,
   * the always-visible «⋯». Configure, data steps, collapse, pin, duplicate
   * and delete all live in that menu (widgetMenu.ts) instead of a row of
   * hover icons. Pure presentation: every choice is dispatched as a semantic
   * event and the host decides what it means.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { openContextMenu } from "src/lib/contextMenu";
  import { buildWidgetMenuEntries, type PipelineIntent } from "./widgetMenu";
  import { useBlockProperties, type PropertiesTarget } from "../layout/blockProperties";
  import { useBlockInsert } from "../layout/blockInsert";

  export let readonly: boolean;
  /** i3-dash: the block, so the menu can offer «Properties» of the source it reads. */
  export let widget: (PropertiesTarget & { id?: string }) | undefined = undefined;
  /** Widget type has a config panel (configPanelRegistry hasCog). */
  export let hasCog: boolean;
  /** Widget type supports the transform pipeline. */
  export let hasPipeline: boolean;
  /** A database block: offers block filter and the plain-words data steps. */
  export let isDatabase = false;
  export let pipelineStepCount = 0;
  export let locked = false;
  export let collapsed = false;

  const dispatch = createEventDispatcher<{
    toggleConfig: void;
    togglePipeline: PipelineIntent | null;
    toggleLock: void;
    toggleCollapse: void;
    filter: void;
    duplicate: void;
    remove: void;
    rename: void;
  }>();

  // i3-dash: provided by the dashboard grid; absent when the header is rendered on its own.
  const blockProperties = useBlockProperties();

  function propertiesEntry(): { properties?: { label: string; open: () => void } } {
    const source = widget && blockProperties ? blockProperties.sourceFor(widget) : null;
    if (source === null || !blockProperties) return {};
    const label = $i18n.t("views.dashboard.widget.menu-properties", { defaultValue: "Properties of «{{source}}»…", source });
    return { properties: { label, open: blockProperties.open } };
  }

  // i3-close: «Insert block after», offered by the grid in tiles only; the
  // palette opens at this menu button, the block's own place on the page.
  const blockInsert = useBlockInsert();
  let menuBtn: HTMLButtonElement | null = null;

  function insertEntry(): { onInsertAfter?: () => void } {
    const id = widget?.id;
    if (id === undefined || !blockInsert?.available()) return {};
    return { onInsertAfter: () => blockInsert.after(id, menuBtn) };
  }

  export function menuEntries() {
    return buildWidgetMenuEntries({
      hasCog, isDatabase, hasPipeline, pipelineStepCount, locked, collapsed, ...propertiesEntry(), ...insertEntry(),
      t: (k, d) => $i18n.t(k, { defaultValue: d }),
      onRename: () => dispatch("rename"),
      onConfigure: () => dispatch("toggleConfig"),
      onFilter: () => dispatch("filter"),
      onPipeline: (intent) => dispatch("togglePipeline", intent),
      onToggleCollapse: () => dispatch("toggleCollapse"),
      onToggleLock: () => dispatch("toggleLock"),
      onDuplicate: () => dispatch("duplicate"),
      onRemove: () => dispatch("remove"),
    });
  }
</script>

{#if !readonly}
  {#if locked}
    <span class="ppp-widget-locked-mark" aria-label={$i18n.t("views.dashboard.widget.locked", { defaultValue: "Position pinned" })}
      title={$i18n.t("views.dashboard.widget.locked", { defaultValue: "Position pinned" })}><Icon name="lock" size="sm" /></span>
  {/if}
  <button
    bind:this={menuBtn}
    class="ppp-widget-menu-btn clickable-icon"
    on:click={(e) => openContextMenu(menuEntries(), e)}
    aria-label={$i18n.t("views.dashboard.widget.menu", { defaultValue: "Block menu" })}
    title={$i18n.t("views.dashboard.widget.menu", { defaultValue: "Block menu" })}
    aria-haspopup="menu"
  ><Icon name="more-horizontal" size="sm" /></button>
{/if}

<style>
  /* The one discoverable entry: always visible, always a tab stop. */
  .ppp-widget-menu-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-widget-menu-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-widget-locked-mark {
    display: inline-flex;
    align-items: center;
    color: var(--text-faint);
  }
</style>
