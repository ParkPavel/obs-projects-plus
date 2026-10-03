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

  // ── ios-c1: a grip in a disabled zone must not arm the drag ──
  //
  // `dragHandleZone` OVERWRITES the zone's own `dragDisabled` with the shared
  // arming flag (svelte-dnd-action 0.9.52, dist/index.mjs `getAddedOptions`),
  // so the `dragDisabled` a zone passes is never read. Any grip press arms every
  // zone, and the pressed item starts a drag even in a pinned or read-only
  // column, while editing or zoomed. The zone therefore decides itself: when
  // it is disabled, a press (or Enter/Space) on one of its grips is stopped
  // before the grip's `dragHandle` listener, so nothing is armed.

  interface DragZoneState {
    /** A column title or new column is being edited. */
    editing?: boolean;
    /** The zone is pinned or its data is read-only. */
    locked?: boolean;
    /** Board zoom; only the column row is gated by it. */
    zoom?: number;
  }

  /** Whether a drag may not start from a zone in this state. */
  export function isDragZoneDisabled(state: DragZoneState): boolean {
    return Boolean(state.editing) || Boolean(state.locked) || (state.zoom !== undefined && state.zoom !== 1);
  }

  interface GripGate {
    /** Selector of the zone's own grips. */
    grip: string;
    disabled: boolean;
  }

  /**
   * On `node` (a `dragHandleZone`): while `disabled`, stop a press or an
   * Enter/Space on one of its grips in the capture phase, so the grip's
   * `dragHandle` (target phase) never arms the shared flag. Other targets and
   * an enabled zone are untouched.
   */
  export function gateDisabledGrip(node: HTMLElement, gate: GripGate): { update: (gate: GripGate) => void; destroy: () => void } {
    let current = gate;

    function block(e: Event) {
      if (!current.disabled) return;
      if (!(e.target instanceof Element)) return;
      const grip = e.target.closest(current.grip);
      if (!grip || !node.contains(grip)) return;
      if (e.type === "keydown") {
        const key = (e as KeyboardEvent).key;
        if (key !== "Enter" && key !== " ") return;
      }
      e.stopPropagation();
    }

    node.addEventListener("mousedown", block, true);
    node.addEventListener("touchstart", block, { capture: true, passive: true });
    node.addEventListener("keydown", block, true);
    return {
      update(next: GripGate) {
        current = next;
      },
      destroy() {
        node.removeEventListener("mousedown", block, true);
        node.removeEventListener("touchstart", block, true);
        node.removeEventListener("keydown", block, true);
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
  import { getAnimationDuration } from "src/lib/helpers/animation";
  import { openRecord } from "src/lib/record/openRecord";
  import { i18n } from "src/lib/stores/i18n";
  import { isTouchDevice } from "src/lib/stores/ui";
  import CardMetadata from "src/ui/components/CardMetadata/CardMetadata.svelte";
  import { PageIcon } from "src/ui/components/PageIcon";
  import SharedCard from "src/ui/components/SharedCard/SharedCard.svelte";
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
  import { getCoverRealPath } from "src/ui/views/Gallery/gallery";
  import type { BoardThumbnailLayout } from "../../types";
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
  /** cards-g4 — where a card shows its cover, and the field it is read from. */
  export let thumbnailLayout: BoardThumbnailLayout = "none";
  export let coverField: DataField | undefined = undefined;
  export let boardEditing: boolean;
  export let disableDnd: boolean = false;
  /** The data is read-only (a source block): the pencil opens the note, and says so. */
  export let readOnly: boolean = false;

  const getRecordColor = getRecordColorContext.get();
  const sortRecords = sortRecordsContext.get();

  // cards-g1: `getAnimationDuration` is 0 under reduced motion (or the
  // plugin's instant setting), so the flip and the library's drop animation
  // stop together. Measured later, live, on 20/100/300-card boards with reduced
  // motion off and on: pointer-down on a grip to the first drag frame, and frame
  // time during repeated drags (p50/p95 of each, Performance panel).
  const flipDurationMs = getAnimationDuration(150);

  /** cards-g1: whether a click landed on the grip lane, which drags rather than opens the card. */
  const isGripTarget = (e: Event) => e.target instanceof Element && e.target.closest(".board-card-grip") !== null;

  $: zoneDisabled = isDragZoneDisabled({ editing: boardEditing, locked: disableDnd });

  let dragItem: DataRecord | undefined;
  // ios-c1 safeguard: a drag that still starts here while the zone is disabled
  // (the gate above should prevent it) is not committed by this zone. Its
  // `consider` is applied so the library's DOM stays consistent; its finalize
  // restores the order and calls no `onDrop`. Drops from other zones into this
  // one are not affected: they start no drag here.
  let rejectedDrag: DataRecord[] | undefined;
  function handleDndConsider(e: CustomEvent<DndEvent<DataRecord>>) {
    if (isDisarmEvent(e)) return;
    const { detail } = e;
    if (detail.info.trigger === TRIGGERS.DRAG_STARTED) {
      if (zoneDisabled) {
        rejectedDrag = items;
        dragItem = undefined;
      } else {
        dragItem = items.find((item) => item.id === detail.info.id);
      }
    }
    items = detail.items;
  }

  function handleDndFinalize({ detail }: CustomEvent<DndEvent<DataRecord>>) {
    if (rejectedDrag) {
      items = detail.info.trigger === TRIGGERS.DROPPED_INTO_ANOTHER ? sortRecords(detail.items) : rejectedDrag;
      rejectedDrag = undefined;
      dragItem = undefined;
      return;
    }
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

  /**
   * cards-g4: a card's thumbnail, resolved the gallery's way (an image file
   * or an http(s) URL in the cover field). No layout, no cover field, or a
   * value that is not an image resolves to nothing, and then the card renders
   * no media element at all: no placeholder on a kanban card.
   */
  // cards-g4: an image that resolves but fails to load (a dead link) drops its
  // media too, so a card never keeps an empty thumbnail box. The failure is
  // remembered on the record OBJECT: a data refresh brings new record objects
  // and so retries (a repaired image comes back), while a drag only reorders
  // the same objects and retries nothing. A WeakMap holds no removed record.
  let failedThumbs = new WeakMap<DataRecord, string>();
  let failedVersion = 0;
  function dropThumb(record: DataRecord, src: string) {
    failedThumbs.set(record, src);
    failedVersion += 1;
  }

  $: thumbnailOf = (record: DataRecord): { src: string; layout: "top" | "left" } | null => {
    void failedVersion;
    const layout = thumbnailLayout;
    if (layout === "none") return null;
    const src = getCoverRealPath($app, record, coverField);
    return src && failedThumbs.get(record) !== src ? { src, layout } : null;
  };
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
      // cards-g1: only the background changes; `all` also animated layout.
      transition: "background 150ms ease-in-out",
    },
    // Overwritten by `dragHandleZone`; `gateDisabledGrip` below enforces it.
    dragDisabled: disableDnd || zoneDisabled,
    morphDisabled: true,
    // ios-d1: the library picks the drop zone from the CLONE's centre. The grip
    // sits at the card's left edge, so on a phone the centre of a card dragged
    // by it hangs a card-half right of the finger, past the viewport, and the
    // card never lands in the next column. On touch, centre the clone on the
    // finger; the mouse keeps the grab offset it has always had.
    centreDraggedOnCursor: $isTouchDevice,
  }}
  use:disarmAfterGripTap={".board-card-grip"}
  use:gateDisabledGrip={{ grip: ".board-card-grip", disabled: zoneDisabled }}
>
  {#each items as item (item.id)}
    {@const color = getRecordColor(item)}
    {@const thumbnail = thumbnailOf(item)}

    <div
      class="ppp-board-card-slot"
      class:projects--board--card-placeholder={isPlaceholder(item)}
      animate:flip={{ duration: flipDurationMs }}
    >
      <!-- cards-g2: the zone's item is this plain wrapper, because `animate:flip`
           may only sit on an element directly in the keyed each, never on a
           component. svelte-dnd-action reads the zone's direct children: it
           arms, clones, hides and marks the shadow on this element, and the
           card inside moves with it. The placeholder class lives here too; the
           column and list find it with `:has()`, at any depth.
           cards-g1: the grip is the card's first grid lane; the content lane
           follows. -->
      <SharedCard
        recordId={item.id}
        variant="board"
        {color}
        interactive
        mediaLayout={thumbnail?.layout}
        on:keypress
        on:click={(e) => {
          if (!isGripTarget(e)) onRecordClick(item);
        }}
      >
        <span slot="grip" class="board-card-grip" use:dragHandle aria-label={$i18n.t("common.drag-to-reorder")}>
          <span class="board-card-grip-glyph"><Icon name="grip-vertical" size="xs" /></span>
        </span>
        <!-- cards-g4: the thumbnail is decorative (the title link names the
             record), loads lazily (a board may hold hundreds of cards) and has
             no handler of its own: a click on it is a click on the card body. -->
        <svelte:fragment slot="media">
          {#if thumbnail}
            <div
              class="ppp-board-card-media"
              class:ppp-board-card-media--top={thumbnail.layout === "top"}
              class:ppp-board-card-media--left={thumbnail.layout === "left"}
              aria-hidden="true"
            >
              <img src={thumbnail.src} alt="" loading="lazy" decoding="async" draggable="false" on:error={() => thumbnail && dropThumb(item, thumbnail.src)} />
            </div>
          {/if}
        </svelte:fragment>
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
        <CardMetadata slot="metadata" fields={bodyFields} record={item} />
      </SharedCard>
    </div>
  {/each}
</div>

<style>
  /* cards-g2: the card's own lanes (`.projects--board--card`: the grid, its
     focus and hover surface, the coarse-pointer lane width) moved to
     SharedCard.svelte with the article they style. What stays here styles
     what this list renders: the wrapper and what goes into the card's slots
     (the grip, the header row). A rule keyed on the card's hover or focus
     names the wrapper, which is exactly the card's box and an ancestor of all
     of it, so it keeps the specificity the scoped card selector had. */

  /* cards-g2: in a keyboard drag the library focuses its item, which is now
     the wrapper rather than the card; the card keeps the look it had. */
  .ppp-board-card-slot:focus > :global(.projects--board--card) {
    background: var(--background-primary-alt);
    box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.08);
  }

  /* cards-g1: the grip fills its lane from the card's top border to its
     bottom one (the negative block margins reach through the card padding,
     `--board-card-pad` in styles.css), so the whole strip is the handle. The
     glyph is top-aligned with the header line rather than centred: on a tall
     card a centred glyph drifts away from the title it moves, and a top handle
     is the iOS/Trello norm. */
  .board-card-grip {
    grid-column: 1;
    /* cards-g4: every row of the card; with no explicit rows (no cover, or a
       left thumbnail) this is the single row it always had. */
    grid-row: 1 / -1;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-block: calc(-1 * var(--board-card-pad, var(--size-4-2)));
    padding-top: var(--board-card-pad, var(--size-4-2));
    color: var(--text-faint);
    opacity: 0.5;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.15s ease, color 0.15s ease;
    z-index: 1;
  }

  /* One header line tall (1rem text at the normal line height), narrower than
     the lane; the glyph is the xs icon centred in it. */
  .board-card-grip-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-4);
    height: 1.5rem;
    border-radius: var(--radius-s);
    transition: background 0.15s ease;
  }

  /* cards-g1: low contrast at rest, so a fine pointer without hover still finds
     it; full on keyboard focus or while focus is inside the card. */
  .ppp-board-card-slot:focus-within .board-card-grip,
  .board-card-grip:focus-visible {
    opacity: 1;
    color: var(--text-muted);
  }
  .board-card-grip:focus-visible {
    outline-offset: calc(-1 * var(--ppp-border-width-thick, 0.125rem));
  }

  /* Stronger under the mouse — only where a hover exists. */
  @media (hover: hover) and (pointer: fine) {
    .ppp-board-card-slot:hover .board-card-grip {
      opacity: 0.8;
    }

    .board-card-grip:hover {
      opacity: 1;
      color: var(--text-muted);
    }

    .board-card-grip:hover .board-card-grip-glyph {
      background: var(--background-modifier-hover);
    }
  }

  .board-card-grip:active {
    cursor: grabbing;
    color: var(--text-normal);
  }

  /* ios-d1: on touch the grip is the only way to move a card (a pan on the
     card body scrolls the board), so it is shown plainly. cards-g1: the lane
     itself is the finger target — a full target wide, and at least one tall
     (its negative margins let a short card stay a single target high) — so
     the content starts where the target ends, with no invisible ::before box
     reaching over it. Touches land on the grip, so `touch-action: none` and
     the `dragHandle` listeners apply unchanged. The lane's width on touch is
     the card's rule, in SharedCard.svelte. */
  @media (pointer: coarse) {
    .board-card-grip {
      min-height: var(--ppp-touch-target-min);
      opacity: 0.7;
      color: var(--text-muted);
    }
  }
  /* cards-g4: the thumbnail, in the card's second lane, first row (the card's
     rows and lanes per layout are SharedCard's `--media-top` / `--media-left`).
     Ratio and fit read the custom properties the gallery media reads. */
  .ppp-board-card-media {
    grid-column: 2;
    grid-row: 1;
    overflow: hidden;
    border-radius: var(--radius-s);
    background: var(--background-secondary);
  }
  .ppp-board-card-media img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: var(--ppp-card-media-fit, cover);
  }
  /* top: across the content lane, above the header. */
  .ppp-board-card-media--top {
    aspect-ratio: var(--ppp-card-media-ratio, 16 / 10);
    margin-bottom: var(--size-4-2);
  }
  /* left: a small square at the start of the content; the whole card is the
     open target, so it need not be a finger target of its own. */
  .ppp-board-card-media--left {
    --ppp-board-card-thumb: 2.75rem;
    width: var(--ppp-board-card-thumb);
    height: var(--ppp-board-card-thumb);
    margin-right: var(--size-4-2);
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

    .ppp-board-card-slot:hover .edit-hint,
    .ppp-board-card-slot:focus-within .edit-hint {
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
       the grip's lane ends (the card's first grid track above, cards-g1) and
       ends before the title, covering neither. */
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
