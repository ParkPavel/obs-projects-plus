<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  
  export let selectedCount: number = 0;
  export let hasCollisions: boolean = false;
  export let collisionCount: number = 0;
  
  const dispatch = createEventDispatcher<{
    cancel: void;
    confirm: void;
  }>();
  
  function handleCancel() {
    dispatch("cancel");
  }
  
  function handleConfirm() {
    dispatch("confirm");
  }
</script>

<footer class="duplicate-footer">
  <div class="info-section">
    <span class="selected-count">
      {$i18n.t("views.calendar.duplicate.selected", { count: selectedCount }) || `Выбрано: ${selectedCount}`}
    </span>
    
    {#if hasCollisions}
      <span class="collision-warning">
        ⚠️ {collisionCount} {collisionCount === 1 ? 'наложение' : 'наложений'}
      </span>
    {/if}
  </div>
  
  <div class="button-section">
    <button class="cancel-button" on:click={handleCancel}>
      {$i18n.t("views.calendar.duplicate.cancel") || "Отмена"}
    </button>
    <button 
      class="confirm-button" 
      on:click={handleConfirm}
      disabled={selectedCount === 0}
    >
      {$i18n.t("views.calendar.duplicate.confirm") || "Дублировать"}
    </button>
  </div>
</footer>

<style>
  .duplicate-footer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--background-modifier-border);
    margin-top: 0.75rem;
  }
  
  .info-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .selected-count {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  
  .collision-warning {
    font-size: 0.875rem;
    color: var(--text-warning);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .button-section {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  
  button {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }
  
  .cancel-button {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .cancel-button:hover {
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
</style>
