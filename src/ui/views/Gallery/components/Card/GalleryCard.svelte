<script lang="ts">
  /**
   * i3-gallery — one gallery card, moved out of GalleryView when the view
   * gained sections (group by) and a progressive window: the same card now
   * renders in several grids. Markup, classes and handlers are the ones
   * GalleryView had (cards-g2 … B9); the open, long press and "⋯" live with
   * the card they belong to, and the editor is the view's (`onEdit`).
   */
  import { Icon } from "obsidian-svelte";
  import InternalLink from "src/ui/components/InternalLink.svelte";
  import CardMetadata from "src/ui/components/CardMetadata/CardMetadata.svelte";
  import SharedCard from "src/ui/components/SharedCard/SharedCard.svelte";
  import CardResizeHandle from "src/ui/components/SharedCard/CardResizeHandle.svelte";
  import type { CardFrame } from "src/ui/components/SharedCard/cardFrames";
  import { PageIcon } from "src/ui/components/PageIcon";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { isTouchDevice } from "src/lib/stores/ui";
  import { openRecord } from "src/lib/record/openRecord";
  import { onDestroy } from "svelte";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  import { handleHoverLink, showMobileNavMenu } from "src/ui/views/helpers";
  import type { CoverState } from "../../gallery";
  import Image from "../Image/Image.svelte";
  import ContentPreview from "../ContentPreview/ContentPreview.svelte";

  export let record: DataRecord;
  export let color: string | null;
  export let size: string;
  export let span: number | undefined;
  export let minHeight: string | undefined;
  /** The media's CSS ratio, or null for a card without media. */
  export let mediaRatio: string | null;
  export let mediaHeight: string | undefined;
  export let fitStyle: string;
  export let cover: CoverState;
  /** The cover image failed to load (B9). */
  export let coverFailed: boolean;
  export let coverFieldName: string | undefined;
  /** The `content` preview: the note's first paragraph where there is no image. */
  export let contentPreview: boolean;
  export let iconField: DataField | undefined;
  export let fields: DataField[];
  export let showLabels: boolean;
  export let reserveEmpty: boolean;
  export let compact: boolean;
  /** The peek opens read-only (#142/#C4). */
  export let peekReadonly: boolean;
  export let onEdit: (record: DataRecord) => void;
  export let onCoverError: (src: string) => void;
  export let canResize: boolean;
  export let frameView: CardFrame;
  export let frameOverride: CardFrame | undefined;
  export let horizontal: boolean;
  export let columnStep: () => number;
  export let onPreview: (next: CardFrame | null) => void;
  export let onCommit: (next: CardFrame | undefined) => void;

  // B9: the whole card is the open and long-press target, except what is a
  // control of its own or reads as one — the title link (its own open and long
  // press, so the menu never opens twice), a chip, the "⋯" and resize buttons.
  const OWN_TARGETS = "a, .internal-link, button, select, input, textarea, [contenteditable], .ppp-card-meta-chip, .ppp-card-resize-handle";
  const onLink = (e: Event) => e.target instanceof Element && e.target.closest(OWN_TARGETS) !== null;

  /**
   * B9 — a tap on the card opens the record in the peek (Notion's gallery).
   * Shift → window, Ctrl/Meta → tab; everything goes through `openRecord`.
   */
  function openFromCard(event: MouseEvent) {
    // v3.0.10: Suppress click if long-press was fired
    if (longPressFired) { longPressFired = false; return; }
    if (event.shiftKey) {
      void openRecord({ id: record.id, sourcePath: "" }, "window", { app: $app });
    } else if (event.metaKey || event.ctrlKey) {
      void openRecord({ id: record.id, sourcePath: "" }, "tab", { app: $app });
    } else {
      void openRecord({ id: record.id, sourcePath: "", readonly: peekReadonly }, "peek", { app: $app });
    }
  }

  /** B9 — the visible "⋯": the same menu the long press opens, never hover-only. */
  function openCardMenu(event: MouseEvent) {
    event.stopPropagation();
    showMobileNavMenu($app, { id: record.id }, event, () => onEdit(record));
  }

  // v3.0.10: Long-press detection on touch devices
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  let touchStartPos: { x: number; y: number } | null = null;
  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 10;

  function handleTouchStart(e: TouchEvent) {
    if (!$isTouchDevice || onLink(e)) return;
    longPressFired = false;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      if (navigator.vibrate) navigator.vibrate(30);
      showMobileNavMenu($app, { id: record.id }, e, () => onEdit(record));
    }, LONG_PRESS_MS);
  }

  function handleTouchMove(e: TouchEvent) {
    if (!longPressTimer || !touchStartPos) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPos.x);
    const dy = Math.abs(touch.clientY - touchStartPos.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (longPressFired) {
      e.preventDefault();
      longPressFired = false;
    }
  }

  onDestroy(() => {
    if (longPressTimer) clearTimeout(longPressTimer);
  });

  $: showBroken = cover.kind === "broken" || (cover.kind === "ok" && coverFailed && cover.embedded !== true);
</script>

<!-- cards-g2/g3/g5: the shared card shell; width, media ratio and fit travel as
     custom properties, a saved height sizes the media (or the card without
     media), a span applies to the grid only. -->
<SharedCard
  recordId={record.id}
  variant="gallery"
  {color}
  {size}
  {span}
  {minHeight}
  interactive
  on:click={(event) => { if (!onLink(event)) openFromCard(event); }}
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
>
  <svelte:fragment slot="media">
    {#if mediaRatio !== null}
      <div
        class="projects--gallery--card__media"
        data-ppp-frame-target
        style:--ppp-card-media-ratio={mediaHeight ? "auto" : mediaRatio}
        style:--ppp-card-media-fit={fitStyle}
        style:height={mediaHeight}
      >
        {#if cover.kind === "ok" && !coverFailed}
          <Image alt={$i18n.t("views.gallery.cover-alt")} src={cover.src} fit={fitStyle} on:error={() => onCoverError(cover.kind === "ok" ? cover.src : "")} />
        {:else if showBroken && coverFieldName && cover.kind !== "none"}
          <!-- B9: a cover value that gives no image says so, and where to fix it. -->
          <div class="ppp-gallery-cover-broken" data-cover-broken title={cover.raw}>
            <Icon name="image-off" size="md" />
            <span class="ppp-gallery-cover-broken-text">{$i18n.t("views.gallery.cover-broken")}</span>
            <span class="ppp-gallery-cover-broken-hint">{$i18n.t("views.gallery.cover-broken-hint", { field: coverFieldName, path: cover.raw, interpolation: { escapeValue: false } })}</span>
          </div>
        {:else if contentPreview}
          <ContentPreview path={record.id} />
        {:else}
          <Icon name="image" size="lg" />
        {/if}
      </div>
    {/if}
  </svelte:fragment>
  <InternalLink
    slot="header"
    linkText={record.id}
    sourcePath={record.id}
    resolved
    on:open={({ detail: { linkText, sourcePath, newLeaf, shiftKey } }) => {
      // v3.0.8: Unified note navigation — Shift → new window, Ctrl → new tab, else → modal
      if (shiftKey) {
        void openRecord({ id: linkText, sourcePath }, "window", { app: $app });
      } else if (newLeaf) {
        void openRecord({ id: linkText, sourcePath }, "tab", { app: $app });
      } else {
        onEdit(record);
      }
    }}
    on:longpress={({ detail: { linkText, sourcePath, event } }) => {
      showMobileNavMenu($app, { id: linkText, sourcePath }, event, () => onEdit(record));
    }}
    on:hover={({ detail: { event, sourcePath } }) => {
      handleHoverLink(event, sourcePath);
    }}
  >
    {#if iconField}
      <PageIcon value={record.values[iconField.name]} />
    {/if}
    {getDisplayName(record.id)}
  </InternalLink>
  <svelte:fragment slot="metadata">
    {#if !compact}
      <CardMetadata {fields} {record} {showLabels} {reserveEmpty} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="controls">
    <button
      type="button"
      class="ppp-gallery-card-more clickable-icon"
      data-gallery-card-more
      aria-label={$i18n.t("views.gallery.card-more", { name: getDisplayName(record.id), interpolation: { escapeValue: false } })}
      on:click={openCardMenu}
    ><Icon name="more-horizontal" size="sm" /></button>
    {#if canResize}
      <CardResizeHandle
        view={frameView}
        override={frameOverride}
        {horizontal}
        {columnStep}
        {onPreview}
        {onCommit}
      />
    {/if}
  </svelte:fragment>
</SharedCard>

<style>
  /* B9: the card's "⋯", always visible (no hover-only control), in the top
     trailing corner; a finger-sized target on touch. */
  .ppp-gallery-card-more {
    position: absolute;
    top: var(--size-4-1);
    right: var(--size-4-1);
    min-width: 1.75rem;
    min-height: 1.75rem;
    padding: 0;
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-muted);
    box-shadow: var(--shadow-s);
  }

  @media (pointer: coarse) {
    .ppp-gallery-card-more {
      min-width: var(--ppp-touch-target-min, 2.75rem);
      min-height: var(--ppp-touch-target-min, 2.75rem);
    }
  }

  .ppp-gallery-cover-broken {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--size-4-1);
    padding: var(--size-4-2);
    max-width: 100%;
    min-width: 0;
    text-align: center;
    color: var(--text-muted);
  }

  .ppp-gallery-cover-broken-text {
    font-size: var(--font-ui-small);
  }

  .ppp-gallery-cover-broken-hint {
    font-size: var(--font-ui-smaller);
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
