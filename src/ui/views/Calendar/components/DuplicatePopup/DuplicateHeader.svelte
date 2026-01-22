<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  
  export let selectedCount: number = 0;
  export let hasCollisions: boolean = false;
  export let collisionCount: number = 0;
  export let canConfirm: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    confirm: void;
    today: void;
  }>();

  function handleClose() {
    dispatch("close");
  }
  
  function handleConfirm() {
    dispatch("confirm");
  }
  
  function handleToday() {
    dispatch("today");
  }
</script>

<header class="duplicate-header">
  <div class="header-left">
    <button 
      class="today-button action-button" 
      on:click={handleToday}
      aria-label={$i18n.t("views.calendar.duplicate.today") || "Сегодня"}
      title={$i18n.t("views.calendar.duplicate.today") || "Сегодня"}
    >
      <Icon name="calendar-days" size="sm" />
      <span class="button-text">{$i18n.t("views.calendar.duplicate.today") || "Сегодня"}</span>
    </button>
  </div>
  
  <div class="header-center">
    <h3>{$i18n.t("views.calendar.duplicate.title") || "Выберите даты для дублирования"}</h3>
    
    {#if selectedCount > 0}
      <div class="status-info">
        <span class="selected-badge">{selectedCount}</span>
        {#if hasCollisions}
          <span class="collision-badge">⚠️ {collisionCount}</span>
        {/if}
      </div>
    {/if}
  </div>
  
  <div class="header-right">
    <button 
      class="confirm-button action-button" 
      on:click={handleConfirm}
      disabled={!canConfirm}
      aria-label={$i18n.t("views.calendar.duplicate.confirm") || "Дублировать"}
      title={$i18n.t("views.calendar.duplicate.confirm") || "Дублировать"}
    >
      <Icon name="check" size="sm" />
      <span class="button-text">{$i18n.t("views.calendar.duplicate.confirm") || "Confirm"}</span>
    </button>
    
    <button 
      class="close-button" 
      on:click={handleClose} 
      aria-label={$i18n.t("views.calendar.duplicate.cancel") || "Закрыть"}
      title={$i18n.t("views.calendar.duplicate.cancel") || "Закрыть"}
    >
      <Icon name="x" size="md" />
    </button>
  </div>
</header>

<style>
  .duplicate-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    gap: 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  
  .header-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
  }

  .header-center h3 {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  
  .status-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }
  
  .selected-badge {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    padding: 0.125rem 0.5rem;
    border-radius: 1rem;
    font-weight: 600;
    font-size: 0.75rem;
  }
  
  .collision-badge {
    color: var(--text-warning);
    font-size: 0.75rem;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  
  .today-button {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .today-button:hover {
    background: var(--background-modifier-border);
  }
  
  .confirm-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .confirm-button:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }
  
  .confirm-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    min-width: 2rem;
    min-height: 2rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }

  .close-button:hover {
    background: var(--background-modifier-hover);
  }
  
  /* Mobile optimization */
  @media (max-width: 40rem) { /* 640px at 16px base */
    .duplicate-header {
      padding: 0.5rem;
      gap: 0.5rem;
    }
    
    .button-text {
      display: none; /* Hide text on small screens */
    }
    
    .action-button {
      padding: 0.5rem;
      min-width: 2.5rem;
      min-height: 2.5rem;
      justify-content: center;
    }
    
    .header-center h3 {
      font-size: 0.9rem;
    }
    
    .status-info {
      font-size: 0.7rem;
    }
  }
  
  /* Very small screens */
  @media (max-width: 25rem) { /* 400px at 16px base */
    .header-center h3 {
      font-size: 0.85rem;
    }
    
    .collision-badge {
      font-size: 0.65rem;
    }
  }
</style>
