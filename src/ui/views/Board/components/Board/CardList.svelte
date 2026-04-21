<script lang="ts">
  // import { Checkbox, InternalLink} from "obsidian-svelte";
  import { Checkbox, Icon, IconButton } from "obsidian-svelte";
  import InternalLink from "src/ui/components/InternalLink.svelte";

  import {
    isString,
    type DataField,
    type DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { app } from "src/lib/stores/obsidian";
  import { i18n } from "src/lib/stores/i18n";
  import CardMetadata from "src/ui/components/CardMetadata/CardMetadata.svelte";
  import ColorItem from "src/ui/components/ColorItem/ColorItem.svelte";
  import {
    getRecordColorContext,
    handleHoverLink,
    showMobileNavMenu,
    sortRecordsContext,
  } from "src/ui/views/helpers";
  import {
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    TRIGGERS,
    dragHandleZone,
    dragHandle,
  } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { getDisplayName } from "./boardHelpers";
  import type {
    DropTrigger,
    OnRecordClick,
    OnRecordCheck,
    OnRecordDrop,
  } from "./types";

  export let items: DataRecord[];
  export let onRecordClick: OnRecordClick;
  export let onRecordCheck: OnRecordCheck;
  export let onDrop: OnRecordDrop;
  export let includeFields: DataField[];
  export let checkField: string | undefined;
  export let customHeader: DataField | undefined;
  export let boardEditing: boolean;
  export let disableDnd: boolean = false;

  const getRecordColor = getRecordColorContext.get();
  const sortRecords = sortRecordsContext.get();

  const flipDurationMs = 150;

  let dragItem: DataRecord | undefined;
  function handleDndConsider({ detail }: CustomEvent<DndEvent<DataRecord>>) {
    if (detail.info.trigger === TRIGGERS.DRAG_STARTED) {
      dragItem = items.find((item) => item.id === detail.info.id);
    }
    items = detail.items;
  }

  function handleDndFinalize({ detail }: CustomEvent<DndEvent<DataRecord>>) {
    items = sortRecords(detail.items);
    if (detail.info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
      dragItem = items.find((item) => item.id === detail.info.id);
    }
    if (dragItem) {
      onDrop(dragItem, items, detail.info.trigger as DropTrigger);
      dragItem = undefined;
    }
  }

  const isPlaceholder = (item: DataRecord) =>
    !!(item as any)[SHADOW_ITEM_MARKER_PROPERTY_NAME];
</script>

  <div
  class="projects--board--card-list"
  on:consider={handleDndConsider}
  on:finalize={handleDndFinalize}
  use:dragHandleZone={{
    type: "card",
    items,
    flipDurationMs,
    dropTargetStyle: {
      outline: "none",
      borderRadius: "5px",
      background: "var(--board-column-drag-accent)",
      transition: "all 150ms ease-in-out",
    },
    dragDisabled: boardEditing || disableDnd,
    morphDisabled: true,
  }}
>
  {#each items as item (item.id)}
    {@const color = getRecordColor(item)}

    <article
      class="projects--board--card"
      class:projects--board--card-placeholder={isPlaceholder(item)}
      on:keypress
      on:click={() => onRecordClick(item)}
      animate:flip={{ duration: flipDurationMs }}
    >
      <span class="board-card-grip" use:dragHandle aria-label="Drag to reorder">
        <Icon name="grip-vertical" size="xs" />
      </span>
      <ColorItem {color}>
        <div slot="header" class="card-header">
          {#if checkField}
            <span class="checkbox-wrapper">
              <Checkbox
                checked={checkField !== undefined
                  ? !!item.values[checkField]
                  : false}
                on:check={({ detail: checked }) => onRecordCheck(item, checked)}
              />
            </span>
          {/if}
          {#if !customHeader}
            <InternalLink
              linkText={item.id}
              sourcePath={item.id}
              resolved
              on:open={({ detail: { linkText, sourcePath, newLeaf, shiftKey } }) => {
                // v3.0.8: Unified note navigation — Shift → new window, Ctrl → new tab, else → modal
                if (shiftKey) {
                  $app.workspace.openLinkText(linkText, sourcePath, 'window');
                } else if (newLeaf) {
                  $app.workspace.openLinkText(linkText, sourcePath, 'tab');
                } else {
                  onRecordClick(item);
                }
              }}
              on:longpress={({ detail: { linkText, sourcePath, event } }) => {
                showMobileNavMenu($app, linkText, sourcePath, event, () => onRecordClick(item));
              }}
              on:hover={({ detail: { event, sourcePath } }) => {
                handleHoverLink(event, sourcePath);
              }}
            >
              {@const path = item.values["path"]}
              {getDisplayName(isString(path) ? path : item.id)}
            </InternalLink>
            <span class="edit-hint">
              <IconButton
                icon="pencil"
                tooltip={$i18n.t("components.note.edit")}
                on:click={() => onRecordClick(item)}
              />
            </span>
          {:else}
            <CardMetadata fields={[customHeader]} record={item} />
          {/if}
        </div>
        <CardMetadata fields={includeFields} record={item} />
      </ColorItem>
    </article>
  {/each}
</div>

<style>
  .projects--board--card {
    transition: background 150ms ease, box-shadow 150ms ease;
    position: relative;
  }
  .projects--board--card:hover,
  .projects--board--card:focus-within {
    background: var(--background-primary-alt);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  /* Card drag grip — left edge tab, inset from card border */
  .board-card-grip {
    position: absolute;
    top: 50%;
    left: 0.125rem;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 0.5rem;
    height: 1rem;
    border-radius: var(--radius-s);
    color: var(--text-faint);
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
    z-index: 1;
  }

  .projects--board--card:hover .board-card-grip {
    opacity: 0.45;
  }

  .board-card-grip:hover {
    opacity: 1;
    color: var(--text-muted);
    background: var(--background-modifier-hover);
  }

  .board-card-grip:active {
    cursor: grabbing;
    color: var(--text-normal);
  }

  /* On touch devices, always show card grip (subtle) */
  @media (pointer: coarse) {
    .board-card-grip {
      opacity: 0.25;
      width: 0.625rem;
      height: 1.125rem;
    }
  }
  div.card-header {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .card-header .edit-hint {
    margin-left: auto;
    opacity: 0;
    visibility: hidden;
    transition: opacity 120ms ease;
  }

  .projects--board--card:hover .edit-hint,
  .projects--board--card:focus-within .edit-hint {
    opacity: 1;
    visibility: visible;
  }

  .checkbox-wrapper {
    display: flex;
    flex-direction: column;
    align-self: start;
    margin-top: 4px;
  }
</style>
