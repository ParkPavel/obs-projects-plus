<script context="module" lang="ts">
  import { SOURCES, TRIGGERS } from "svelte-dnd-action";

  // ── ios-d1: a grip press that starts no drag must not leave the board armed ──
  //
  // `dragHandleZone` keeps every item drag-disabled until a `dragHandle` is
  // pressed, and the flag it flips is ONE module-level store shared by every
  // zone on the page: each card list and the column row. The library re-disables
  // the items only on a POINTER `finalize` or a KEYBOARD `dragStopped`
  // `consider`. A press on a grip that never moves far enough to start a drag
  // (a tap) produces neither, so every card in every column stays armed and the
  // next plain pan on a card body starts a drag instead of scrolling the board.
  // WidgetGrid closes the same hole for widgets (ios-g1); this is that pattern
  // for the board, shared by CardList (card grips) and Board (column grips).
  const disarmEvents = new WeakSet<Event>();

  /** Whether a `consider` is the disarm signal below rather than a real drag. */
  export function isDisarmEvent(e: Event): boolean {
    return disarmEvents.has(e);
  }

  /**
   * On release after a press on `grip` (inside `node`, a `dragHandleZone`) that
   * started no drag, disarm through the one public route the library listens
   * to: a `consider` it reads as "keyboard drag stopped". That event is ours,
   * never a reorder; the zone's own handlers drop it via `isDisarmEvent`.
   */
  export function disarmAfterGripTap(node: HTMLElement, grip: string): { destroy: () => void } {
    let pressed = false;
    let dragStarted = false;

    function onPress(e: Event) {
      if (!(e.target instanceof Element) || !e.target.closest(grip)) return;
      pressed = true;
      dragStarted = false;
    }
    function onConsider(e: Event) {
      // A real `consider` means a drag is under way; the library disarms the
      // zones itself when that drag finalizes.
      if (!disarmEvents.has(e)) dragStarted = true;
    }
    function onRelease() {
      if (!pressed) return;
      pressed = false;
      if (dragStarted) return;
      const disarm = new CustomEvent("consider", {
        detail: { items: [], info: { trigger: TRIGGERS.DRAG_STOPPED, id: "", source: SOURCES.KEYBOARD } },
      });
      disarmEvents.add(disarm);
      node.dispatchEvent(disarm);
    }

    // Capture on the zone: runs before the grip's own handler, whatever it does.
    node.addEventListener("mousedown", onPress, true);
    node.addEventListener("touchstart", onPress, { capture: true, passive: true });
    node.addEventListener("consider", onConsider);
    window.addEventListener("mouseup", onRelease);
    window.addEventListener("touchend", onRelease);
    window.addEventListener("touchcancel", onRelease);
    return {
      destroy() {
        node.removeEventListener("mousedown", onPress, true);
        node.removeEventListener("touchstart", onPress, true);
        node.removeEventListener("consider", onConsider);
        window.removeEventListener("mouseup", onRelease);
        window.removeEventListener("touchend", onRelease);
        window.removeEventListener("touchcancel", onRelease);
      },
    };
  }
</script>

<script lang="ts">
  // import { Checkbox, InternalLink} from "obsidian-svelte";
  import { Checkbox, Icon } from "obsidian-svelte";
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
  import InternalLink from "src/ui/components/InternalLink.svelte";

  import {
    isString,
    type DataField,
    type DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { app } from "src/lib/stores/obsidian";
  import { openRecord } from "src/lib/record/openRecord";
  import { i18n } from "src/lib/stores/i18n";
  import { isTouchDevice } from "src/lib/stores/ui";
  import CardMetadata from "src/ui/components/CardMetadata/CardMetadata.svelte";
  import ColorItem from "src/ui/components/ColorItem/ColorItem.svelte";
  import { PageIcon } from "src/ui/components/PageIcon";
  import {
    getRecordColorContext,
    handleHoverLink,
    showMobileNavMenu,
    sortRecordsContext,
  } from "src/ui/views/helpers";
  // TRIGGERS comes from the module script above; a second import would clash.
  import {
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    dragHandleZone,
    dragHandle,
  } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { excludeHeaderField, getDisplayName } from "./boardHelpers";
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
  export let iconField: DataField | undefined = undefined;
  export let boardEditing: boolean;
  export let disableDnd: boolean = false;
  /** The data is read-only (a source block): the pencil opens the note, and says so. */
  export let readOnly: boolean = false;

  const getRecordColor = getRecordColorContext.get();
  const sortRecords = sortRecordsContext.get();

  const flipDurationMs = 150;

  let dragItem: DataRecord | undefined;
  function handleDndConsider(e: CustomEvent<DndEvent<DataRecord>>) {
    if (isDisarmEvent(e)) return;
    const { detail } = e;
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

  $: bodyFields = excludeHeaderField(includeFields, customHeader);
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
      borderRadius: "0.3125rem",
      background: "var(--board-column-drag-accent)",
      transition: "all 150ms ease-in-out",
    },
    dragDisabled: boardEditing || disableDnd,
    morphDisabled: true,
    // ios-d1: the library picks the drop zone from the CLONE's centre. The grip
    // sits at the card's left edge, so on a phone the centre of a card dragged
    // by it hangs a card-half right of the finger, past the viewport, and the
    // card never lands in the next column. On touch, centre the clone on the
    // finger; the mouse keeps the grab offset it has always had.
    centreDraggedOnCursor: $isTouchDevice,
  }}
  use:disarmAfterGripTap={".board-card-grip"}
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
      <span class="board-card-grip" use:dragHandle aria-label={$i18n.t("common.drag-to-reorder")}>
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
          {#if iconField}
            <PageIcon value={item.values[iconField.name]} />
          {/if}
          {#if !customHeader}
            <InternalLink
              linkText={item.id}
              sourcePath={item.id}
              resolved
              on:open={({ detail: { linkText, sourcePath, newLeaf, shiftKey } }) => {
                // v3.0.8: Unified note navigation — Shift → new window, Ctrl → new tab, else → modal
                if (shiftKey) {
                  void openRecord({ id: linkText, sourcePath }, "window", { app: $app });
                } else if (newLeaf) {
                  void openRecord({ id: linkText, sourcePath }, "tab", { app: $app });
                } else {
                  onRecordClick(item);
                }
              }}
              on:longpress={({ detail: { linkText, sourcePath, event } }) => {
                showMobileNavMenu($app, { id: linkText, sourcePath }, event, () => onRecordClick(item));
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
                tooltip={$i18n.t(readOnly ? "common.open-note" : "components.note.edit")}
                onClick={(event) => {
                  // The card itself opens the record on click; open it once.
                  event.stopPropagation();
                  onRecordClick(item);
                }}
              />
            </span>
          {:else}
            <CardMetadata fields={[customHeader]} record={item} />
          {/if}
        </div>
        <CardMetadata fields={bodyFields} record={item} />
      </ColorItem>
    </article>
  {/each}
</div>

<style>
  .projects--board--card {
    transition: background 150ms ease, box-shadow 150ms ease;
    position: relative;
  }
  .projects--board--card:focus-within {
    background: var(--background-primary-alt);
    box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.08);
  }
  /* ios-t1: hover states reach only a pointer that hovers; a tap left them stuck. */
  @media (hover: hover) and (pointer: fine) {
    .projects--board--card:hover {
      background: var(--background-primary-alt);
      box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.08);
    }
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
    transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
    z-index: 1;
  }

  /* Hidden until the card is hovered — only where a hover exists. */
  @media (hover: hover) and (pointer: fine) {
    .board-card-grip {
      opacity: 0;
    }

    .projects--board--card:hover .board-card-grip {
      opacity: 0.45;
    }

    .board-card-grip:hover {
      opacity: 1;
      color: var(--text-muted);
      background: var(--background-modifier-hover);
    }
  }

  .board-card-grip:active {
    cursor: grabbing;
    color: var(--text-normal);
  }

  /* ios-d1: on touch the grip is the only way to move a card (a pan on the
     card body scrolls the board), so it is shown plainly and caught by a
     finger-sized hit area. The glyph keeps its size; the ::before box is the
     invisible target, centred on it — the geometry of `.ppp-touch-target`
     (tokens.css), written here because the glyph is absolutely positioned.
     Its touches land on the grip itself, so `touch-action: none` and the
     `dragHandle` listeners apply unchanged. Since ios-t1 the desktop hover
     rules above are gated, so no stuck hover can dim the grip here. */
  @media (pointer: coarse) {
    .board-card-grip {
      opacity: 0.7;
      color: var(--text-muted);
      width: 0.625rem;
      height: 1.125rem;
    }
    .board-card-grip::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
      transform: translate(-50%, -50%);
    }
    /* The hit area reaches past the glyph by half a target; the content starts
       after it (glyph centre = left 0.125rem + half its 0.625rem width), so the
       checkbox and title stay tappable and a press on them never arms a drag. */
    .projects--board--card {
      padding-left: calc(var(--ppp-touch-target-min) / 2 + 0.4375rem);
    }
  }
  div.card-header {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .card-header .edit-hint {
    margin-left: auto;
    transition: opacity 120ms ease;
  }

  /* The pencil is revealed by hover or keyboard focus where a hover exists. */
  @media (hover: hover) and (pointer: fine) {
    .card-header .edit-hint {
      opacity: 0;
      visibility: hidden;
    }

    .projects--board--card:hover .edit-hint,
    .projects--board--card:focus-within .edit-hint {
      opacity: 1;
      visibility: visible;
    }
  }

  .checkbox-wrapper {
    display: flex;
    flex-direction: column;
    align-self: start;
    margin-top: 0.25rem;
  }

  @media (pointer: coarse) {
    /* ios-t1: a tap on the card opens the record, which is all the pencil
       does, so on touch it is not a separate target to aim between. */
    .card-header .edit-hint {
      display: none;
    }

    /* ios-t1: the checkbox's finger square is its wrapper's own box. The
       wrapper is a target wide and tall, the box centred in it, and the
       input's ::before fills exactly that square — so the target starts where
       the grip's hit area ends (the card's left padding above) and ends before
       the title, covering neither. */
    .checkbox-wrapper {
      flex-shrink: 0;
      align-self: center;
      align-items: center;
      justify-content: center;
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
      margin-top: 0;
    }
    .checkbox-wrapper :global(input[type="checkbox"]) {
      position: relative;
      margin: 0;
    }
    .checkbox-wrapper :global(input[type="checkbox"]::before) {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
      transform: translate(-50%, -50%);
    }
  }
</style>
