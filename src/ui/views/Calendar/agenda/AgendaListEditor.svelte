<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import { i18n } from 'src/lib/stores/i18n';
  import type { DataField, DataRecord } from 'src/lib/dataframe/dataframe';
  import type { AgendaCustomList, AgendaIcon, AgendaFilterGroup, AgendaFilterMode } from 'src/settings/v3/settings';
  import { ColorPicker } from 'src/ui/components/ColorPicker';
  import AgendaFilterEditor from './AgendaFilterEditor.svelte';
  import AdvancedFilterEditor from './AdvancedFilterEditor.svelte';
  import AgendaIconPicker from './AgendaIconPicker.svelte';
  
  // Generate unique ID
  function generateId(): string {
    return `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // i18n helper
  const t = (key: string) => $i18n.t(`views.calendar.agenda.custom.list-editor.${key}`);
  
  const dispatch = createEventDispatcher<{
    save: AgendaCustomList;
    cancel: void;
  }>();
  
  export let list: AgendaCustomList | null = null;
  export let fields: DataField[] = [];
  export let records: DataRecord[] = [];
  export let existingLists: AgendaCustomList[] = [];
  
  let showIconPicker = false;
  let showColorPicker = false;
  
  // Migrate old list format to new
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy migration: old list format shape is unknown
  function migrateOldListFormat(oldList: any): AgendaFilterGroup {
    if (oldList.filterGroup) {
      return oldList.filterGroup;
    }
    
    // Old format with filters array
    if (oldList.filters && Array.isArray(oldList.filters)) {
      return {
        id: generateId(),
        conjunction: 'AND',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy filter objects have unknown shape
        filters: oldList.filters.map((f: any) => ({
          ...f,
          // Remove conjunction from filter (moved to group)
          ...(f.conjunction ? {} : {})
        })),
        groups: [],
      };
    }
    
    // Empty group
    return {
      id: generateId(),
      conjunction: 'AND',
      filters: [],
      groups: [],
    };
  }
  
  // Initialize form data
  let formData: {
    name: string;
    icon: AgendaIcon;
    filterMode: AgendaFilterMode;
    filterGroup: AgendaFilterGroup;
    filterFormula: string;
    color?: string;
  } = list ? {
    name: list.name,
    icon: list.icon,
    filterMode: list.filterMode || 'visual',
    filterGroup: list.filterGroup || migrateOldListFormat(list),
    filterFormula: list.filterFormula || '',
    ...(list.color ? { color: list.color } : {}),
  } : {
    name: '',
    icon: { type: 'lucide', value: 'clipboard-list' },
    filterMode: 'visual',
    filterGroup: {
      id: generateId(),
      conjunction: 'AND',
      filters: [],
      groups: [],
    },
    filterFormula: '',
  };
  
  let nameError = '';
  
  $: {
    // Validate name
    if (formData.name.trim() === '') {
      nameError = t('name-required');
    } else if (existingLists.some(l => 
      l.id !== list?.id && 
      l.name.toLowerCase() === formData.name.trim().toLowerCase()
    )) {
      nameError = t('name-exists');
    } else {
      nameError = '';
    }
  }
  
  $: isValid = !nameError && formData.name.trim() !== '';
  
  function handleIconSelect(icon: AgendaIcon) {
    formData.icon = icon;
    showIconPicker = false;
  }
  
  function handleColorChange(e: CustomEvent<string>) {
    formData.color = e.detail;
  }
  
  function clearColor() {
    delete formData.color;
    formData = formData; // trigger reactivity
  }
  
  function handleSave() {
    if (!isValid) {
      console.warn('[AgendaListEditor] Cannot save - validation failed:', nameError);
      return;
    }
    
    const savedList: AgendaCustomList = {
      id: list?.id ?? generateId(),
      name: formData.name.trim(),
      icon: formData.icon,
      filterMode: formData.filterMode,
      ...(formData.filterMode === 'visual' 
        ? { filterGroup: formData.filterGroup }
        : { filterFormula: formData.filterFormula || '' }
      ),
      order: list?.order ?? existingLists.length,
      collapsed: list?.collapsed ?? false,
      ...(formData.color ? { color: formData.color } : {}),
    };
    
    console.log('[AgendaListEditor] Saving list:', savedList);
    dispatch('save', savedList);
  }
  
  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="agenda-list-editor">
  <!-- Header -->
  <header class="editor-header">
    <h3 class="editor-title">{list ? t('title-edit') : t('title-new')}</h3>
    <button class="editor-close" on:click={handleCancel} aria-label="Close">
      <Icon name="x" size="sm" />
    </button>
  </header>
  
  <!-- Content -->
  <div class="editor-content">
    <!-- Name Field -->
    <div class="field-group">
      <label class="field-label" for="list-name">{t('name-label')}</label>
      <input
        id="list-name"
        type="text"
        class="field-input"
        class:has-error={nameError}
        bind:value={formData.name}
        placeholder={t('name-placeholder')}
      />
      {#if nameError}
        <span class="field-error">{nameError}</span>
      {/if}
    </div>
    
    <!-- Icon Field -->
    <div class="field-group">
      <span class="field-label" id="icon-label">{t('icon-label')}</span>
      <button 
        class="icon-trigger"
        on:click={() => showIconPicker = !showIconPicker}
        aria-expanded={showIconPicker}
        aria-labelledby="icon-label"
      >
        <span class="icon-preview">
          {#if formData.icon.type === 'emoji'}
            <span class="icon-emoji">{formData.icon.value}</span>
          {:else}
            <Icon name={formData.icon.value} size="md" />
          {/if}
        </span>
        <span class="icon-label">{t('change-icon')}</span>
        <Icon name={showIconPicker ? 'chevron-up' : 'chevron-down'} size="xs" />
      </button>
      
      {#if showIconPicker}
        <div class="icon-picker-wrapper">
          <AgendaIconPicker 
            currentIcon={formData.icon}
            on:select={(e) => handleIconSelect(e.detail)}
            on:close={() => showIconPicker = false}
          />
        </div>
      {/if}
    </div>
    
    <!-- Color Field -->
    <div class="field-group">
      <div class="field-label-row">
        <span class="field-label" id="color-label">{t('color-label')}</span>
        {#if formData.color}
          <button class="color-clear" on:click={clearColor} aria-label="Clear color">
            <Icon name="x" size="xs" />
            <span>Clear</span>
          </button>
        {/if}
      </div>
      
      <button 
        class="color-trigger"
        on:click={() => showColorPicker = !showColorPicker}
        aria-expanded={showColorPicker}
        aria-labelledby="color-label"
      >
        <span 
          class="color-swatch" 
          style:background-color={formData.color ?? 'var(--interactive-accent)'}
        />
        <span class="color-value">{formData.color ?? 'Default accent'}</span>
        <Icon name={showColorPicker ? 'chevron-up' : 'chevron-down'} size="xs" />
      </button>
      
      {#if showColorPicker}
        <div class="color-picker-wrapper">
          <ColorPicker 
            value={formData.color ?? '#7c3aed'}
            on:change={handleColorChange}
          />
        </div>
      {/if}
      
      <!-- Color Preview -->
      {#if formData.color}
        <div class="color-preview" style:--list-color={formData.color}>
          <span class="preview-label">{$i18n.t('views.calendar.agenda.custom.list-editor.preview')}</span>
          <div class="preview-card">
            {#if formData.icon.type === 'emoji'}
              <span class="preview-icon">{formData.icon.value}</span>
            {:else}
              <Icon name={formData.icon.value} size="sm" />
            {/if}
            <span class="preview-name">{formData.name || t('name-placeholder')}</span>
            <span class="preview-count">3</span>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Filters Section -->
    <div class="field-group field-group--filters">
      <div class="field-label-row">
        <span class="field-label" id="filters-label">{t('filters-label')}</span>
        
        <!-- Filter Mode Toggle -->
        <div class="filter-mode-toggle">
          <button 
            class="mode-btn"
            class:active={formData.filterMode === 'visual'}
            on:click={() => formData.filterMode = 'visual'}
            title="Visual mode - drag-and-drop filter builder"
          >
            <Icon name="sliders-horizontal" size="xs" />
            <span>Visual</span>
          </button>
          <button 
            class="mode-btn"
            class:active={formData.filterMode === 'advanced'}
            on:click={() => formData.filterMode = 'advanced'}
            title="Advanced mode - formula-based filtering"
          >
            <Icon name="code" size="xs" />
            <span>Advanced</span>
          </button>
        </div>
      </div>
      
      <p class="field-hint">
        {formData.filterMode === 'visual' 
          ? $i18n.t('views.calendar.agenda.custom.list-editor.filters-hint') 
          : $i18n.t('views.calendar.agenda.custom.list-editor.formula-hint')}
      </p>
      
      {#if formData.filterMode === 'visual'}
        <AgendaFilterEditor 
          {fields}
          {records}
          filterGroup={formData.filterGroup}
          on:change={(e) => formData.filterGroup = e.detail}
        />
      {:else}
        <AdvancedFilterEditor
          {fields}
          bind:formula={formData.filterFormula}
        />
      {/if}
    </div>
  </div>
  
  <!-- Footer -->
  <footer class="editor-footer">
    <button class="btn btn--secondary" on:click={handleCancel}>
      {t('cancel')}
    </button>
    <button 
      class="btn btn--primary" 
      on:click={handleSave}
      disabled={!isValid}
    >
      {list ? t('save') : t('create')}
    </button>
  </footer>
</div>

<style>
  /* ============================================
   * Agenda List Editor - Adaptive "Matryoshka" Design
   * Follows plugin design system standards
   * ============================================ */
  
  .agenda-list-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 85vh;
    background: var(--background-primary);
    border-radius: var(--ppp-radius-lg, 0.5rem);
    overflow: hidden;
  }
  
  /* === Header === */
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--ppp-spacing-md, 1rem) var(--ppp-spacing-lg, 1.25rem);
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
  }
  
  .editor-title {
    margin: 0;
    font-size: var(--ppp-font-size-lg, 1.125rem);
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .editor-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: none;
    border-radius: var(--ppp-radius-md, 0.375rem);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .editor-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  /* === Content === */
  .editor-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--ppp-spacing-lg, 1.25rem);
    display: flex;
    flex-direction: column;
    gap: var(--ppp-spacing-lg, 1.25rem);
  }
  
  /* === Field Groups === */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: var(--ppp-spacing-xs, 0.375rem);
  }
  
  .field-group--filters {
    padding-top: var(--ppp-spacing-md, 1rem);
    border-top: 1px solid var(--background-modifier-border);
    /* Allow fixed-positioned filter dropdowns to escape scroll container */
    overflow: visible;
  }
  
  .field-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ppp-spacing-sm, 0.5rem);
  }
  
  .field-label {
    font-size: var(--ppp-font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--text-normal);
  }
  
  /* Filter Mode Toggle */
  .filter-mode-toggle {
    display: flex;
    gap: 0;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.375rem);
    overflow: hidden;
  }
  
  .mode-btn {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
    padding: var(--size-4-2) var(--size-4-3);
    border: none;
    background: var(--background-primary);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .mode-btn:first-child {
    border-right: 0.0625rem solid var(--background-modifier-border);
  }
  
  .mode-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .mode-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .field-hint {
    margin: 0;
    font-size: var(--ppp-font-size-xs, 0.75rem);
    color: var(--text-muted);
    line-height: 1.4;
  }
  
  .field-input {
    width: 100%;
    padding: var(--ppp-spacing-sm, 0.5rem) var(--ppp-spacing-md, 0.75rem);
    min-height: 2.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.375rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--ppp-font-size-sm, 0.875rem);
    transition: border-color 0.15s ease;
  }
  
  .field-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  
  .field-input.has-error {
    border-color: var(--text-error);
  }
  
  .field-error {
    font-size: var(--ppp-font-size-xs, 0.75rem);
    color: var(--text-error);
  }
  
  /* === Icon Trigger === */
  .icon-trigger {
    display: flex;
    align-items: center;
    gap: var(--ppp-spacing-sm, 0.5rem);
    width: 100%;
    padding: var(--ppp-spacing-sm, 0.5rem) var(--ppp-spacing-md, 0.75rem);
    min-height: 2.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.375rem);
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: var(--ppp-font-size-sm, 0.875rem);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .icon-trigger:hover {
    background: var(--background-modifier-hover);
  }
  
  .icon-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
  }
  
  .icon-emoji {
    font-size: 1.25rem;
    line-height: 1;
  }
  
  .icon-label {
    flex: 1;
    text-align: left;
  }
  
  .icon-picker-wrapper {
    margin-top: var(--ppp-spacing-xs, 0.375rem);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.375rem);
    overflow: hidden;
    max-height: 16rem;
    overflow-y: auto;
  }
  
  /* === Color Trigger === */
  .color-trigger {
    display: flex;
    align-items: center;
    gap: var(--ppp-spacing-sm, 0.5rem);
    width: 100%;
    padding: var(--ppp-spacing-sm, 0.5rem) var(--ppp-spacing-md, 0.75rem);
    min-height: 2.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.375rem);
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: var(--ppp-font-size-sm, 0.875rem);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .color-trigger:hover {
    background: var(--background-modifier-hover);
  }
  
  .color-swatch {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: var(--ppp-radius-sm, 0.25rem);
    border: 1px solid var(--background-modifier-border);
  }
  
  .color-value {
    flex: 1;
    text-align: left;
    font-family: var(--font-monospace);
    font-size: var(--ppp-font-size-xs, 0.75rem);
  }
  
  .color-clear {
    display: inline-flex;
    align-items: center;
    gap: var(--ppp-spacing-2xs, 0.25rem);
    padding: var(--ppp-spacing-2xs, 0.25rem) var(--ppp-spacing-xs, 0.375rem);
    border: none;
    border-radius: var(--ppp-radius-sm, 0.25rem);
    background: var(--background-modifier-error);
    color: var(--text-error);
    font-size: var(--ppp-font-size-xs, 0.75rem);
    cursor: pointer;
    transition: opacity 0.15s ease;
  }
  
  .color-clear:hover {
    opacity: 0.8;
  }
  
  .color-picker-wrapper {
    margin-top: var(--ppp-spacing-xs, 0.375rem);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.375rem);
    overflow: hidden;
  }
  
  /* === Color Preview === */
  .color-preview {
    margin-top: var(--ppp-spacing-sm, 0.5rem);
    padding: var(--ppp-spacing-sm, 0.5rem);
    border: 1px solid var(--background-modifier-border);
    border-left: 4px solid var(--list-color);
    border-radius: var(--ppp-radius-md, 0.375rem);
    background: var(--background-secondary);
  }
  
  .preview-label {
    display: block;
    margin-bottom: var(--ppp-spacing-xs, 0.375rem);
    font-size: var(--ppp-font-size-2xs, 0.6875rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }
  
  .preview-card {
    display: flex;
    align-items: center;
    gap: var(--ppp-spacing-sm, 0.5rem);
    padding: var(--ppp-spacing-xs, 0.375rem) var(--ppp-spacing-sm, 0.5rem);
    border-radius: var(--ppp-radius-sm, 0.25rem);
    background: var(--background-primary);
  }
  
  .preview-icon {
    font-size: 1rem;
    line-height: 1;
  }
  
  .preview-name {
    flex: 1;
    font-size: var(--ppp-font-size-sm, 0.875rem);
    font-weight: 500;
    color: var(--text-normal);
  }
  
  .preview-count {
    padding: 0.125rem 0.5rem;
    border-radius: var(--ppp-radius-sm, 0.25rem);
    background: var(--background-modifier-hover);
    font-size: var(--ppp-font-size-xs, 0.75rem);
    font-weight: 600;
    color: var(--text-muted);
  }
  
  /* === Footer === */
  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--ppp-spacing-sm, 0.5rem);
    padding: var(--ppp-spacing-md, 1rem) var(--ppp-spacing-lg, 1.25rem);
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--ppp-spacing-xs, 0.375rem);
    padding: var(--ppp-spacing-sm, 0.5rem) var(--ppp-spacing-lg, 1.25rem);
    min-height: 2.5rem;
    border: none;
    border-radius: var(--ppp-radius-md, 0.375rem);
    font-size: var(--ppp-font-size-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .btn--secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .btn--secondary:hover {
    background: var(--background-modifier-border);
  }
  
  .btn--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .btn--primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  
  .btn--primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* === Mobile Adaptivity === */
  @media (max-width: 600px) {
    .agenda-list-editor {
      max-height: 100vh;
      border-radius: 0;
    }
    
    .editor-header {
      padding: var(--ppp-spacing-sm, 0.5rem) var(--ppp-spacing-md, 0.75rem);
    }
    
    .editor-title {
      font-size: var(--ppp-font-size-md, 1rem);
    }
    
    .editor-content {
      padding: var(--ppp-spacing-md, 0.75rem);
      gap: var(--ppp-spacing-md, 0.75rem);
    }
    
    .editor-footer {
      flex-direction: column;
      padding: var(--ppp-spacing-sm, 0.5rem) var(--ppp-spacing-md, 0.75rem);
    }
    
    .btn {
      width: 100%;
      min-height: 2.75rem;
    }
    
    .icon-trigger,
    .color-trigger,
    .field-input {
      min-height: 2.75rem;
    }
  }
  
  /* === Touch targets for mobile === */
  @media (pointer: coarse) {
    .editor-close,
    .btn,
    .icon-trigger,
    .color-trigger,
    .color-clear {
      min-height: 2.75rem;
    }
  }
</style>
