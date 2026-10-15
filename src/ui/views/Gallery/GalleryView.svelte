<script lang="ts">
  // import { Icon, IconButton, InternalLink, Typography } from "obsidian-svelte";
  import { Icon, Typography } from "obsidian-svelte";
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
  import InternalLink from "src/ui/components/InternalLink.svelte";
  import CardMetadata from "src/ui/components/CardMetadata/CardMetadata.svelte";

  import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
  import { createDataRecord } from "src/lib/dataApi";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { openRecord, modeFromNewLeaf, PLAIN_MODE } from "src/lib/record/openRecord";
  import { Notice } from "obsidian";
  import type { ViewApi } from "src/lib/viewApi";
  import CenterBox from "src/ui/modals/components/CenterBox.svelte";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import { EditNoteModal } from "src/ui/modals/editNoteModal";
  import { getDisplayName } from "../Board/components/Board/boardHelpers";

  import SharedCard from "src/ui/components/SharedCard/SharedCard.svelte";
  import CardResizeHandle from "src/ui/components/SharedCard/CardResizeHandle.svelte";
  import {
    CARD_FRAME_OVERRIDE_CAP,
    effectiveSpan,
    normalizeCardFrames,
    resolveCardFrame,
    withOverride,
    type CardFrame,
  } from "src/ui/components/SharedCard/cardFrames";
  import Grid from "./components/Grid/Grid.svelte";
  import Image from "./components/Image/Image.svelte";
  import { PageIcon } from "src/ui/components/PageIcon";
  import type { GalleryConfig } from "./types";
  import type { FilterCondition, ProjectDefinition } from "src/settings/settings";
  import { getFilterValuesFromConditions } from "src/lib/helpers";
  import GalleryOptionsProvider from "./GalleryOptionsProvider.svelte";
  import { coverOf } from "./gallery";
  import GalleryCardPanel from "./components/CardPanel/GalleryCardPanel.svelte";
  import { aspectRatioCss, cardFieldsInOrder } from "./galleryOptions";
  import { toRem } from "src/ui/utils/cssLength";
  import { handleHoverLink, showMobileNavMenu } from "../helpers";
  import { isTouchDevice } from "src/lib/stores/ui";
  import { onDestroy } from "svelte";
  import { ignoreHostSwipe } from "src/ui/actions/ignoreHostSwipe";
  import { noticeFor } from "src/lib/errors/errorText";
  import { logError } from "src/lib/errors/errorLog";

  /** #202 — the same event as the Calendar's rename failure, so the same code. */
  const RENAME_FAILED = "PPP-301";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let config: GalleryConfig | undefined;
  export let onConfigChange: ((config: GalleryConfig) => void) | undefined = undefined;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let filterConditions: FilterCondition[] = [];
  /**
   * #142 — a gallery tab reading an external source must not write through the
   * parent project's api. #139 gave Table/Board/Calendar `readonly ||
   * sourceReadOnly`; the gallery branch was missed and had no prop at all, so
   * its `+` created the note in the project the block is *placed* in, not the
   * one it reads. Defaults to false so every existing caller is unchanged.
   */
  export let readonly = false;
  /**
   * #C4 — the block's data-write ban, distinct from `readonly`. #142 keyed
   * the guard below on `readonly` alone, which also broke a STANDALONE
   * gallery on a Dataview project: `DataSource.readonly()` is always true
   * there, so editing (not just creating) silently stopped working. Only a
   * `database-call` block reading an EXTERNAL project sets this; every other
   * caller keeps its default and is unaffected.
   */
  export let dataReadOnly = false;

  $: ({ fields, records } = frame);

  // cards-g5: saved card frames. The view-wide frame and the per-card
  // overrides are read once (cardFrames.ts); a drag previews one card's frame
  // here, locally, and only its release writes the config, once, through
  // `onConfigChange` — standalone (galleryView.ts saveConfig) and embedded
  // (DatabaseCallBlock) alike. Without a change handler there is no handle.
  $: frames = normalizeCardFrames(config);
  $: canResize = onConfigChange !== undefined;
  let preview: { id: string; frame: CardFrame } | null = null;

  function saveConfig(next: GalleryConfig) {
    config = next;
    onConfigChange?.(next);
  }

  function commitFrame(recordId: string, next: CardFrame | undefined) {
    const patch = withOverride(config, recordId, next);
    if (!patch) {
      new Notice($i18n.t("settings-menu.view-config.card-frames.cap-reached", { limit: CARD_FRAME_OVERRIDE_CAP }));
      return;
    }
    saveConfig({ ...config, ...patch });
  }

  const heightCss = (frame: CardFrame): string | undefined =>
    frame.heightRem !== undefined ? `${frame.heightRem}rem` : undefined;

  function handleRecordClick(record: DataRecord) {
    // #142/#C4 — a read-only-DATA gallery still opens the note; it just does
    // not offer an editor whose writes would land in the wrong project.
    if (dataReadOnly) {
      void openRecord({ id: record.id }, PLAIN_MODE, { app: $app });
      return;
    }
    new EditNoteModal(
      $app,
      fields,
      (record) => api.updateRecord(record, fields),
      record,
      records,
      // v3.0.8: Unified note open with modifier-based navigation
      (openMode) => {
        void openRecord({ id: record.id }, modeFromNewLeaf(openMode), { app: $app });
      },
      // v3.0.1: Rename note callback
      async (newName: string) => {
        try {
          const file = $app.vault.getAbstractFileByPath(record.id);
          if (file && 'parent' in file) {
            const newPath = file.parent?.path 
              ? `${file.parent.path}/${newName}.md`
              : `${newName}.md`;
            await $app.fileManager.renameFile(file as any, newPath);
          }
        } catch (e) {
          // #202, from the adversarial review: the code names the EVENT, and it
          // must not swallow the CAUSE. This used to show the thrown message,
          // and a name collision, a permission error and an illegal filename
          // ask for three different things from the user. The notice stays one
          // sentence with one code; the reason goes to the console, which is
          // where the code page tells people to look.
          logError(RENAME_FAILED, record.id, e);
          new Notice(noticeFor(RENAME_FAILED));
        }
      },
      // v3.0.4: Autosave setting from project
      project.autosave ?? true
    ).open();
  }

  /**
   * B9 — a tap on the card opens the record in the peek (Notion's gallery: the
   * card opens over the view, the view stays). Shift → window, Ctrl/Meta →
   * tab, as before; the title link keeps its own routes, and the editor stays
   * one entry away in the card's "⋯" menu and its long press. Everything goes
   * through `openRecord`, the one opener.
   */
  function openFromCard(event: MouseEvent, record: DataRecord) {
    // v3.0.10: Suppress click if long-press was fired
    if (longPressFired) { longPressFired = false; return; }
    if (event.shiftKey) {
      void openRecord({ id: record.id, sourcePath: "" }, "window", { app: $app });
    } else if (event.metaKey || event.ctrlKey) {
      void openRecord({ id: record.id, sourcePath: "" }, "tab", { app: $app });
    } else {
      void openRecord({ id: record.id, sourcePath: "", readonly: dataReadOnly || readonly }, "peek", { app: $app });
    }
  }

  // B9: the whole card is the open and long-press target, except what is a
  // control of its own or reads as one — the title link (its own open and long
  // press, so the menu never opens twice), a chip, the "⋯" and resize buttons.
  const OWN_TARGETS = "a, .internal-link, button, select, input, textarea, [contenteditable], .ppp-card-meta-chip, .ppp-card-resize-handle";
  const onLink = (e: Event) => e.target instanceof Element && e.target.closest(OWN_TARGETS) !== null;

  /** B9 — the visible "⋯": the same menu the long press opens, never hover-only. */
  function openCardMenu(event: MouseEvent, record: DataRecord) {
    event.stopPropagation();
    showMobileNavMenu($app, { id: record.id }, event, () => handleRecordClick(record));
  }

  // B9 — the gallery's own «Card» panel (cover, size, layout, properties).
  let panelOpen = false;
  // B9 — covers whose image failed to load (a resolved path whose file is
  // gone or unreadable); shown as broken, like an unresolved path.
  let failedCovers: Record<string, true> = {};
  function coverFailed(src: string) {
    if (!failedCovers[src]) failedCovers = { ...failedCovers, [src]: true };
  }

  // v3.0.10: Long-press detection for CardMedia on touch devices
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  let touchStartPos: { x: number; y: number } | null = null;
  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 10;

  function handleCardTouchStart(record: DataRecord) {
    return (e: TouchEvent) => {
      if (!$isTouchDevice) return;
      longPressFired = false;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        if (navigator.vibrate) navigator.vibrate(30);
        showMobileNavMenu($app, { id: record.id }, e, () => handleRecordClick(record));
      }, LONG_PRESS_MS);
    };
  }

  function handleCardTouchMove(e: TouchEvent) {
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

  function handleCardTouchEnd(e: TouchEvent) {
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
</script>

<GalleryOptionsProvider
  {fields}
  {config}
  let:fitStyle
  let:coverField
  let:iconField
  let:cardWidth
  let:layout
  let:coverAspectRatio
  let:showFieldLabels
  let:includeFields
>
  <!-- ios-g1 G2: `Grid` and `CenterBox` are components, so the swipe-ownership
       action needs an element of its own, wrapping BOTH branches — an empty
       gallery must not hand interior swipes to Obsidian either. `display:
       contents` keeps it out of layout while it stays an ancestor in the DOM,
       which is all Obsidian's recogniser reads. -->
  <div class="ppp-gallery-content" use:ignoreHostSwipe>
  {#if canResize}
    <div class="ppp-gallery-toolbar">
      <button
        type="button"
        class="ppp-gallery-card-options clickable-icon"
        data-gallery-card-options
        aria-expanded={panelOpen}
        aria-label={$i18n.t("views.gallery.card-panel.open")}
        on:click={() => (panelOpen = !panelOpen)}
      >
        <Icon name="layout-grid" size="sm" />
        <span>{$i18n.t("views.gallery.card-panel.title")}</span>
      </button>
    </div>
    {#if panelOpen}
      <GalleryCardPanel {fields} {config} onChange={saveConfig} onClose={() => (panelOpen = false)} />
    {/if}
  {/if}
  {#if records.length}
    {@const mediaRatio = aspectRatioCss(coverAspectRatio)}
    {@const cardSize = toRem(cardWidth)}
    {@const shownFields = cardFieldsInOrder(fields, includeFields)}
    <!-- chrome-filters: card fields in the saved order, which the settings' up/down set. -->
    <!-- C18: count footer -->
    <div class="ppp-gallery-footer">
      <span class="ppp-gallery-footer-count">
        {records.length}
        {$i18n.t("views.gallery.records", { count: records.length, defaultValue: records.length === 1 ? "record" : "records" })}
      </span>
    </div>
    <Grid {cardWidth} {layout} let:columns let:columnStep>
      {#each records as record (record.id)}
        {@const color = getRecordColor(record)}
        {@const cover = coverOf($app, record, coverField)}
        {@const shown = resolveCardFrame(frames.view, preview?.id === record.id ? preview.frame : frames.byRecord[record.id])}
        {@const height = heightCss(shown)}
        <!-- cards-g5: the frame shown — a drag's preview, else the saved
             override, each dimension falling back to the view-wide frame. A
             height sizes the media (its ratio gives way to it), or the card
             itself when there is no media; a span applies to the grid only,
             capped to the columns the grid has (the saved value is kept). -->

        <!-- cards-g2: the shared card shell; the media element and its open /
             long-press handlers stay here, in the view that owns them.
             cards-g3: the card's width and the media's ratio and fit travel as
             custom properties (--ppp-shared-card-size, --ppp-card-media-ratio,
             --ppp-card-media-fit) for the later card batches to read; ratio
             `none` renders no media element at all. -->
        <SharedCard
          recordId={record.id}
          variant="gallery"
          {color}
          size={cardSize}
          span={layout === "grid" ? effectiveSpan(shown.gridSpan, columns) : undefined}
          minHeight={mediaRatio === null ? height : undefined}
          interactive
          on:click={(event) => { if (!onLink(event)) openFromCard(event, record); }}
          on:touchstart={(event) => { if (!onLink(event)) handleCardTouchStart(record)(event); }}
          on:touchmove={handleCardTouchMove}
          on:touchend={handleCardTouchEnd}
        >
          <svelte:fragment slot="media">
          {#if mediaRatio !== null}
          <div
            class="projects--gallery--card__media"
            data-ppp-frame-target
            style:--ppp-card-media-ratio={height ? "auto" : mediaRatio}
            style:--ppp-card-media-fit={fitStyle}
            style:height={height}
          >
            {#if cover.kind === "ok" && !failedCovers[cover.src]}
              <Image alt={$i18n.t("views.gallery.cover-alt")} src={cover.src} fit={fitStyle} on:error={() => coverFailed(cover.src)} />
            {:else if cover.kind !== "none" && coverField}
              <!-- B9: a cover value that gives no image says so, and where to fix it. -->
              <div class="ppp-gallery-cover-broken" data-cover-broken title={cover.raw}>
                <Icon name="image-off" size="md" />
                <span class="ppp-gallery-cover-broken-text">{$i18n.t("views.gallery.cover-broken")}</span>
                <span class="ppp-gallery-cover-broken-hint">{$i18n.t("views.gallery.cover-broken-hint", { field: coverField.name, path: cover.raw, interpolation: { escapeValue: false } })}</span>
              </div>
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
                handleRecordClick(record);
              }
            }}
            on:longpress={({ detail: { linkText, sourcePath, event } }) => {
              showMobileNavMenu($app, { id: linkText, sourcePath }, event, () => handleRecordClick(record));
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
          <CardMetadata
            slot="metadata"
            fields={shownFields}
            {record}
            showLabels={showFieldLabels}
          />
          <svelte:fragment slot="controls">
            <button
              type="button"
              class="ppp-gallery-card-more clickable-icon"
              data-gallery-card-more
              aria-label={$i18n.t("views.gallery.card-more", { name: getDisplayName(record.id), interpolation: { escapeValue: false } })}
              on:click={(event) => openCardMenu(event, record)}
            ><Icon name="more-horizontal" size="sm" /></button>
            {#if canResize}
              <CardResizeHandle
                view={frames.view}
                override={frames.byRecord[record.id]}
                horizontal={layout === "grid"}
                {columnStep}
                onPreview={(next) => { preview = next ? { id: record.id, frame: next } : null; }}
                onCommit={(next) => commitFrame(record.id, next)}
              />
            {/if}
          </svelte:fragment>
        </SharedCard>
      {/each}
      {#if !readonly}
      <IconButton
        icon="plus"
        size="lg"
        onClick={() => {
          new CreateNoteModal($app, project, (name, templatePath, project) => {
            const filterValues = getFilterValuesFromConditions(filterConditions);
            api.addRecord(
              createDataRecord(name, project, Object.keys(filterValues).length > 0 ? filterValues : undefined),
              fields,
              templatePath
            );
          }).open();
        }}
      />
      {/if}
    </Grid>
    <!-- ios-s1: end space under the last row of cards; see `.ppp-gallery-end`. -->
    <div class="ppp-gallery-end" aria-hidden="true"></div>
  {:else}
    <CenterBox>
      <div class="ppp-gallery-empty">
        <Icon name="image" size="lg" />
        <Typography variant="h5">{$i18n.t("views.gallery.empty")}</Typography>
        <span class="ppp-gallery-empty-hint">{$i18n.t("views.gallery.empty-hint", { defaultValue: "Create a note to get started" })}</span>
      </div>
    </CenterBox>
  {/if}
  </div>
</GalleryOptionsProvider>

<style>
  .ppp-gallery-toolbar {
    display: flex;
    justify-content: flex-end;
    padding: 0.25rem 0.75rem 0;
  }

  .ppp-gallery-card-options {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-1);
    min-height: var(--ppp-touch-target-min, 2rem);
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

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

  /* B9: the title never runs under the "⋯", and a long one wraps instead of
     widening the card; the body's fields keep a gap from the cover. */
  :global(.projects--gallery--card > .projects--gallery--card__body) {
    min-width: 0;
    padding-top: var(--size-4-2);
  }

  :global(.projects--gallery--card .card-header) {
    min-width: 0;
    padding-right: 2rem;
    overflow-wrap: anywhere;
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

  .ppp-gallery-content {
    display: contents;
  }

  /* ios-s1: the gallery scrolls in its `ViewContent` (GalleryOptionsProvider),
     whose bottom is under Obsidian's floating navbar on a phone. `.ppp-gallery-
     content` is `display: contents` and the grid is another component, so the
     end space is a block of its own after the grid, of the host's
     `--view-bottom-spacing` (Obsidian app.css, `.is-phone`; 0 by default,
     navbar + home-indicator inset with the floating nav — Bases reserves the
     same at the end of its cards container). 0/unset on desktop and tablets.
     A gallery embedded in a dashboard block is not at the view's bottom — the
     dashboard reserves the space once, at its own end — so it has none. */
  .ppp-gallery-end {
    height: var(--view-bottom-spacing, 0);
  }

  :global(.ppp-widget-host) .ppp-gallery-end {
    display: none;
  }

  .ppp-gallery-footer {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.75rem 0;
  }

  /* theme-compat: the count and the empty hint are text a user reads, so
     --text-muted (WCAG AA in the default themes), not --text-faint
     (2.30:1 light, 2.97:1 dark). */
  .ppp-gallery-footer-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    user-select: none;
  }

  .ppp-gallery-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
  }

  .ppp-gallery-empty-hint {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
</style>
