<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";

  export let record: DataRecord;
  export let checkField: string | undefined;

  const dispatch = createEventDispatcher<{
    click: void;
    settings: void;
    delete: void;
    duplicate: void;
    timeChange: string;
    check: boolean;
  }>();

  let showActions = false;
  let tapTimeout: ReturnType<typeof setTimeout> | null = null;
  let tapCount = 0;

  $: recordName = record.id.split('/').pop()?.replace('.md', '') || 'Untitled';
  $: isChecked = checkField ? !!record.values[checkField] : false;

  function handleTap(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    
    tapCount++;
    
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }
    
    tapTimeout = setTimeout(() => {
      if (tapCount === 1) {
        // Single tap - open note
        dispatch('click');
      } else if (tapCount >= 2) {
        // Double tap - open settings
        dispatch('settings');
      }
      tapCount = 0;
    }, 300);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dispatch('click');
    }
  }

  function toggleActions() {
    showActions = !showActions;
  }

  function handleCheck() {
    dispatch('check', !isChecked);
  }
</script>

<div class="record-item" on:click={handleTap} on:keydown={handleKeydown} role="button" tabindex="0">
  <div class="record-main">
    {#if checkField}
      <button 
        class="check-button" 
        class:checked={isChecked}
        on:click|stopPropagation={handleCheck}
        aria-label={isChecked ? "Uncheck" : "Check"}
      >
        {#if isChecked}
          <Icon name="check" size="sm" />
        {/if}
      </button>
    {/if}
    
    <span class="record-name" class:checked={isChecked}>{recordName}</span>
    
    <button 
      class="actions-toggle" 
      on:click|stopPropagation={toggleActions}
      aria-label="Actions"
    >
      <Icon name="more-horizontal" size="sm" />
    </button>
  </div>

  {#if showActions}
    <div class="record-actions">
      <button class="action-button" on:click|stopPropagation={() => dispatch('settings')}>
        <Icon name="settings" size="sm" />
        <span>{$i18n.t("views.calendar.record.settings")}</span>
      </button>
      
      <button class="action-button" on:click|stopPropagation={() => dispatch('duplicate')}>
        <Icon name="copy" size="sm" />
        <span>{$i18n.t("views.calendar.record.duplicate")}</span>
      </button>
      
      <button class="action-button danger" on:click|stopPropagation={() => dispatch('delete')}>
        <Icon name="trash-2" size="sm" />
        <span>{$i18n.t("views.calendar.record.delete")}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .record-item {
    background: var(--background-secondary);
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .record-item:active {
    background: var(--background-modifier-hover);
    transform: scale(0.98);
  }

  .record-main {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .check-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-on-accent);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .check-button.checked {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .record-name {
    flex: 1;
    font-size: 15px;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .record-name.checked {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .actions-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .actions-toggle:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .record-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-normal);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .action-button:hover {
    background: var(--background-modifier-hover);
  }

  .action-button:active {
    transform: scale(0.98);
  }

  .action-button.danger {
    color: var(--text-error);
  }

  .action-button.danger:hover {
    background: rgba(var(--color-red-rgb), 0.1);
  }
</style>
