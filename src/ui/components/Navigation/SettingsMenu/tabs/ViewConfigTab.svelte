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
  $: isTable = view?.type === "table";
  $: isTimeline = interval === "day" || interval === "week";

  // Calendar settings
  let interval = (view?.config?.["interval"] as string) ?? (view?.config?.["displayMode"] as string) ?? "month";
  let displayMode = (view?.config?.["displayMode"] as string) ?? "headers";
  let timeFormat = (view?.config?.["timeFormat"] as string) ?? "24h";
  let timezone = (view?.config?.["timezone"] as string) ?? "local";
  let agendaOpen = (view?.config?.["agendaOpen"] as boolean) ?? false;
  let freezeAll = (view?.config?.["freezeAll"] as boolean) ?? (view?.config?.["freezeColumns"] as boolean) ?? false;
  
  // Timeline-specific settings
  let startHour = (view?.config?.["startHour"] as number) ?? 0;
  let endHour = (view?.config?.["endHour"] as number) ?? 24;
  let showWeekends = (view?.config?.["showWeekends"] as boolean) ?? true;
  let showAllDaySection = (view?.config?.["showAllDaySection"] as boolean) ?? true;
  let eventColorField = (view?.config?.["eventColorField"] as string) ?? "";
  
  // Field mapping for Calendar (frontmatter field names)
  let dateField = (view?.config?.["dateField"] as string) ?? "";
  let startDateField = (view?.config?.["startDateField"] as string) ?? "";
  let endDateField = (view?.config?.["endDateField"] as string) ?? "";
  let startTimeField = (view?.config?.["startTimeField"] as string) ?? "";
  let endTimeField = (view?.config?.["endTimeField"] as string) ?? "";
  let checkField = (view?.config?.["checkField"] as string) ?? "";

  // Board-specific settings
  let columnWidth = (view?.config?.["columnWidth"] as number) ?? 270;
  let groupByField = (view?.config?.["groupByField"] as string) ?? "";
  let headerField = (view?.config?.["headerField"] as string) ?? "";
  let orderSyncField = (view?.config?.["orderSyncField"] as string) ?? "";

  // Gallery-specific settings
  let cardWidth = (view?.config?.["cardWidth"] as number) ?? 300;
  let coverField = (view?.config?.["coverField"] as string) ?? "";
  let fitStyle = (view?.config?.["fitStyle"] as string) ?? "cover";
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
</script>

<div class="section">
  <div class="header">View Config</div>
  {#if view}
    <p class="muted">Текущий вид: {view.name} ({view.type})</p>

    {#if isCalendar}
      <div class="group">
        <label>
          Interval
          <select bind:value={interval} on:change={() => emitUpdate({ interval })}>
            <option value="year">Year</option>
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="day">Day</option>
          </select>
        </label>

        <label>
          Layout
          <select bind:value={displayMode} on:change={() => emitUpdate({ displayMode })}>
            <option value="headers">Headers (classic)</option>
            <option value="bars">Bars (timeline)</option>
          </select>
        </label>

        <label>
          Time format
          <select bind:value={timeFormat} on:change={() => emitUpdate({ timeFormat })}>
            <option value="24h">24h</option>
            <option value="12h">12h</option>
          </select>
        </label>

        <label>
          Timezone
          <input
            type="text"
            bind:value={timezone}
            placeholder="e.g. Europe/Moscow or local"
            on:change={() => emitUpdate({ timezone })}
          />
        </label>
        
        {#if isTimeline}
          <div class="subgroup">
            <div class="subheader">Timeline Settings</div>
            
            <div class="row">
              <label class="half">
                Start Hour
                <select bind:value={startHour} on:change={() => emitUpdate({ startHour })}>
                  {#each hourOptions.slice(0, 24) as h}
                    <option value={h}>{h.toString().padStart(2, '0')}:00</option>
                  {/each}
                </select>
              </label>
              
              <label class="half">
                End Hour
                <select bind:value={endHour} on:change={() => emitUpdate({ endHour })}>
                  {#each hourOptions.slice(1) as h}
                    <option value={h}>{h.toString().padStart(2, '0')}:00</option>
                  {/each}
                </select>
              </label>
            </div>
            
            <label>
              Event Color Field
              <input
                type="text"
                bind:value={eventColorField}
                placeholder="e.g. status, priority"
                on:change={() => emitUpdate({ eventColorField })}
              />
              <span class="hint">Поле для цвета событий (опционально)</span>
            </label>
            
            <label class="checkbox">
              <input
                type="checkbox"
                bind:checked={showWeekends}
                on:change={() => emitUpdate({ showWeekends })}
              />
              <span>Показывать выходные</span>
            </label>
            
            <label class="checkbox">
              <input
                type="checkbox"
                bind:checked={showAllDaySection}
                on:change={() => emitUpdate({ showAllDaySection })}
              />
              <span>Показывать секцию "Весь день"</span>
            </label>
          </div>
        {/if}

        <label class="checkbox">
          <input
            type="checkbox"
            bind:checked={agendaOpen}
            on:change={() => emitUpdate({ agendaOpen })}
          />
          <span>Показывать Agenda sidebar</span>
        </label>
        
        <!-- Field Mapping Section -->
        <div class="subgroup">
          <div class="subheader">Сопоставление полей</div>
          <span class="hint" style="margin-bottom: 0.5rem; display: block;">Укажите названия полей из фронтметера ваших заметок</span>
          
          <label>
            Поле даты (date)
            <select bind:value={dateField} on:change={() => emitUpdate({ dateField })}>
              <option value="">— Не выбрано —</option>
              {#each fields as f}
                <option value={f.name}>{f.name}</option>
              {/each}
            </select>
            <span class="hint">Основное поле даты события</span>
          </label>
          
          <label>
            Начало (startDate)
            <select bind:value={startDateField} on:change={() => emitUpdate({ startDateField })}>
              <option value="">— Не выбрано —</option>
              {#each fields as f}
                <option value={f.name}>{f.name}</option>
              {/each}
            </select>
            <span class="hint">Дата начала для многодневных событий</span>
          </label>
          
          <label>
            Конец (endDate)
            <select bind:value={endDateField} on:change={() => emitUpdate({ endDateField })}>
              <option value="">— Не выбрано —</option>
              {#each fields as f}
                <option value={f.name}>{f.name}</option>
              {/each}
            </select>
            <span class="hint">Дата окончания для многодневных событий</span>
          </label>
          
          <label>
            Время начала (startTime)
            <select bind:value={startTimeField} on:change={() => emitUpdate({ startTimeField })}>
              <option value="">— Не выбрано —</option>
              {#each fields as f}
                <option value={f.name}>{f.name}</option>
              {/each}
            </select>
            <span class="hint">Отдельное поле времени начала (HH:mm)</span>
          </label>
          
          <label>
            Время конца (endTime)
            <select bind:value={endTimeField} on:change={() => emitUpdate({ endTimeField })}>
              <option value="">— Не выбрано —</option>
              {#each fields as f}
                <option value={f.name}>{f.name}</option>
              {/each}
            </select>
            <span class="hint">Отдельное поле времени окончания</span>
          </label>
          
          <label>
            Поле статуса (check)
            <select bind:value={checkField} on:change={() => emitUpdate({ checkField })}>
              <option value="">— Не выбрано —</option>
              {#each fields as f}
                <option value={f.name}>{f.name}</option>
              {/each}
            </select>
            <span class="hint">Поле для отметки выполнения (completed, done и т.д.)</span>
          </label>
        </div>
      </div>
    {/if}

    {#if isBoard}
      <div class="group">
        <label>
          Ширина колонки
          <input
            type="number"
            bind:value={columnWidth}
            placeholder="270"
            on:change={() => emitUpdate({ columnWidth })}
          />
          <span class="hint">Ширина каждой колонки в пикселях</span>
        </label>

        <label>
          Поле группировки (статус)
          <select bind:value={groupByField} on:change={() => emitUpdate({ groupByField: groupByField || undefined })}>
            <option value="">— Не выбрано —</option>
            {#each stringFields as field}
              <option value={field.name}>{field.name}</option>
            {/each}
          </select>
          <span class="hint">Строковое поле фронтметера для группировки карточек по колонкам</span>
        </label>

        <label>
          Заголовок карточки
          <select bind:value={headerField} on:change={() => emitUpdate({ headerField: headerField || undefined })}>
            <option value="">— Нет —</option>
            {#each fields as field}
              <option value={field.name}>{field.name}</option>
            {/each}
          </select>
          <span class="hint">Поле для заголовка карточек</span>
        </label>

        <label>
          Синхронизация порядка
          <select bind:value={orderSyncField} on:change={() => emitUpdate({ orderSyncField: orderSyncField || undefined })}>
            <option value="">— Нет —</option>
            {#each numberFields as field}
              <option value={field.name}>{field.name}</option>
            {/each}
          </select>
          <span class="hint">Числовое поле для сохранения позиции карточек</span>
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
          <select bind:value={coverField} on:change={() => emitUpdate({ coverField: coverField || undefined })}>
            <option value="">{$i18n.t("settings-menu.view-config.none")}</option>
            {#each stringFields as field}
              <option value={field.name}>{field.name}</option>
            {/each}
          </select>
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

    {#if isTable}
      <div class="group">
        <div class="field-list">
          <span class="field-list-label">{$i18n.t("settings-menu.view-config.table.hide-fields")}</span>
          <span class="hint">{$i18n.t("settings-menu.view-config.table.hints.hide-fields")}</span>
          {#each fields as field}
            <label class="field-item">
              <input
                type="checkbox"
                checked={!fieldConfig[field.name]?.hide}
                on:change={(e) => handleFieldVisibilityChange(field.name, e.currentTarget.checked)}
              />
              <span>{field.name}</span>
            </label>
          {/each}
        </div>
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
</style>
