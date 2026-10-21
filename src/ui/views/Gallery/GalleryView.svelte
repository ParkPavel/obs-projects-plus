<script lang="ts">
  import { Icon, Typography } from "obsidian-svelte";
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";

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

  import {
    CARD_FRAME_OVERRIDE_CAP,
    effectiveSpan,
    normalizeCardFrames,
    resolveCardFrame,
    withOverride,
    type CardFrame,
  } from "src/ui/components/SharedCard/cardFrames";
  import Grid from "./components/Grid/Grid.svelte";
  import GalleryCard from "./components/Card/GalleryCard.svelte";
  import type { GalleryConfig } from "./types";
  import type { FilterCondition, ProjectDefinition } from "src/settings/settings";
  import { getFilterValuesFromConditions } from "src/lib/helpers";
  import GalleryOptionsProvider from "./GalleryOptionsProvider.svelte";
  import { coverOf } from "./gallery";
  import GalleryCardPanel from "./components/CardPanel/GalleryCardPanel.svelte";
  import { aspectRatioCss, cardFieldsInOrder, normalizeGalleryConfig, toggleCollapsedGroup } from "./galleryOptions";
  import {
    GALLERY_WINDOW_STEP,
    GALLERY_WINDOW_THRESHOLD,
    NO_VALUE_GROUP,
    groupGalleryRecords,
    windowGroups,
  } from "./galleryGroups";
  import { revealMore } from "./revealMore";
  import { toRem } from "src/ui/utils/cssLength";
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

  // i3-gallery: the options the provider does not hand down — sections, the
  // card preview and the compact card — read through the same normaliser.
  $: options = normalizeGalleryConfig(config);
  $: groupField = options.groupByField !== undefined && fields.some((f) => f.name === options.groupByField)
    ? options.groupByField
    : undefined;
  $: grouped = groupField !== undefined;
  $: groups = groupGalleryRecords(records, groupField);
  // Folded sections are saved with the view; without a config writer (a
  // read-only embed) they fold for this session only.
  let localCollapsed: string[] | null = null;
  $: collapsed = localCollapsed ?? options.collapsedGroups;

  function toggleGroup(key: string) {
    const next = toggleCollapsedGroup(collapsed, key);
    if (onConfigChange) saveConfig({ ...config, collapsedGroups: next });
    else localCollapsed = next;
  }

  // i3-gallery: a large set renders progressively — the first window, then
  // the next one when the sentinel after the last card nears the viewport (or
  // the "show more" button is pressed). A small set renders whole, as before.
  let windowSize = GALLERY_WINDOW_STEP;
  $: limit = records.length > GALLERY_WINDOW_THRESHOLD ? windowSize : Infinity;
  $: windowed = windowGroups(groups, grouped ? collapsed : [], limit);
  $: hiddenCount = windowed.reduce((n, group) => n + group.hidden, 0);
  $: lastOpen = windowed.reduce((last, group, i) => (!group.collapsed && group.records.length ? i : last), -1);
  // The "+" is the last cell of the last open grid; while cards are still
  // hidden, or no grid is open, it stands after the sections instead.
  $: addOutsideGrid = hiddenCount > 0 || lastOpen < 0;
  const showMore = () => {
    windowSize += GALLERY_WINDOW_STEP;
  };

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
          // must not swallow the CAUSE. The notice stays one sentence with one
          // code; the reason goes to the console, which is where the code page
          // tells people to look.
          logError(RENAME_FAILED, record.id, e);
          new Notice(noticeFor(RENAME_FAILED));
        }
      },
      // v3.0.4: Autosave setting from project
      project.autosave ?? true
    ).open();
  }

  function addRecord() {
    new CreateNoteModal($app, project, (name, templatePath, project) => {
      const filterValues = getFilterValuesFromConditions(filterConditions);
      api.addRecord(
        createDataRecord(name, project, Object.keys(filterValues).length > 0 ? filterValues : undefined),
        fields,
        templatePath
      );
    }).open();
  }

  // B9 — the gallery's own «Card» panel (cover, size, layout, properties).
  let panelOpen = false;
  // B9 — covers whose image failed to load (a resolved path whose file is
  // gone or unreadable); shown as broken, like an unresolved path.
  let failedCovers: Record<string, true> = {};
  function coverFailed(src: string) {
    if (!failedCovers[src]) failedCovers = { ...failedCovers, [src]: true };
  }
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
    {@const mediaRatio = options.compact ? null : aspectRatioCss(coverAspectRatio)}
    {@const cardSize = toRem(cardWidth)}
    {@const shownFields = cardFieldsInOrder(fields, includeFields)}
    <!-- i3-gallery: a compact card is its title only — no media, no properties. -->
    <!-- chrome-filters: card fields in the saved order, which the settings' up/down set. -->
    <!-- C18: count footer -->
    <div class="ppp-gallery-footer">
      <span class="ppp-gallery-footer-count">
        {records.length}
        {$i18n.t("views.gallery.records", { count: records.length, defaultValue: records.length === 1 ? "record" : "records" })}
      </span>
    </div>
    {#each windowed as group, groupIndex (group.key)}
      {#if grouped}
        <!-- i3-gallery: a section per value of the group field, folded and
             unfolded from its header (the board's columns, as Notion's
             grouped gallery lays them out: one under another). -->
        <button
          type="button"
          class="ppp-gallery-group-head"
          data-gallery-group={group.key}
          aria-expanded={!group.collapsed}
          on:click={() => toggleGroup(group.key)}
        >
          <Icon name={group.collapsed ? "chevron-right" : "chevron-down"} size="sm" />
          <span class="ppp-gallery-group-name">{group.key === NO_VALUE_GROUP ? $i18n.t("views.gallery.group.no-value", { defaultValue: "No value" }) : group.key}</span>
          <span class="ppp-gallery-group-count">{group.records.length + group.hidden}</span>
        </button>
      {/if}
      {#if !group.collapsed && group.records.length}
        <Grid {cardWidth} {layout} let:columns let:columnStep>
          {#each group.records as record (record.id)}
            {@const cover = coverOf($app, record, coverField, options.cardPreview !== "property")}
            {@const shown = resolveCardFrame(frames.view, preview?.id === record.id ? preview.frame : frames.byRecord[record.id])}
            {@const height = heightCss(shown)}
            <!-- cards-g5: the frame shown — a drag's preview, else the saved
                 override, each dimension falling back to the view-wide frame.
                 i3-gallery: an empty property keeps its line in the grid and
                 list (one row height); masonry is free-height by design. -->
            <GalleryCard
              {record}
              color={getRecordColor(record)}
              size={cardSize}
              span={layout === "grid" ? effectiveSpan(shown.gridSpan, columns) : undefined}
              minHeight={mediaRatio === null ? height : undefined}
              {mediaRatio}
              mediaHeight={height}
              {fitStyle}
              {cover}
              coverFailed={cover.kind === "ok" && failedCovers[cover.src] === true}
              coverFieldName={coverField?.name}
              contentPreview={options.cardPreview === "content"}
              {iconField}
              fields={shownFields}
              showLabels={showFieldLabels}
              reserveEmpty={layout !== "masonry"}
              compact={options.compact}
              peekReadonly={dataReadOnly || readonly}
              onEdit={handleRecordClick}
              onCoverError={coverFailed}
              {canResize}
              frameView={frames.view}
              frameOverride={frames.byRecord[record.id]}
              horizontal={layout === "grid"}
              {columnStep}
              onPreview={(next) => { preview = next ? { id: record.id, frame: next } : null; }}
              onCommit={(next) => commitFrame(record.id, next)}
            />
          {/each}
          {#if groupIndex === lastOpen && hiddenCount === 0}
          {#if !readonly}
          <IconButton
            icon="plus"
            size="lg"
            onClick={addRecord}
          />
          {/if}
          {/if}
        </Grid>
      {/if}
    {/each}
    {#if hiddenCount > 0}
      <!-- i3-gallery: the sentinel and the visible way to the next window. -->
      <div class="ppp-gallery-more" use:revealMore={{ key: limit, onReveal: showMore }}>
        <button type="button" class="ppp-gallery-more-button" data-gallery-show-more on:click={showMore}>
          {$i18n.t("views.gallery.show-more", { n: hiddenCount, defaultValue: "Show more ({{n}})" })}
        </button>
      </div>
    {/if}
    {#if !readonly && addOutsideGrid}
      <div class="ppp-gallery-add">
        <IconButton icon="plus" size="lg" onClick={addRecord} />
      </div>
    {/if}
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

  .ppp-gallery-content {
    display: contents;
  }

  /* i3-gallery: a section header — the value, its card count, a fold
     chevron; a full-width control, a finger-sized target. */
  .ppp-gallery-group-head {
    display: flex;
    align-items: center;
    gap: 0.5em;
    width: 100%;
    min-height: var(--ppp-touch-target-min, 2rem);
    margin: 0.75em 0 0.25em;
    padding: 0.25em 0.75em;
    background: none;
    box-shadow: none;
    border: none;
    border-radius: var(--radius-s);
    font-weight: var(--font-semibold);
    color: var(--text-normal);
    text-align: start;
  }

  .ppp-gallery-group-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-gallery-group-count {
    font-weight: var(--font-normal);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .ppp-gallery-more,
  .ppp-gallery-add {
    display: flex;
    justify-content: center;
    padding: 0.75em;
  }

  .ppp-gallery-more-button {
    min-height: var(--ppp-touch-target-min, 2rem);
    font-size: var(--font-ui-small);
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
