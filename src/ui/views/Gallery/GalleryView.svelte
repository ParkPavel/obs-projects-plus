<script lang="ts">
  // import { Icon, IconButton, InternalLink, Typography } from "obsidian-svelte";
  import { Icon, IconButton, Typography } from "obsidian-svelte";
  import InternalLink from "src/ui/components/InternalLink.svelte";
  import CardMetadata from "src/ui/components/CardMetadata/CardMetadata.svelte";
  import ColorItem from "src/ui/components/ColorItem/ColorItem.svelte";

  import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
  import { createDataRecord } from "src/lib/dataApi";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import type { ViewApi } from "src/lib/viewApi";
  import CenterBox from "src/ui/modals/components/CenterBox.svelte";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import { EditNoteModal } from "src/ui/modals/editNoteModal";
  import { getDisplayName } from "../Board/components/Board/boardHelpers";

  import { Card, CardContent, CardMedia } from "./components/Card";
  import Grid from "./components/Grid/Grid.svelte";
  import Image from "./components/Image/Image.svelte";
  import type { GalleryConfig } from "./types";
  import type { FilterCondition, ProjectDefinition } from "src/settings/settings";
  import { getFilterValuesFromConditions } from "src/lib/helpers";
  import GalleryOptionsProvider from "./GalleryOptionsProvider.svelte";
  import { getCoverRealPath } from "./gallery";
  import { handleHoverLink, showMobileNavMenu } from "../helpers";
  import { isTouchDevice } from "src/lib/stores/ui";
  import { onDestroy } from "svelte";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let config: GalleryConfig | undefined;
  export let onConfigChange: ((config: GalleryConfig) => void) | undefined = undefined;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let filterConditions: FilterCondition[] = [];

  // Use onConfigChange to avoid unused warning
  $: void onConfigChange;

  $: ({ fields, records } = frame);

  function handleRecordClick(record: DataRecord) {
    new EditNoteModal(
      $app,
      fields,
      (record) => api.updateRecord(record, fields),
      record,
      records,
      // v3.0.8: Unified note open with modifier-based navigation
      (openMode) => {
        $app.workspace.openLinkText(record.id, record.id, openMode);
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
          console.error('Failed to rename note', e);
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
        showMobileNavMenu($app, record.id, record.id, e, () => handleRecordClick(record));
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
  let:cardWidth
>
  {#if records.length}
    <Grid {cardWidth}>
      {#each records as record (record.id)}
        {@const color = getRecordColor(record)}
        <Card>
          <CardMedia
            on:click={(event) => {
              // v3.0.10: Suppress click if long-press was fired
              if (longPressFired) { longPressFired = false; return; }
              // v3.0.8: Unified note navigation — Shift → new window, Ctrl → new tab, else → modal
              if (event.shiftKey) {
                $app.workspace.openLinkText(record.id, "", 'window');
              } else if (event.metaKey || event.ctrlKey) {
                $app.workspace.openLinkText(record.id, "", 'tab');
              } else {
                handleRecordClick(record);
              }
            }}
            on:touchstart={handleCardTouchStart(record)}
            on:touchmove={handleCardTouchMove}
            on:touchend={handleCardTouchEnd}
          >
            {@const coverPath = getCoverRealPath($app, record, coverField)}

            {#if coverPath}
              <Image alt="Title" src={coverPath} fit={fitStyle} />
            {:else}
              <Icon name="image" size="lg" />
            {/if}
          </CardMedia>
          <CardContent>
            <ColorItem {color}>
              <InternalLink
                slot="header"
                linkText={record.id}
                sourcePath={record.id}
                resolved
                on:open={({ detail: { linkText, sourcePath, newLeaf, shiftKey } }) => {
                  // v3.0.8: Unified note navigation — Shift → new window, Ctrl → new tab, else → modal
                  if (shiftKey) {
                    $app.workspace.openLinkText(linkText, sourcePath, 'window');
                  } else if (newLeaf) {
                    $app.workspace.openLinkText(linkText, sourcePath, 'tab');
                  } else {
                    handleRecordClick(record);
                  }
                }}
                on:longpress={({ detail: { linkText, sourcePath, event } }) => {
                  showMobileNavMenu($app, linkText, sourcePath, event, () => handleRecordClick(record));
                }}
                on:hover={({ detail: { event, sourcePath } }) => {
                  handleHoverLink(event, sourcePath);
                }}
              >
                {getDisplayName(record.id)}
              </InternalLink>
              <CardMetadata
                fields={fields.filter(
                  (field) => !!config?.includeFields?.includes(field.name)
                )}
                {record}
              />
            </ColorItem>
          </CardContent>
        </Card>
      {/each}
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
    </Grid>
  {:else}
    <CenterBox>
      <div class="ppp-gallery-empty">
        <Icon name="image" size="lg" />
        <Typography variant="h5">{$i18n.t("views.gallery.empty")}</Typography>
        <span class="ppp-gallery-empty-hint">{$i18n.t("views.gallery.empty-hint", { defaultValue: "Create a note to get started" })}</span>
      </div>
    </CenterBox>
  {/if}
</GalleryOptionsProvider>
