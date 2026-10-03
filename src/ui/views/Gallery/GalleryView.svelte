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
  import Grid from "./components/Grid/Grid.svelte";
  import Image from "./components/Image/Image.svelte";
  import { PageIcon } from "src/ui/components/PageIcon";
  import type { GalleryConfig } from "./types";
  import type { FilterCondition, ProjectDefinition } from "src/settings/settings";
  import { getFilterValuesFromConditions } from "src/lib/helpers";
  import GalleryOptionsProvider from "./GalleryOptionsProvider.svelte";
  import { getCoverRealPath } from "./gallery";
  import { aspectRatioCss } from "./galleryOptions";
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

  // Use onConfigChange to avoid unused warning
  $: void onConfigChange;

  $: ({ fields, records } = frame);

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
  {#if records.length}
    {@const mediaRatio = aspectRatioCss(coverAspectRatio)}
    {@const cardSize = toRem(cardWidth)}
    {@const shownFields = fields.filter((field) => includeFields.includes(field.name))}
    <!-- C18: count footer -->
    <div class="ppp-gallery-footer">
      <span class="ppp-gallery-footer-count">
        {records.length}
        {$i18n.t("views.gallery.records", { count: records.length, defaultValue: records.length === 1 ? "record" : "records" })}
      </span>
    </div>
    <Grid {cardWidth} {layout}>
      {#each records as record (record.id)}
        {@const color = getRecordColor(record)}
        {@const coverPath = getCoverRealPath($app, record, coverField)}
        <!-- cards-g2: the shared card shell; the media element and its open /
             long-press handlers stay here, in the view that owns them.
             cards-g3: the card's width and the media's ratio and fit travel as
             custom properties (--ppp-shared-card-size, --ppp-card-media-ratio,
             --ppp-card-media-fit) for the later card batches to read; ratio
             `none` renders no media element at all. -->
        <SharedCard recordId={record.id} variant="gallery" {color} size={cardSize}>
          <svelte:fragment slot="media">
          {#if mediaRatio !== null}
          <div
            class="projects--gallery--card__media"
            style:--ppp-card-media-ratio={mediaRatio}
            style:--ppp-card-media-fit={fitStyle}
            on:keypress
            on:click={(event) => {
              // v3.0.10: Suppress click if long-press was fired
              if (longPressFired) { longPressFired = false; return; }
              // v3.0.8: Unified note navigation — Shift → new window, Ctrl → new tab, else → modal
              if (event.shiftKey) {
                void openRecord({ id: record.id, sourcePath: "" }, "window", { app: $app });
              } else if (event.metaKey || event.ctrlKey) {
                void openRecord({ id: record.id, sourcePath: "" }, "tab", { app: $app });
              } else {
                handleRecordClick(record);
              }
            }}
            on:touchstart={handleCardTouchStart(record)}
            on:touchmove={handleCardTouchMove}
            on:touchend={handleCardTouchEnd}
          >
            {#if coverPath}
              <Image alt={$i18n.t("views.gallery.cover-alt")} src={coverPath} fit={fitStyle} />
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

  .ppp-gallery-footer-count {
    font-size: 0.75rem;
    color: var(--text-faint);
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
    color: var(--text-faint);
  }
</style>
