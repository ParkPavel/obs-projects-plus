<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ViewDefinition } from "../../../../../settings/settings";
  import { i18n } from "src/lib/stores/i18n";

  export let view: ViewDefinition | undefined;
  export let fields: Array<{ name: string; type: string }> = [];

  const dispatch = createEventDispatcher<{ update: Record<string, any> }>();

  $: isCalendar = view?.type === "calendar";
  $: isBoard = view?.type === "board";
  $: isGallery = view?.type === "gallery";
  $: isDatabase = view?.type === "table" || view?.type === "database";
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

  // Gallery-specific settings
  $: cardWidth = (view?.config?.["cardWidth"] as number) ?? 300;
  $: coverField = (view?.config?.["coverField"] as string) ?? "";
  $: fitStyle = (view?.config?.["fitStyle"] as string) ?? "cover";
  $: galleryIncludeFields = (view?.config?.["includeFields"] as string[]) ?? [];

  // Table-specific settings
  $: fieldConfig = (view?.config?.["fieldConfig"] as Record<string, { hide?: boolean }>) ?? {};

  function emitUpdate(partial: Record<string, any>) {
    dispatch("update", partial);
  }

  function handleFieldVisibilityChange(fieldName: string, visible: boolean) {
    const newFieldConfig = {
      ...fieldConfig,
      [fieldName]: {
        ...fieldConfig[fieldName],
        hide: !visible,
      },
    };
    emitUpdate({ fieldConfig: newFieldConfig });
  }

  function handleGalleryIncludeFieldChange(fieldName: string, enabled: boolean) {
    const includedFields = new Set(galleryIncludeFields);
    if (enabled) {
      includedFields.add(fieldName);
    } else {
      includedFields.delete(fieldName);
    }
    emitUpdate({ includeFields: [...includedFields] });
  }
  
  // Generate hour options (0-24)
  const hourOptions = Array.from({ length: 25 }, (_, i) => i);
  
  // String fields for Gallery cover
  $: stringFields = fields.filter(f => f.type === "string" || f.type === "String" || f.type === "text");
  
  // Number fields for Board order sync
  $: numberFields = fields.filter(f => f.type === "number" || f.type === "Number");

  // Hidden fields for Database view
  $: hiddenFields = fields.filter(f => fieldConfig[f.name]?.hide);
  $: visibleFields = fields.filter(f => !fieldConfig[f.name]?.hide);
</script>

<div class="section">
  <div class="header">View Config</div>
  {#if view}
    <p class="muted">{$i18n.t('settings-menu.view-config.current-view')}: {view.name} ({view.type})</p>

    {#if isCalendar}
      <div class="group">
        <label>
          {$i18n.t('settings-menu.view-config.calendar.interval')}
          <select bind:value={interval} on:change={() => emitUpdate({ interval })}>
            <option value="year">{$i18n.t('settings-menu.view-config.calendar.interval-options.year')}</option>
            <option value="month">{$i18n.t('settings-menu.view-config.calendar.interval-options.month')}</option>
            <option value="week">{$i18n.t('settings-menu.view-config.calendar.interval-options.week')}</option>
            <option value="day">{$i18n.t('settings-menu.view-config.calendar.interval-options.day')}</option>
          </select>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.calendar.layout')}
          <select bind:value={displayMode} on:change={() => emitUpdate({ displayMode })}>
            <option value="headers">{$i18n.t('settings-menu.view-config.calendar.layout-options.headers')}</option>
            <option value="bars">{$i18n.t('settings-menu.view-config.calendar.layout-options.bars')}</option>
          </select>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.calendar.time-format')}
          <select bind:value={timeFormat} on:change={() => emitUpdate({ timeFormat })}>
            <option value="24h">24h</option>
            <option value="12h">12h</option>
          </select>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.calendar.timezone')}
          <input
            type="text"
            bind:value={timezone}
            placeholder={$i18n.t('settings-menu.view-config.calendar.hints.timezone')}
            on:change={() => emitUpdate({ timezone })}
          />
        </label>
        
        {#if isTimeline}
          <div class="subgroup">
            <div class="subheader">{$i18n.t('settings-menu.view-config.calendar.timeline.title')}</div>
            
            <div class="row">
              <label class="half">
                {$i18n.t('settings-menu.view-config.calendar.timeline.start-hour')}
                <select bind:value={startHour} on:change={() => emitUpdate({ startHour })}>
                  {#each hourOptions.slice(0, 24) as h}
                    <option value={h}>{h.toString().padStart(2, '0')}:00</option>
                  {/each}
                </select>
              </label>
              
              <label class="half">
                {$i18n.t('settings-menu.view-config.calendar.timeline.end-hour')}
                <select bind:value={endHour} on:change={() => emitUpdate({ endHour })}>
                  {#each hourOptions.slice(1) as h}
                    <option value={h}>{h.toString().padStart(2, '0')}:00</option>
                  {/each}
                </select>
              </label>
            </div>
            
            <label>
              {$i18n.t('settings-menu.view-config.calendar.timeline.event-color-field')}
              <input
                type="text"
                bind:value={eventColorField}
                placeholder={$i18n.t('settings-menu.view-config.calendar.timeline.hints.event-color-placeholder')}
                on:change={() => emitUpdate({ eventColorField })}
              />
              <span class="hint">{$i18n.t('settings-menu.view-config.calendar.timeline.hints.event-color-field')}</span>
            </label>
            
            <label class="checkbox">
              <input
                type="checkbox"
                bind:checked={showWeekends}
                on:change={() => emitUpdate({ showWeekends })}
              />
              <span>{$i18n.t('settings-menu.view-config.calendar.timeline.show-weekends')}</span>
            </label>
            
            <label class="checkbox">
              <input
                type="checkbox"
                bind:checked={showAllDaySection}
                on:change={() => emitUpdate({ showAllDaySection })}
              />
              <span>{$i18n.t('settings-menu.view-config.calendar.timeline.show-all-day')}</span>
            </label>
          </div>
        {/if}

        <label class="checkbox">
          <input
            type="checkbox"
            bind:checked={agendaOpen}
            on:change={() => emitUpdate({ agendaOpen })}
          />
          <span>{$i18n.t('settings-menu.view-config.calendar.show-agenda')}</span>
        </label>
        
        <!-- Field Mapping Section -->
        <div class="subgroup">
          <div class="subheader">{$i18n.t('settings-menu.view-config.calendar.field-mapping.title')}</div>
          <span class="hint" style="margin-bottom: 0.5rem; display: block;">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hint')}</span>
          
          <label>
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.date')}
            <div class="field-combo">
              <input
                type="text"
                list="fieldlist-date"
                bind:value={dateField}
                placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ dateField })}
              />
              <datalist id="fieldlist-date">
                {#each fields as f}
                  <option value={f.name} />
                {/each}
              </datalist>
              {#if dateField && !fields.some(f => f.name === dateField)}
                <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
              {/if}
            </div>
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.date')}</span>
          </label>
          
          <label>
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.start-date')}
            <div class="field-combo">
              <input
                type="text"
                list="fieldlist-startDate"
                bind:value={startDateField}
                placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ startDateField })}
              />
              <datalist id="fieldlist-startDate">
                {#each fields as f}
                  <option value={f.name} />
                {/each}
              </datalist>
              {#if startDateField && !fields.some(f => f.name === startDateField)}
                <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
              {/if}
            </div>
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.start-date')}</span>
          </label>
          
          <label>
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.end-date')}
            <div class="field-combo">
              <input
                type="text"
                list="fieldlist-endDate"
                bind:value={endDateField}
                placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ endDateField })}
              />
              <datalist id="fieldlist-endDate">
                {#each fields as f}
                  <option value={f.name} />
                {/each}
              </datalist>
              {#if endDateField && !fields.some(f => f.name === endDateField)}
                <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
              {/if}
            </div>
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.end-date')}</span>
          </label>
          
          <label>
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.start-time')}
            <div class="field-combo">
              <input
                type="text"
                list="fieldlist-startTime"
                bind:value={startTimeField}
                placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ startTimeField })}
              />
              <datalist id="fieldlist-startTime">
                {#each fields as f}
                  <option value={f.name} />
                {/each}
              </datalist>
              {#if startTimeField && !fields.some(f => f.name === startTimeField)}
                <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
              {/if}
            </div>
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.start-time')}</span>
          </label>
          
          <label>
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.end-time')}
            <div class="field-combo">
              <input
                type="text"
                list="fieldlist-endTime"
                bind:value={endTimeField}
                placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ endTimeField })}
              />
              <datalist id="fieldlist-endTime">
                {#each fields as f}
                  <option value={f.name} />
                {/each}
              </datalist>
              {#if endTimeField && !fields.some(f => f.name === endTimeField)}
                <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
              {/if}
            </div>
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.end-time')}</span>
          </label>
          
          <label>
            {$i18n.t('settings-menu.view-config.calendar.field-mapping.check')}
            <div class="field-combo">
              <input
                type="text"
                list="fieldlist-check"
                bind:value={checkField}
                placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ checkField })}
              />
              <datalist id="fieldlist-check">
                {#each fields as f}
                  <option value={f.name} />
                {/each}
              </datalist>
              {#if checkField && !fields.some(f => f.name === checkField)}
                <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
              {/if}
            </div>
            <span class="hint">{$i18n.t('settings-menu.view-config.calendar.field-mapping.hints.check')}</span>
          </label>
        </div>
      </div>
    {/if}

    {#if isBoard}
      <div class="group">
        <label>
          {$i18n.t('settings-menu.view-config.board.column-width')}
          <input
            type="number"
            bind:value={columnWidth}
            placeholder="270"
            on:change={() => emitUpdate({ columnWidth })}
          />
          <span class="hint">{$i18n.t('settings-menu.view-config.board.hints.column-width')}</span>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.board.group-by-field')}
          <div class="field-combo">
            <input
              type="text"
              list="fieldlist-groupBy"
              bind:value={groupByField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ groupByField: groupByField || undefined })}
            />
            <datalist id="fieldlist-groupBy">
              {#each stringFields as field}
                <option value={field.name} />
              {/each}
            </datalist>
            {#if groupByField && !stringFields.some(f => f.name === groupByField)}
              <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
            {/if}
          </div>
          <span class="hint">{$i18n.t('settings-menu.view-config.board.hints.group-by-field')}</span>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.board.header-field')}
          <div class="field-combo">
            <input
              type="text"
              list="fieldlist-header"
              bind:value={headerField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ headerField: headerField || undefined })}
            />
            <datalist id="fieldlist-header">
              {#each fields as field}
                <option value={field.name} />
              {/each}
            </datalist>
            {#if headerField && !fields.some(f => f.name === headerField)}
              <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
            {/if}
          </div>
          <span class="hint">{$i18n.t('settings-menu.view-config.board.hints.header-field')}</span>
        </label>

        <label>
          {$i18n.t('settings-menu.view-config.board.order-sync-field')}
          <div class="field-combo">
            <input
              type="text"
              list="fieldlist-orderSync"
              bind:value={orderSyncField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
                on:change={() => emitUpdate({ orderSyncField: orderSyncField || undefined })}
            />
            <datalist id="fieldlist-orderSync">
              {#each numberFields as field}
                <option value={field.name} />
              {/each}
            </datalist>
            {#if orderSyncField && !numberFields.some(f => f.name === orderSyncField)}
              <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
            {/if}
          </div>
          <span class="hint">{$i18n.t('settings-menu.view-config.board.hints.order-sync-field')}</span>
        </label>

        <label class="checkbox">
          <input
            type="checkbox"
            bind:checked={freezeAll}
            on:change={() => emitUpdate({ freezeAll, freezeColumns: freezeAll })}
          />
          <span>{$i18n.t("settings-menu.view-config.board.freeze-columns")}</span>
        </label>
      </div>
    {/if}

    {#if isGallery}
      <div class="group">
        <label>
          {$i18n.t("settings-menu.view-config.gallery.card-width")}
          <input
            type="number"
            bind:value={cardWidth}
            placeholder="300"
            on:change={() => emitUpdate({ cardWidth })}
          />
          <span class="hint">{$i18n.t("settings-menu.view-config.gallery.hints.card-width")}</span>
        </label>

        <label>
          {$i18n.t("settings-menu.view-config.gallery.cover-field")}
          <div class="field-combo">
            <input
              type="text"
              list="fieldlist-cover"
              bind:value={coverField}
              placeholder={$i18n.t('settings-menu.view-config.calendar.field-mapping.placeholder')}
              on:change={() => emitUpdate({ coverField: coverField || undefined })}
            />
            <datalist id="fieldlist-cover">
              {#each stringFields as field}
                <option value={field.name} />
              {/each}
            </datalist>
            {#if coverField && !stringFields.some(f => f.name === coverField)}
              <span class="new-field-badge">{$i18n.t('settings-menu.view-config.calendar.field-mapping.new-field')}</span>
            {/if}
          </div>
          <span class="hint">{$i18n.t("settings-menu.view-config.gallery.hints.cover-field")}</span>
        </label>

        <label>
          {$i18n.t("settings-menu.view-config.gallery.fit-style")}
          <select bind:value={fitStyle} on:change={() => emitUpdate({ fitStyle })}>
            <option value="cover">{$i18n.t("settings-menu.view-config.gallery.fit-options.fill")}</option>
            <option value="contain">{$i18n.t("settings-menu.view-config.gallery.fit-options.fit")}</option>
          </select>
        </label>

        <div class="field-list">
          <span class="field-list-label">{$i18n.t("settings-menu.view-config.gallery.include-fields")}</span>
          <span class="hint">{$i18n.t("settings-menu.view-config.gallery.hints.include-fields")}</span>
          {#each fields as field}
            <label class="field-item">
              <input
                type="checkbox"
                checked={galleryIncludeFields.includes(field.name)}
                on:change={(e) => handleGalleryIncludeFieldChange(field.name, e.currentTarget.checked)}
              />
              <span>{field.name}</span>
            </label>
          {/each}
        </div>
      </div>
    {/if}

    {#if isDatabase}
      <div class="group">
        <div class="field-list">
          <span class="field-list-label">{$i18n.t("settings-menu.view-config.table.hide-fields")}</span>
          <span class="hint">{$i18n.t("settings-menu.view-config.table.hints.hide-fields")}</span>
          {#each visibleFields as field}
            <label class="field-item">
              <input
                type="checkbox"
                checked={true}
                on:change={(e) => handleFieldVisibilityChange(field.name, e.currentTarget.checked)}
              />
              <span>{field.name}</span>
            </label>
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
                emitUpdate({ fieldConfig: newFieldConfig });
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
  .subgroup {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.75rem;
    background: var(--background-secondary-alt);
    border-radius: 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
  }
  .subheader {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.6;
    margin-bottom: 0.25rem;
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
  select:hover, input[type="text"]:hover {
    border-color: var(--interactive-accent);
  }
  .checkbox { flex-direction: row; align-items: center; gap: 0.5rem; min-height: 2.75rem; }
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
  .field-item:hover {
    background: var(--background-modifier-hover);
  }
  .field-item input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    margin: 0;
  }
  .field-combo {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .field-combo input[type="text"] {
    flex: 1;
  }
  .new-field-badge {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--interactive-accent);
    background: var(--background-secondary-alt);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    pointer-events: none;
    white-space: nowrap;
  }
  .field-list--hidden {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--background-modifier-border);
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
    border: 1px dashed var(--interactive-accent);
    border-radius: 0.375rem;
    cursor: pointer;
    text-align: center;
  }
  .show-all-btn:hover {
    background: var(--background-modifier-hover);
  }
</style>
