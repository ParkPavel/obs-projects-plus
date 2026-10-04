<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ViewDefinition } from "../../../../../settings/settings";
  import { i18n } from "src/lib/stores/i18n";
  import FieldComboInput from "./FieldComboInput.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import { Icon } from "obsidian-svelte";
  import { getFieldIcon } from "./filterHelpers";
  import {
    GALLERY_ASPECT_RATIOS,
    GALLERY_LAYOUTS,
    GALLERY_SIZE_PRESETS,
    cardFieldsInOrder,
    moveIncludedField,
    normalizeGalleryConfig,
    sizePresetOf,
    type GallerySizePreset,
  } from "src/ui/views/Gallery/galleryOptions";
  import { BOARD_THUMBNAIL_LAYOUTS, normalizeThumbnailLayout } from "src/ui/views/Board/types";
  import {
    CARD_FRAME_BOUNDS,
    HEIGHT_STEP_REM,
    normalizeCardFrames,
    normalizeHeightRem,
    resetAllFrames,
    snapHeightRem,
    withViewHeight,
  } from "src/ui/components/SharedCard/cardFrames";

  type SettingsTabId = "viewConfig" | "projects" | "views" | "filters" | "colors" | "sort";

  export let view: ViewDefinition | undefined;
  export let fields: Array<{ name: string; type: string; derived?: boolean }> = [];

  const dispatch = createEventDispatcher<{ update: Record<string, any>; navigateTab: SettingsTabId }>();

  $: isCalendar = view?.type === "calendar";
  $: isBoard = view?.type === "board";
  $: isGallery = view?.type === "gallery";
  $: isDatabase = view?.type === "table" || view?.type === "database" || view?.type === "dashboard";
  $: isTimeline = interval === "day" || interval === "week";

  // Calendar settings (reactive: re-derive when view prop changes)
  $: interval = (view?.config?.["interval"] as string) ?? (view?.config?.["displayMode"] as string) ?? "month";
  $: displayMode = (view?.config?.["displayMode"] as string) ?? "headers";
  $: timeFormat = (view?.config?.["timeFormat"] as string) ?? "24h";
  $: timezone = (view?.config?.["timezone"] as string) ?? "local";
  $: agendaOpen = (view?.config?.["agendaOpen"] as boolean) ?? false;
  $: freezeAll = (view?.config?.["freezeAll"] as boolean) ?? (view?.config?.["freezeColumns"] as boolean) ?? false;
  
  // Timeline-specific settings
  $: startHour = (view?.config?.["startHour"] as number) ?? 0;
  $: endHour = (view?.config?.["endHour"] as number) ?? 24;
  $: showWeekends = (view?.config?.["showWeekends"] as boolean) ?? true;
  $: showAllDaySection = (view?.config?.["showAllDaySection"] as boolean) ?? true;
  $: eventColorField = (view?.config?.["eventColorField"] as string) ?? "";
  
  // Field mapping for Calendar (frontmatter field names)
  $: dateField = (view?.config?.["dateField"] as string) ?? "";
  $: startDateField = (view?.config?.["startDateField"] as string) ?? "";
  $: endDateField = (view?.config?.["endDateField"] as string) ?? "";
  $: startTimeField = (view?.config?.["startTimeField"] as string) ?? "";
  $: endTimeField = (view?.config?.["endTimeField"] as string) ?? "";
  $: checkField = (view?.config?.["checkField"] as string) ?? "";

  // Board-specific settings
  $: columnWidth = (view?.config?.["columnWidth"] as number) ?? 270;
  $: groupByField = (view?.config?.["groupByField"] as string) ?? "";
  $: headerField = (view?.config?.["headerField"] as string) ?? "";
  $: orderSyncField = (view?.config?.["orderSyncField"] as string) ?? "";
  // cards-g4: card thumbnails; the cover field is the shared `coverField` below.
  $: thumbnailLayout = normalizeThumbnailLayout(view?.config?.["thumbnailLayout"]);

  // Gallery-specific settings, read through the gallery's one normaliser (cards-g3)
  $: gallery = normalizeGalleryConfig(view?.config);
  $: cardWidth = gallery.cardWidth;
  $: coverField = (view?.config?.["coverField"] as string) ?? "";
  $: iconField = (view?.config?.["iconField"] as string) ?? "";
  $: fitStyle = gallery.fitStyle;
  $: galleryIncludeFields = gallery.includeFields;
  $: galleryLayout = gallery.layout;
  $: coverAspectRatio = gallery.coverAspectRatio;
  $: showFieldLabels = gallery.showFieldLabels;
  $: sizePreset = sizePresetOf(cardWidth);
  const SIZE_PRESETS = Object.entries(GALLERY_SIZE_PRESETS) as [GallerySizePreset, number][];

  // cards-g5: saved card frames (gallery and board), read through their one
  // normaliser. The tab sets the view-wide height (empty = automatic) and
  // resets every frame; per-card frames are made on the cards themselves.
  $: cardFrames = normalizeCardFrames(view?.config);
  $: frameHeight = cardFrames.view.heightRem;
  $: hasCardFrames = Object.keys(cardFrames.view).length > 0 || Object.keys(cardFrames.byRecord).length > 0;

  function handleFrameHeightChange(raw: string) {
    if (raw.trim() === "") {
      emitUpdate(withViewHeight(view?.config, undefined));
      return;
    }
    const height = normalizeHeightRem(raw);
    if (height === undefined) return;
    emitUpdate(withViewHeight(view?.config, snapHeightRem(height)));
  }

  // Database/Table-specific settings
  $: isLegacyTable = view?.type === "table";
  $: tableConfig = isLegacyTable
    ? ((view?.config as Record<string, unknown>) ?? {})
    : ((view?.config?.["table"] as Record<string, unknown>) ?? {});
  $: fieldConfig = (tableConfig["fieldConfig"] as Record<string, { hide?: boolean }>) ?? {};
  $: rowHeight = (tableConfig["rowHeight"] as "compact" | "default" | "expanded") ?? "default";
  $: wrapText = (tableConfig["wrapText"] as boolean) ?? false;
  $: showAggregationRow = (tableConfig["showAggregationRow"] as boolean) ?? false;
  $: freezeUpTo = (tableConfig["freezeUpTo"] as string) ?? "";
  $: tableConfigIconField = (tableConfig["iconField"] as string) ?? "";

  function emitUpdate(partial: Record<string, any>) {
    dispatch("update", partial);
  }

  function emitTableUpdate(partial: Record<string, unknown>) {
    if (isLegacyTable) {
      emitUpdate(partial);
      return;
    }
    emitUpdate({ table: { ...tableConfig, ...partial } });
  }

  function handleFieldVisibilityChange(fieldName: string, visible: boolean) {
    const newFieldConfig = {
      ...fieldConfig,
      [fieldName]: {
        ...fieldConfig[fieldName],
        hide: !visible,
      },
    };
    emitTableUpdate({ fieldConfig: newFieldConfig });
  }

  // chrome-filters: "Fields on the card". The card shows the selected fields
  // in the saved `includeFields` order (GalleryView reads the same helper);
  // up/down reorder that list, remove takes a field off, and the fields not
  // on the card follow in frame order as an add list. Every change is one
  // `includeFields` array through emitUpdate, never a binding.
  $: cardFields = cardFieldsInOrder(fields, galleryIncludeFields);
  $: cardFieldNames = new Set(cardFields.map((f) => f.name));
  $: availableCardFields = fields.filter((f) => !cardFieldNames.has(f.name));

  /** Computed, not stored (dataframe.ts `derived`): marked ƒ, as on the card. */
  const isComputed = (field: { type: string; derived?: boolean }): boolean =>
    field.derived === true || field.type === "formula" || field.type === "rollup";

  function moveCardField(fieldName: string, delta: -1 | 1) {
    const present = new Set(fields.map((f) => f.name));
    emitUpdate({ includeFields: moveIncludedField(galleryIncludeFields, fieldName, delta, (n) => present.has(n)) });
  }

  function removeCardField(fieldName: string) {
    emitUpdate({ includeFields: galleryIncludeFields.filter((n) => n !== fieldName) });
  }

  function addCardField(fieldName: string) {
    if (galleryIncludeFields.includes(fieldName)) return;
    emitUpdate({ includeFields: [...galleryIncludeFields, fieldName] });
  }
  
  // Generate hour options (0-24)
  const hourOptions = Array.from({ length: 25 }, (_, i) => i);
  const startHourOptions = hourOptions.slice(0, 24);
  const endHourOptions = hourOptions.slice(1);

  // settings-binds: the hour selects carry numbers; the DOM reports a string,
  // so the hour is read back from the options by the selected index, which
  // keeps the stored value a number (as the old two-way binding wrote it).
  function emitHour(key: "startHour" | "endHour", options: number[], index: number) {
    const hour = options[index];
    if (hour === undefined) return;
    emitUpdate({ [key]: hour });
  }

  // String fields for Gallery cover
  $: stringFields = fields.filter(f => f.type === "string" || f.type === "String" || f.type === "text");
  
  // Number fields for Board order sync
  $: numberFields = fields.filter(f => f.type === "number" || f.type === "Number");

  // Hidden fields for Database view
  $: orderFields = (tableConfig["orderFields"] as string[]) ?? [];
  $: hiddenFields = fields.filter(f => fieldConfig[f.name]?.hide);
  $: visibleFields = (() => {
    const all = fields.filter(f => !fieldConfig[f.name]?.hide);
    if (orderFields.length === 0) return all;
    return [...all].sort((a, b) => {
      const ia = orderFields.indexOf(a.name);
      const ib = orderFields.indexOf(b.name);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  })();

  // DG-3: drag-to-reorder visible fields
  let fieldDragIndex: number | null = null;
  let fieldDragOverIndex: number | null = null;

  function onFieldDragStart(index: number, e: DragEvent) {
    fieldDragIndex = index;
    e.dataTransfer!.effectAllowed = "move";
  }

  function onFieldDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    fieldDragOverIndex = index;
  }

  function onFieldDrop(index: number, e: DragEvent) {
    e.preventDefault();
    if (fieldDragIndex === null || fieldDragIndex === index) {
      fieldDragIndex = null; fieldDragOverIndex = null; return;
    }
    const arr = [...visibleFields];
    const [moved] = arr.splice(fieldDragIndex, 1);
    arr.splice(index, 0, moved!);
    fieldDragIndex = null; fieldDragOverIndex = null;
    emitTableUpdate({ orderFields: arr.map(f => f.name) });
  }

  function onFieldDragEnd() { fieldDragIndex = null; fieldDragOverIndex = null; }
</script>

<div class="section">
  <div class="header">{$i18n.t('settings-menu.view-config.title')}</div>
  {#if view}
    <p class="muted">{$i18n.t('settings-menu.view-config.current-view')}: {view.name} ({$i18n.t(`views.${view.type}.name`, { defaultValue: view.type })})</p>

    {#if isCalendar}
      <div class="group">
        <label>
          {$i18n.t('settings-menu.view-config.calendar.interval')}
          <select data-calendar-option="interval" value={interval} on:change={(e) => emitUpdate({ interval: e.currentTarget.value })}>
            <option value="year">{$i18n.t('settings-menu.view-config.calendar.interval-options.year')}</option>
            <option value="month">{$i18n.t('settings-menu.view-config.calendar.interval-options.month')}</option>
            <option value="week">{$i18n.t('settings-menu.view-config.calendar.interval-options.week')}</option>
            <option value="day">{$i18n.t('settings-menu.view-config.calendar.interval-options.day')}</option>
          </select>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.calendar.layout')}
          <select value={displayMode} on:change={(e) => emitUpdate({ displayMode: e.currentTarget.value })}>
            <option value="headers">{$i18n.t('settings-menu.view-config.calendar.layout-options.headers')}</option>
            <option value="bars">{$i18n.t('settings-menu.view-config.calendar.layout-options.bars')}</option>
          </select>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.calendar.time-format')}
          <select value={timeFormat} on:change={(e) => emitUpdate({ timeFormat: e.currentTarget.value })}>
            <option value="24h">24h</option>
            <option value="12h">12h</option>
          </select>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.calendar.timezone')}
          <input
            type="text"
            data-calendar-option="timezone"
            value={timezone}
            placeholder={$i18n.t('settings-menu.view-config.calendar.hints.timezone')}
            on:change={(e) => emitUpdate({ timezone: e.currentTarget.value })}
          />
        </label>
        
        {#if isTimeline}
          <SettingsSection title={$i18n.t('settings-menu.view-config.calendar.timeline.title')} collapsed>
            <div class="row">
              <label class="half">
                {$i18n.t('settings-menu.view-config.calendar.timeline.start-hour')}
                <select value={startHour} on:change={(e) => emitHour("startHour", startHourOptions, e.currentTarget.selectedIndex)}>
                  {#each startHourOptions as h}
                    <option value={h}>{h.toString().padStart(2, '0')}:00</option>
                  {/each}
                </select>
              </label>
              
              <label class="half">
                {$i18n.t('settings-menu.view-config.calendar.timeline.end-hour')}
                <select value={endHour} on:change={(e) => emitHour("endHour", endHourOptions, e.currentTarget.selectedIndex)}>
                  {#each endHourOptions as h}
                    <option value={h}>{h.toString().padStart(2, '0')}:00</option>
                  {/each}
                </select>
              </label>
            </div>
            
            <label>
              {$i18n.t('settings-menu.view-config.calendar.timeline.event-color-field')}
              <input
                type="text"
                value={eventColorField}
                placeholder={$i18n.t('settings-menu.view-config.calendar.timeline.hints.event-color-placeholder')}
                on:change={(e) => emitUpdate({ eventColorField: e.currentTarget.value })}
              />
              <span class="hint">{$i18n.t('settings-menu.view-config.calendar.timeline.hints.event-color-field')}</span>
            </label>
            
            <label class="checkbox">
              <input
                class="ppp-touch-target"
                type="checkbox"
                checked={showWeekends}
                on:change={(e) => emitUpdate({ showWeekends: e.currentTarget.checked })}
              />
              <span>{$i18n.t('settings-menu.view-config.calendar.timeline.show-weekends')}</span>
            </label>
            
            <label class="checkbox">
              <input
                class="ppp-touch-target"
                type="checkbox"
                checked={showAllDaySection}
                on:change={(e) => emitUpdate({ showAllDaySection: e.currentTarget.checked })}
              />
              <span>{$i18n.t('settings-menu.view-config.calendar.timeline.show-all-day')}</span>
            </label>
          </SettingsSection>
        {/if}

        <label class="checkbox">
          <input
            class="ppp-touch-target"
            type="checkbox"
            checked={agendaOpen}
            on:change={(e) => emitUpdate({ agendaOpen: e.currentTarget.checked })}
          />
          <span>{$i18n.t('settings-menu.view-config.calendar.show-agenda')}</span>
        </label>
        
        <!-- Field Mapping Section -->
        <SettingsSection title={$i18n.t('settings-menu.view-config.calendar.field-mapping.title')}>
          <span class="hint" style="margin-bottom: 0.5rem; display: block;">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hint')}</span>
          
          <label for="fieldlist-date-input">
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.date')}
            <FieldComboInput
              {fields}
              id="fieldlist-date"
              value={dateField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
              on:change={(e) => emitUpdate({ dateField: e.detail })}
            />
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.date')}</span>
          </label>
          
          <label for="fieldlist-startDate-input">
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.start-date')}
            <FieldComboInput
              {fields}
              id="fieldlist-startDate"
              value={startDateField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
              on:change={(e) => emitUpdate({ startDateField: e.detail })}
            />
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.start-date')}</span>
          </label>
          
          <label for="fieldlist-endDate-input">
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.end-date')}
            <FieldComboInput
              {fields}
              id="fieldlist-endDate"
              value={endDateField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
              on:change={(e) => emitUpdate({ endDateField: e.detail })}
            />
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.end-date')}</span>
          </label>
          
          <label for="fieldlist-startTime-input">
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.start-time')}
            <FieldComboInput
              {fields}
              id="fieldlist-startTime"
              value={startTimeField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
              on:change={(e) => emitUpdate({ startTimeField: e.detail })}
            />
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.start-time')}</span>
          </label>
          
          <label for="fieldlist-endTime-input">
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.end-time')}
            <FieldComboInput
              {fields}
              id="fieldlist-endTime"
              value={endTimeField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
              on:change={(e) => emitUpdate({ endTimeField: e.detail })}
            />
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.end-time')}</span>
          </label>
          
          <label for="fieldlist-check-input">
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.check')}
            <FieldComboInput
              {fields}
              id="fieldlist-check"
              value={checkField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
              on:change={(e) => emitUpdate({ checkField: e.detail })}
            />
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.check')}</span>
          </label>

          <label for="fieldlist-icon-calendar-input">
            {$i18n.t("settings-menu.view-config.shared.icon-field", { defaultValue: "Icon field" })}
            <FieldComboInput
              fields={stringFields}
              id="fieldlist-icon-calendar"
              value={iconField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
              on:change={(e) => emitUpdate({ iconField: e.detail || undefined })}
            />
            <span class="hint">{$i18n.t("settings-menu.view-config.shared.hints.icon-field", { defaultValue: "Field with an emoji or lucide icon name. Shown as a per-record icon." })}</span>
          </label>
        </SettingsSection>
      </div>
    {/if}

    {#if isBoard}
      <div class="group">
        <label>
          {$i18n.t('settings-menu.view-config.board.column-width')}
          <input
            type="number"
            data-board-option="column-width"
            value={columnWidth}
            placeholder="270"
            on:change={(e) => {
              // settings-binds: read the field itself. An emptied field resets
              // the width to the default (as the old bind did); a value that is
              // not a positive number writes nothing.
              if (e.currentTarget.value.trim() === "") {
                emitUpdate({ columnWidth: undefined });
                return;
              }
              const width = e.currentTarget.valueAsNumber;
              if (!Number.isFinite(width) || width <= 0) return;
              emitUpdate({ columnWidth: width });
            }}
          />
          <span class="hint">{$i18n.t('settings-menu.view-config.board.hints.column-width')}</span>
        </label>

        <label for="fieldlist-groupBy-input">
          {$i18n.t('settings-menu.view-config.board.group-by-field')}
          <FieldComboInput
            fields={stringFields}
            id="fieldlist-groupBy"
            value={groupByField}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitUpdate({ groupByField: e.detail || undefined })}
          />
          <span class="hint">{$i18n.t('settings-menu.view-config.board.hints.group-by-field')}</span>
        </label>

        <label for="fieldlist-header-input">
          {$i18n.t('settings-menu.view-config.board.header-field')}
          <FieldComboInput
            {fields}
            id="fieldlist-header"
            value={headerField}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitUpdate({ headerField: e.detail || undefined })}
          />
          <span class="hint">{$i18n.t('settings-menu.view-config.board.hints.header-field')}</span>
        </label>

        <label for="fieldlist-icon-board-input">
          {$i18n.t("settings-menu.view-config.shared.icon-field", { defaultValue: "Icon field" })}
          <FieldComboInput
            fields={stringFields}
            id="fieldlist-icon-board"
            value={iconField}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitUpdate({ iconField: e.detail || undefined })}
          />
          <span class="hint">{$i18n.t("settings-menu.view-config.shared.hints.icon-field", { defaultValue: "Field with an emoji or lucide icon name. Shown as a per-record icon." })}</span>
        </label>

        <label for="fieldlist-orderSync-input">
          {$i18n.t('settings-menu.view-config.board.order-sync-field')}
          <FieldComboInput
            fields={numberFields}
            id="fieldlist-orderSync"
            value={orderSyncField}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitUpdate({ orderSyncField: e.detail || undefined })}
          />
          <span class="hint">{$i18n.t('settings-menu.view-config.board.hints.order-sync-field')}</span>
        </label>

        <label>
          {$i18n.t("settings-menu.view-config.board.thumbnail-layout")}
          <select data-board-option="thumbnail-layout" value={thumbnailLayout} on:change={(e) => emitUpdate({ thumbnailLayout: e.currentTarget.value })}>
            {#each BOARD_THUMBNAIL_LAYOUTS as option}
              <option value={option}>{$i18n.t(`settings-menu.view-config.board.thumbnail-options.${option}`)}</option>
            {/each}
          </select>
          <span class="hint">{$i18n.t("settings-menu.view-config.board.hints.thumbnail-layout")}</span>
        </label>

        <label for="fieldlist-cover-board-input">
          {$i18n.t("settings-menu.view-config.board.cover-field")}
          <FieldComboInput
            fields={stringFields}
            id="fieldlist-cover-board"
            value={coverField}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitUpdate({ coverField: e.detail || undefined })}
          />
          <span class="hint">{$i18n.t("settings-menu.view-config.board.hints.cover-field")}</span>
        </label>

        <label class="checkbox">
          <input
            class="ppp-touch-target"
            type="checkbox"
            data-board-option="freeze-columns"
            checked={freezeAll}
            on:change={(e) => {
              const frozen = e.currentTarget.checked;
              emitUpdate({ freezeAll: frozen, freezeColumns: frozen });
            }}
          />
          <span>{$i18n.t("settings-menu.view-config.board.freeze-columns")}</span>
        </label>
      </div>
    {/if}

    {#if isGallery}
      <div class="group">
        <label>
          {$i18n.t("settings-menu.view-config.gallery.layout")}
          <select data-gallery-option="layout" value={galleryLayout} on:change={(e) => emitUpdate({ layout: e.currentTarget.value })}>
            {#each GALLERY_LAYOUTS as option}
              <option value={option}>{$i18n.t(`settings-menu.view-config.gallery.layout-options.${option}`)}</option>
            {/each}
          </select>
        </label>

        <div class="field-list">
          <span class="field-list-label">{$i18n.t("settings-menu.view-config.gallery.card-size")}</span>
          <div class="size-presets" role="group" aria-label={$i18n.t("settings-menu.view-config.gallery.card-size")}>
            {#each SIZE_PRESETS as [preset, width]}
              <button
                type="button"
                class="size-preset"
                data-gallery-size={preset}
                aria-pressed={sizePreset === preset}
                on:click={() => { cardWidth = width; emitUpdate({ cardWidth: width }); }}
              >{$i18n.t(`settings-menu.view-config.gallery.size-options.${preset}`)}</button>
            {/each}
          </div>
        </div>

        <label>
          {$i18n.t("settings-menu.view-config.gallery.card-width")}
          <input
            type="number"
            value={cardWidth}
            placeholder="300"
            on:change={(e) => {
              // cards-g3: read the field itself, as the presets do; a bind to
              // the normalised width did not reach the preset state.
              const width = e.currentTarget.valueAsNumber;
              if (!Number.isFinite(width) || width <= 0) return;
              cardWidth = width;
              emitUpdate({ cardWidth: width });
            }}
          />
          <span class="hint">{$i18n.t("settings-menu.view-config.gallery.hints.card-width")}</span>
        </label>

        <label>
          {$i18n.t("settings-menu.view-config.gallery.aspect-ratio")}
          <select data-gallery-option="aspect-ratio" value={coverAspectRatio} on:change={(e) => emitUpdate({ coverAspectRatio: e.currentTarget.value })}>
            {#each GALLERY_ASPECT_RATIOS as option}
              <option value={option}>{option === "none" ? $i18n.t("settings-menu.view-config.gallery.aspect-ratio-none") : option.replace("/", ":")}</option>
            {/each}
          </select>
        </label>

        <label for="fieldlist-cover-input">
          {$i18n.t("settings-menu.view-config.gallery.cover-field")}
          <FieldComboInput
            fields={stringFields}
            id="fieldlist-cover"
            value={coverField}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitUpdate({ coverField: e.detail || undefined })}
          />
          <span class="hint">{$i18n.t("settings-menu.view-config.gallery.hints.cover-field")}</span>
        </label>

        <label for="fieldlist-icon-gallery-input">
          {$i18n.t("settings-menu.view-config.shared.icon-field", { defaultValue: "Icon field" })}
          <FieldComboInput
            fields={stringFields}
            id="fieldlist-icon-gallery"
            value={iconField}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitUpdate({ iconField: e.detail || undefined })}
          />
          <span class="hint">{$i18n.t("settings-menu.view-config.shared.hints.icon-field", { defaultValue: "Field with an emoji or lucide icon name. Shown as a per-record icon." })}</span>
        </label>

        <label>
          {$i18n.t("settings-menu.view-config.gallery.fit-style")}
          <select data-gallery-option="fit" value={fitStyle} on:change={(e) => emitUpdate({ fitStyle: e.currentTarget.value })}>
            <option value="cover">{$i18n.t("settings-menu.view-config.gallery.fit-options.fill")}</option>
            <option value="contain">{$i18n.t("settings-menu.view-config.gallery.fit-options.fit")}</option>
            {#if gallery.fitStyle === "fill"}
              <option value="fill">{$i18n.t("settings-menu.view-config.gallery.fit-options.stretch")}</option>
            {/if}
          </select>
        </label>

        <!-- chrome-filters: everything that decides what a card shows under its
             title, in one place: the selected fields in display order, their
             names on or off, and the fields that could be added. -->
        <div class="field-list card-fields" data-gallery-section="card-fields">
          <span class="field-list-label">{$i18n.t("settings-menu.view-config.gallery.card-fields")}</span>
          <span class="hint">{$i18n.t("settings-menu.view-config.gallery.hints.card-fields")}</span>

          <label class="checkbox">
            <input
              class="ppp-touch-target"
              type="checkbox"
              data-gallery-option="labels"
              checked={showFieldLabels}
              on:change={(e) => emitUpdate({ showFieldLabels: e.currentTarget.checked })}
            />
            <span>{$i18n.t("settings-menu.view-config.gallery.show-field-labels")}</span>
          </label>

          {#if cardFields.length === 0}
            <p class="card-fields-empty" data-gallery-card-fields-empty>{$i18n.t("settings-menu.view-config.gallery.card-fields-empty")}</p>
          {:else}
            <ol class="card-fields-list" data-gallery-card-fields>
              {#each cardFields as field, index (field.name)}
                <li class="card-field" data-gallery-card-field={field.name}>
                  <span
                    class="card-field-kind"
                    class:card-field-kind--derived={isComputed(field)}
                    data-gallery-field-kind={isComputed(field) ? "derived" : field.type}
                    title={isComputed(field)
                      ? $i18n.t("settings-menu.view-config.gallery.derived-field")
                      : $i18n.t(`data-types.${field.type}`, { defaultValue: field.type })}
                  >
                    {#if isComputed(field)}<span aria-hidden="true">ƒ</span>{:else}<Icon name={getFieldIcon(field.type)} size="sm" />{/if}
                  </span>
                  <span class="card-field-name">{field.name}</span>
                  <button
                    type="button"
                    class="card-field-btn"
                    data-gallery-field-action="up"
                    disabled={index === 0}
                    aria-label={$i18n.t("settings-menu.view-config.gallery.move-up", { name: field.name })}
                    on:click={() => moveCardField(field.name, -1)}
                  ><Icon name="chevron-up" size="sm" /></button>
                  <button
                    type="button"
                    class="card-field-btn"
                    data-gallery-field-action="down"
                    disabled={index === cardFields.length - 1}
                    aria-label={$i18n.t("settings-menu.view-config.gallery.move-down", { name: field.name })}
                    on:click={() => moveCardField(field.name, 1)}
                  ><Icon name="chevron-down" size="sm" /></button>
                  <button
                    type="button"
                    class="card-field-btn"
                    data-gallery-field-action="remove"
                    aria-label={$i18n.t("settings-menu.view-config.gallery.remove-field", { name: field.name })}
                    on:click={() => removeCardField(field.name)}
                  ><Icon name="eye" size="sm" /></button>
                </li>
              {/each}
            </ol>
          {/if}

          {#if availableCardFields.length > 0}
            <span class="field-list-label field-list-label--hidden">{$i18n.t("settings-menu.view-config.gallery.card-fields-add")}</span>
            <ul class="card-fields-list card-fields-list--available" data-gallery-card-fields-available>
              {#each availableCardFields as field (field.name)}
                <li class="card-field card-field--available" data-gallery-available-field={field.name}>
                  <span
                    class="card-field-kind"
                    class:card-field-kind--derived={isComputed(field)}
                    data-gallery-field-kind={isComputed(field) ? "derived" : field.type}
                    title={isComputed(field)
                      ? $i18n.t("settings-menu.view-config.gallery.derived-field")
                      : $i18n.t(`data-types.${field.type}`, { defaultValue: field.type })}
                  >
                    {#if isComputed(field)}<span aria-hidden="true">ƒ</span>{:else}<Icon name={getFieldIcon(field.type)} size="sm" />{/if}
                  </span>
                  <span class="card-field-name">{field.name}</span>
                  <button
                    type="button"
                    class="card-field-btn"
                    data-gallery-field-action="add"
                    aria-label={$i18n.t("settings-menu.view-config.gallery.add-field", { name: field.name })}
                    on:click={() => addCardField(field.name)}
                  ><Icon name="eye-off" size="sm" /></button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    {/if}

    {#if isBoard || isGallery}
      <div class="group">
        <label>
          {$i18n.t("settings-menu.view-config.card-frames.height")}
          <input
            type="number"
            data-card-frame-option="height"
            min={CARD_FRAME_BOUNDS.heightRem.min}
            max={CARD_FRAME_BOUNDS.heightRem.max}
            step={HEIGHT_STEP_REM}
            value={frameHeight ?? ""}
            placeholder={$i18n.t("settings-menu.view-config.card-frames.auto")}
            on:change={(e) => handleFrameHeightChange(e.currentTarget.value)}
          />
          <span class="hint">{$i18n.t("settings-menu.view-config.card-frames.height-hint")}</span>
        </label>
        <button
          type="button"
          class="reset-frames"
          data-card-frame-option="reset-all"
          disabled={!hasCardFrames}
          on:click={() => emitUpdate(resetAllFrames())}
        >{$i18n.t("settings-menu.view-config.card-frames.reset-all")}</button>
      </div>
    {/if}

    {#if isDatabase}
      <div class="group">
        <div class="quick-links">
          <button class="quick-link-btn" on:click={() => dispatch("navigateTab", "filters")}>
            {$i18n.t("settings-menu.tabs.filters")} →
          </button>
          <button class="quick-link-btn" on:click={() => dispatch("navigateTab", "colors")}>
            {$i18n.t("settings-menu.tabs.colors")} →
          </button>
          <button class="quick-link-btn" on:click={() => dispatch("navigateTab", "sort")}>
            {$i18n.t("settings-menu.tabs.sort")} →
          </button>
        </div>

        <label>
          {$i18n.t("views.dashboard.table.row-height", { defaultValue: "Row height" })}
          <select value={rowHeight} on:change={(e) => emitTableUpdate({ rowHeight: e.currentTarget.value })}>
            <option value="compact">{$i18n.t("views.dashboard.table.row-height-compact", { defaultValue: "Compact" })}</option>
            <option value="default">{$i18n.t("views.dashboard.table.row-height-default", { defaultValue: "Default" })}</option>
            <option value="expanded">{$i18n.t("views.dashboard.table.row-height-expanded", { defaultValue: "Expanded" })}</option>
          </select>
        </label>

        <label class="checkbox">
          <input
            class="ppp-touch-target"
            type="checkbox"
            checked={wrapText}
            on:change={(e) => emitTableUpdate({ wrapText: e.currentTarget.checked })}
          />
          <span>{$i18n.t("views.dashboard.table.wrap-text", { defaultValue: "Wrap text in cells" })}</span>
        </label>

        <label class="checkbox">
          <input
            class="ppp-touch-target"
            type="checkbox"
            checked={showAggregationRow}
            on:change={(e) => emitTableUpdate({ showAggregationRow: e.currentTarget.checked })}
          />
          <span>{$i18n.t("views.dashboard.table.show-aggregation", { defaultValue: "Show aggregation row" })}</span>
        </label>

        <label for="fieldlist-freezeUpTo-input">
          {$i18n.t("views.dashboard.table.freeze-up-to", { defaultValue: "Freeze columns up to field" })}
          <FieldComboInput
            {fields}
            id="fieldlist-freezeUpTo"
            value={freezeUpTo}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitTableUpdate({ freezeUpTo: e.detail || undefined })}
          />
        </label>

        <label for="fieldlist-icon-database-input">
          {$i18n.t("settings-menu.view-config.shared.icon-field", { defaultValue: "Icon field" })}
          <FieldComboInput
            fields={stringFields}
            id="fieldlist-icon-database"
            value={tableConfigIconField}
            placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
            on:change={(e) => emitTableUpdate({ iconField: e.detail || undefined })}
          />
          <span class="hint">{$i18n.t("settings-menu.view-config.shared.hints.icon-field", { defaultValue: "Field with an emoji or lucide icon name. Shown as a per-record icon." })}</span>
        </label>

        <div class="field-list">
          <span class="field-list-label">{$i18n.t("settings-menu.view-config.table.hide-fields")}</span>
          <span class="hint">{$i18n.t("settings-menu.view-config.table.hints.hide-fields")}</span>
          {#each visibleFields as field, index}
            <div
              class="field-item field-item--draggable"
              class:field-item--drag-over={fieldDragOverIndex === index}
              draggable="true"
              on:dragstart={(e) => onFieldDragStart(index, e)}
              on:dragover={(e) => onFieldDragOver(index, e)}
              on:drop={(e) => onFieldDrop(index, e)}
              on:dragend={onFieldDragEnd}
            >
              <span class="field-drag-handle" aria-hidden="true">⠿</span>
              <label class="field-item-label">
                <input
                  class="ppp-touch-target"
                  type="checkbox"
                  checked={true}
                  on:change={(e) => handleFieldVisibilityChange(field.name, e.currentTarget.checked)}
                />
                <span>{field.name}</span>
              </label>
            </div>
          {/each}
        </div>

        {#if hiddenFields.length > 0}
          <div class="field-list field-list--hidden">
            <span class="field-list-label field-list-label--hidden">
              {$i18n.t("settings-menu.view-config.table.hidden-fields", { defaultValue: "Hidden fields" })}
              ({hiddenFields.length})
            </span>
            {#each hiddenFields as field}
              <label class="field-item field-item--hidden">
                <input
                  class="ppp-touch-target"
                  type="checkbox"
                  checked={false}
                  on:change={(e) => handleFieldVisibilityChange(field.name, e.currentTarget.checked)}
                />
                <span>{field.name}</span>
              </label>
            {/each}
            <button
              class="show-all-btn"
              on:click={() => {
                const newFieldConfig = { ...fieldConfig };
                for (const f of hiddenFields) {
                  newFieldConfig[f.name] = { ...newFieldConfig[f.name], hide: false };
                }
                emitTableUpdate({ fieldConfig: newFieldConfig });
              }}
            >
              {$i18n.t("settings-menu.view-config.table.show-all", { defaultValue: "Show all fields" })}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <p class="muted">{$i18n.t("settings-menu.view-config.no-view")}</p>
  {/if}
</div>

<style>
  .section { display: flex; flex-direction: column; gap: 0.375rem; }
  .header { font-weight: 600; }
  .muted { opacity: 0.7; font-size: 0.875rem; }
  .group { display: flex; flex-direction: column; gap: 0.625rem; }
  .quick-links {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }
  /* #103: rendered as secondary navigation links, NOT a second tab row —
     the top SettingsMenuTabs is the only tablist. */
  .quick-link-btn {
    border: none;
    background: transparent;
    color: var(--text-accent);
    border-radius: 0.25rem;
    padding: 0.125rem 0.25rem;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
  }
  .half {
    flex: 1 1 auto;
    min-width: 6rem;
  }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; }
  select, input[type="text"] {
    padding: 0.5rem 0.625rem;
    border-radius: 0.625rem;
    border: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    min-height: 2.75rem;
    width: 100%;
    box-sizing: border-box;
  }
  .checkbox { flex-direction: row; align-items: center; gap: 0.5rem; min-height: 2.75rem; }
  /* cards-g3: card size presets, as tall as the selects beside them. */
  .size-presets { display: flex; gap: 0.375rem; }
  .size-preset { flex: 1 1 0; min-height: 2.75rem; }
  .size-preset[aria-pressed="true"] {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  /* cards-g5: as tall as the selects beside it. */
  .reset-frames { min-height: 2.75rem; }
  .hint {
    font-size: 0.6875rem;
    opacity: 0.5;
  }
  .field-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field-list-label {
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }
  .field-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    min-height: 2rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    cursor: pointer;
  }
  .field-item input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    margin: 0;
  }

  /* DG-3: draggable field row */
  .field-item--draggable {
    cursor: default;
  }
  .field-item--drag-over {
    border-top: 0.125rem solid var(--interactive-accent);
    border-radius: 0;
  }
  .field-drag-handle {
    color: var(--text-faint);
    opacity: 0;
    cursor: grab;
    font-size: 0.875rem;
    flex-shrink: 0;
    transition: opacity 100ms ease;
  }
  .field-item-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    cursor: pointer;
  }
  .field-list--hidden {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: var(--ppp-border-width) dashed var(--background-modifier-border);
  }
  .field-list-label--hidden {
    color: var(--text-faint);
    font-size: 0.8125rem;
  }
  .field-item--hidden span {
    opacity: 0.5;
    text-decoration: line-through;
  }
  .show-all-btn {
    margin-top: 0.25rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    color: var(--interactive-accent);
    background: transparent;
    border: var(--ppp-border-width) dashed var(--interactive-accent);
    border-radius: 0.375rem;
    cursor: pointer;
    text-align: center;
  }

  /* chrome-filters: "Fields on the card" — one row per field: its kind (a
     type icon, or ƒ for a formula or rollup, as the card itself marks them),
     its name, then the row's buttons. The name takes what is left and
     ellipsizes, so a narrow panel never scrolls sideways. */
  .card-fields-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .card-field {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 2rem;
    min-width: 0;
    padding: 0.125rem 0.25rem 0.125rem 0.5rem;
    border-radius: 0.375rem;
    background: var(--background-secondary);
  }
  .card-field--available {
    background: transparent;
    color: var(--text-muted);
  }
  .card-field-kind {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 1.25rem;
    color: var(--text-muted);
  }
  .card-field-kind--derived {
    font-style: italic;
    font-weight: 600;
  }
  .card-field-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
  }
  .card-field-btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .card-field-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .card-fields-empty {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-faint);
  }

  /* ios-t1: hover tints and the drag handle's hover reveal reach only a pointer
     that hovers. Collected here, after every base rule they refine; none of
     them shares a property with a later rule of equal weight, so the desktop
     cascade is unchanged by the move. */
  @media (hover: hover) and (pointer: fine) {
    .quick-link-btn:hover {
      text-decoration: underline;
      color: var(--text-accent-hover, var(--text-accent));
    }
    select:hover, input[type="text"]:hover {
      border-color: var(--interactive-accent);
    }
    .field-item:hover {
      background: var(--background-modifier-hover);
    }
    .field-item--draggable:hover .field-drag-handle {
      opacity: 0.6;
    }
    .field-drag-handle:hover {
      opacity: 1 !important;
    }
    .show-all-btn:hover {
      background: var(--background-modifier-hover);
    }
    .card-field-btn:not(:disabled):hover {
      color: var(--text-normal);
      background: var(--background-modifier-hover);
    }
  }

  /* ios-t1: each checkbox carries `.ppp-touch-target` (tokens.css), a finger
     square centred on the box. Field rows grow to a target tall so the squares
     of neighbouring rows meet instead of overlapping. The drag handle is the
     row's HTML drag, which touch never starts, so it steps aside. */
  @media (pointer: coarse) {
    .field-item {
      min-height: var(--ppp-touch-target-min);
    }
    .field-drag-handle {
      display: none;
    }
    .quick-link-btn {
      min-height: var(--ppp-touch-target-min);
    }
    /* Three buttons side by side: each grows its own box to a target rather
       than borrowing `.ppp-touch-target`'s square, which would overlap. */
    .card-field {
      min-height: var(--ppp-touch-target-min);
    }
    .card-field-btn {
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
    }
  }
</style>
