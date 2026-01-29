<script lang="ts">
  import { app } from '../../../lib/stores/obsidian';
  import { produce } from "immer";
  import {
    Callout,
    ModalContent,
    ModalLayout,
    SettingItem,
    Typography,
    Icon,
  } from "obsidian-svelte";

  import { FieldControl } from "src/ui/components/FieldControl";
  import type { DataField, DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { DataFieldType, isString } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { onMount } from "svelte";

  export let fields: DataField[];
  export let record: DataRecord;
  export let onSave: (record: DataRecord) => void;
  export let allRecords: DataRecord[] = [];
  // v3.0.1: Callbacks for note title actions
  export let onOpenNote: (() => void) | undefined = undefined;
  export let onRenameNote: ((newName: string) => void) | undefined = undefined;
  
  // v3.0.1: Note title state
  $: noteFileName = record.id.split('/').pop()?.replace('.md', '') ?? record.id;
  let isEditingTitle = false;
  let editedTitle = noteFileName;
  
  function startEditTitle() {
    editedTitle = noteFileName;
    isEditingTitle = true;
  }
  
  function cancelEditTitle() {
    isEditingTitle = false;
    editedTitle = noteFileName;
  }
  
  function saveTitle() {
    if (editedTitle.trim() && editedTitle !== noteFileName) {
      onRenameNote?.(editedTitle.trim());
    }
    isEditingTitle = false;
  }
  
  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      cancelEditTitle();
    }
  }
  
  // ========================================
  // FIELD VALUE SUGGESTIONS
  // Собираем уникальные значения для каждого поля из всех записей
  // ========================================
  $: fieldSuggestions = (() => {
    const suggestions: Record<string, string[]> = {};
    
    fields.forEach(field => {
      // Пропускаем поля с уже настроенными опциями
      if (field.typeConfig?.options?.length) return;
      // Только для строковых полей без повторений
      if (field.type !== DataFieldType.String || field.repeated) return;
      
      const uniqueValues = new Set<string>();
      
      allRecords.forEach(rec => {
        const val = rec.values[field.name];
        if (isString(val) && val.trim() !== '') {
          uniqueValues.add(val);
        }
      });
      
      // Только если есть хотя бы 2 уникальных значения для подсказок
      if (uniqueValues.size >= 2) {
        suggestions[field.name] = Array.from(uniqueValues).sort();
      }
    });
    
    return suggestions;
  })();
  
  // ========================================
  // REACTIVITY FIX: Force UI updates on value changes
  // ========================================
  // We create a reactive copy of values that Svelte will track
  // Using proper type from DataRecord
  let valuesSnapshot: Record<string, Optional<DataValue>> = {};
  
  // Update snapshot whenever record changes
  $: valuesSnapshot = { ...record.values };
  
  // Helper to update value (triggers reactivity)
  function setValue(fieldName: string, newValue: Optional<DataValue>) {
    // Update record via immer
    // @ts-ignore: Type instantiation is excessively deep
    record = produce(record, (draft) => {
      // @ts-ignore
      draft.values[fieldName] = newValue;
    });
    // Also update snapshot to trigger immediate UI update
    valuesSnapshot = { ...valuesSnapshot, [fieldName]: newValue };
  }

  // Группировка и сортировка полей
  interface FieldGroup {
    title: string;
    icon: string;
    fields: DataField[];
    priority: number;
    collapsed: boolean;
    description?: string;
  }

  const DATE_TIME_FIELDS = ['date', 'start', 'end', 'due', 'created', 'modified', 'time', 'startTime', 'endTime', 'datetime', 'timestamp'];
  const COLOR_FIELDS = ['color', 'eventColor', 'tagColor', 'backgroundColor'];
  const IMAGE_FIELDS = ['cover', 'banner', 'image', 'thumbnail', 'icon'];

  function categorizeField(field: DataField): 'datetime' | 'color' | 'image' | 'basic' | 'other' {
    const nameLower = field.name.toLowerCase();
    
    if (field.type === DataFieldType.Date || DATE_TIME_FIELDS.some(dt => nameLower.includes(dt))) {
      return 'datetime';
    }
    
    if (COLOR_FIELDS.some(cf => nameLower.includes(cf))) {
      return 'color';
    }
    
    if (IMAGE_FIELDS.some(img => nameLower.includes(img))) {
      return 'image';
    }
    
    if (field.identifier || ['name', 'title', 'path'].includes(nameLower)) {
      return 'basic';
    }
    
    return 'other';
  }

  function getFieldPriority(field: DataField): number {
    const category = categorizeField(field);
    const categoryPriority = {
      'datetime': 1,
      'basic': 2,
      'color': 3,
      'image': 4,
      'other': 5
    };
    return categoryPriority[category];
  }

  $: editableFields = fields
    .filter((field) => !field.derived)
    .sort((a, b) => {
      const priorityDiff = getFieldPriority(a) - getFieldPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name);
    });

  $: readonlyFields = fields.filter((field) => field.derived);

  // Состояние сворачивания групп - сохраняется в localStorage
  let collapsedState: Record<string, boolean> = {};
  
  // Load collapsed state from localStorage on mount
  onMount(() => {
    const appInstance = (window as any).app || $app;
    const saved = appInstance?.loadLocalStorage('editNote.collapsedGroups');
    if (saved) {
      try {
        collapsedState = JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse collapsed groups state:', e);
      }
    }
  });
  
  // Save collapsed state to localStorage
  function saveCollapsedState() {
    const appInstance = (window as any).app || $app;
    appInstance?.saveLocalStorage('editNote.collapsedGroups', JSON.stringify(collapsedState));
  }

  // Группировка полей
  $: fieldGroups = (() => {
    const groups: Record<string, FieldGroup> = {};
    
    editableFields.forEach(field => {
      const category = categorizeField(field);
      
      if (!groups[category]) {
        const groupConfig = {
          'datetime': { 
            title: 'Date & Time', 
            icon: 'calendar-clock', 
            priority: 1,
            description: 'Schedule and timing information'
          },
          'basic': { 
            title: 'Basic Information', 
            icon: 'file-text', 
            priority: 2,
            description: 'Core note properties'
          },
          'color': { 
            title: 'Colors', 
            icon: 'palette', 
            priority: 3,
            description: 'Visual appearance and tags'
          },
          'image': { 
            title: 'Cover & Images', 
            icon: 'image', 
            priority: 4,
            description: 'Visual content and media'
          },
          'other': { 
            title: 'Additional Fields', 
            icon: 'list', 
            priority: 5,
            description: 'Custom metadata'
          }
        };
        
        const config = groupConfig[category];
        groups[category] = {
          title: config.title,
          icon: config.icon,
          priority: config.priority,
          description: config.description,
          fields: [],
          collapsed: collapsedState[category] !== undefined ? collapsedState[category] : false
        };
      }
      
      groups[category].fields.push(field);
    });
    
    return Object.values(groups).sort((a, b) => a.priority - b.priority);
  })();

  function toggleGroup(group: FieldGroup) {
    // Безопасная проверка наличия полей
    if (!group.fields.length) return;
    
    const category = categorizeField(group.fields[0]!); // non-null assertion - мы проверили length
    collapsedState[category] = !group.collapsed;
    saveCollapsedState();
    
    // Trigger reactivity
    fieldGroups = fieldGroups.map(g => 
      g.title === group.title 
        ? { ...g, collapsed: (collapsedState[category] as boolean) }
        : g
    );
  }
</script>

<ModalLayout title={$i18n.t("modals.note.edit.title")}>
  <ModalContent>
    <!-- v3.0.1: Note Title Section -->
    <div class="note-title-section">
      {#if isEditingTitle}
        <div class="title-edit-row">
          <input
            type="text"
            class="title-input"
            bind:value={editedTitle}
            on:keydown={handleTitleKeydown}
            autofocus
          />
          <button class="title-action-btn save" on:click={saveTitle} title="Сохранить">
            <Icon name="check" size="sm" />
          </button>
          <button class="title-action-btn cancel" on:click={cancelEditTitle} title="Отмена">
            <Icon name="x" size="sm" />
          </button>
        </div>
      {:else}
        <div class="title-display-row">
          <button 
            class="note-title-link"
            on:click={() => onOpenNote?.()}
            title="Открыть заметку"
            disabled={!onOpenNote}
          >
            <Icon name="file-text" size="sm" />
            <span class="note-title-text">{noteFileName}</span>
            {#if onOpenNote}
              <Icon name="external-link" size="xs" />
            {/if}
          </button>
          {#if onRenameNote}
            <button class="title-action-btn edit" on:click={startEditTitle} title="Переименовать">
              <Icon name="pencil" size="sm" />
            </button>
          {/if}
        </div>
      {/if}
    </div>
    
    {#if !editableFields.length}
      <Callout
        title={$i18n.t("modals.note.edit.no-editable-fields.title")}
        icon="info"
        variant="info"
      >
        <Typography variant="body">
          {$i18n.t("modals.note.edit.no-editable-fields.message")}
        </Typography>
      </Callout>
    {/if}
    
    <!-- Grouped Editable Fields -->
    {#each fieldGroups as group (group.title)}
      <div class="field-group">
        <button 
          class="group-header"
          on:click={() => toggleGroup(group)}
          aria-expanded={!group.collapsed}
          title={group.description}
        >
          <Icon name={group.icon} size="sm" />
          <span class="group-title">{group.title}</span>
          <span class="group-count">({group.fields.length})</span>
          <span class="collapse-indicator">
            <Icon 
              name={group.collapsed ? "chevron-right" : "chevron-down"} 
              size="sm"
            />
          </span>
        </button>
        
        {#if group.description && !group.collapsed}
          <div class="group-description">{group.description}</div>
        {/if}
        
        <div class="group-content" class:collapsed={group.collapsed}>
          {#each group.fields as field (field.name)}
            <SettingItem name={field.name}>
              <FieldControl
                {field}
                value={valuesSnapshot[field.name]}
                onChange={(value) => setValue(field.name, value)}
                suggestions={fieldSuggestions[field.name] ?? []}
              />
            </SettingItem>
          {/each}
        </div>
      </div>
    {/each}
    
    <!-- Readonly Fields (if any) -->
    {#if readonlyFields.length > 0}
      <div class="field-group readonly-group">
        <div class="group-header-static">
          <Icon name="lock" size="sm" />
          <span class="group-title">Read-only Fields</span>
          <span class="group-count">({readonlyFields.length})</span>
        </div>
        
        <div class="group-content">
          {#each readonlyFields as field (field.name)}
            <SettingItem name={field.name}>
              <FieldControl
                {field}
                value={valuesSnapshot[field.name]}
                onChange={(value) => setValue(field.name, value)}
                readonly={true}
              />
            </SettingItem>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- Save Button -->
    <div class="save-button-container">
      <button
        class="save-button"
        on:click={() => {
          onSave(record);
        }}
      >
        <Icon name="check" size="sm" />
        {editableFields.length
          ? $i18n.t("modals.note.edit.save")
          : $i18n.t("modals.note.edit.confirm")}
      </button>
    </div>
  </ModalContent>
</ModalLayout>

<style>
  /* v3.0.1: Note Title Section */
  .note-title-section {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: var(--background-secondary);
    border-radius: var(--radius-m);
    border: 1px solid var(--background-modifier-border);
  }
  
  .title-display-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .note-title-link {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-s);
    color: var(--text-normal);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }
  
  .note-title-link:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--interactive-accent);
  }
  
  .note-title-link:disabled {
    cursor: default;
  }
  
  .note-title-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .title-edit-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .title-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    border: 1px solid var(--interactive-accent);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
  }
  
  .title-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }
  
  .title-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-s);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .title-action-btn.edit {
    background: transparent;
    color: var(--text-muted);
  }
  
  .title-action-btn.edit:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .title-action-btn.save {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .title-action-btn.save:hover {
    opacity: 0.9;
  }
  
  .title-action-btn.cancel {
    background: var(--background-modifier-hover);
    color: var(--text-muted);
  }
  
  .title-action-btn.cancel:hover {
    color: var(--text-error);
  }

  .field-group {
    margin-bottom: 1rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-primary);
  }
  
  .group-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--background-secondary);
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
    color: var(--text-normal);
    border-radius: var(--radius-m) var(--radius-m) 0 0;
    will-change: background-color;
  }
  
  .group-header:hover {
    background: var(--background-modifier-hover);
  }
  
  .group-header:active {
    transform: scale(0.99);
  }
  
  .group-description {
    padding: 0.5rem 1rem;
    padding-top: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
    animation: fadeInSlide 0.2s ease-out;
  }
  
  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateY(-0.25rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .group-header-static {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--background-secondary);
    color: var(--text-muted);
  }
  
  .group-title {
    font-weight: 600;
    font-size: 0.875rem;
    flex: 1;
  }
  
  .group-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 400;
  }
  
  .collapse-indicator {
    display: flex;
    align-items: center;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .group-header:hover .collapse-indicator {
    transform: scale(1.1);
  }
  
  .group-content {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 0;
    height: auto;
    overflow: hidden;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                opacity 0.2s ease-out, 
                padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 2000px; /* Large enough for most content */
    opacity: 1;
    will-change: max-height, opacity;
  }
  
  /* Collapsed state */
  .field-group .group-content.collapsed {
    max-height: 0;
    opacity: 0;
    padding: 0 0.5rem;
    pointer-events: none; /* Prevent interaction with hidden fields */
  }
  
  /* Fix SettingItem alignment */
  .group-content :global(.setting-item) {
    padding: 0.5rem 0;
    border-bottom: none;
    transition: opacity 0.2s ease-out;
  }
  
  .group-content :global(.setting-item-info) {
    flex-shrink: 0;
    min-width: 6rem;
    max-width: 8rem;
  }
  
  .group-content :global(.setting-item-control) {
    flex: 1;
    min-width: 0;
    width: 100%;
  }
  
  .readonly-group {
    opacity: 0.7;
  }
  
  .save-button-container {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 0.0625rem solid var(--background-modifier-border);
  }
  
  .save-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius-m);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .save-button:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-0.0625rem);
    box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.15);
  }
  
  .save-button:active {
    transform: translateY(0);
  }
  
  /* Mobile responsive styles */
  @media (max-width: 48em) {
    .field-group {
      margin-bottom: 0.75rem;
      border-radius: var(--radius-s);
    }
    
    .group-header {
      padding: 0.625rem 0.75rem;
      font-size: 0.875rem;
      border-radius: var(--radius-s) var(--radius-s) 0 0;
    }
    
    .group-header-static {
      padding: 0.625rem 0.75rem;
      font-size: 0.875rem;
    }
    
    .group-title {
      font-size: 0.8125rem;
    }
    
    .group-description {
      padding: 0.375rem 0.75rem;
      padding-top: 0;
      font-size: 0.6875rem;
      line-height: 1.3;
    }
    
    .group-count {
      font-size: 0.6875rem;
    }
    
    .group-content {
      padding: 0.5rem;
      gap: 0.5rem;
      height: auto;
      min-height: 0;
    }
    
    /* Mobile: stack label and control vertically with consistent alignment */
    .group-content :global(.setting-item) {
      flex-direction: column;
      align-items: stretch;
      gap: 0.25rem;
      padding: 0.5rem 0;
    }
    
    .group-content :global(.setting-item-info) {
      min-width: 0;
      max-width: none;
      width: 100%;
      padding: 0;
      margin-bottom: 0.25rem;
    }
    
    .group-content :global(.setting-item-name) {
      font-weight: 600;
      font-size: 0.875rem;
    }
    
    .group-content :global(.setting-item-control) {
      width: 100%;
      padding: 0;
    }
    
    .save-button-container {
      margin-top: 1rem;
      padding-top: 0.75rem;
    }
    
    .save-button {
      padding: 0.75rem 1rem;
      font-size: 1rem;
      border-radius: var(--radius-s);
    }
  }
</style>
