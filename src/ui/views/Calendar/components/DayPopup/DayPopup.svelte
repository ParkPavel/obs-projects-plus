<script lang="ts">
  import dayjs from "dayjs";
  import { createEventDispatcher } from "svelte";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";
  import RecordItem from "./RecordItem.svelte";
  import DuplicatePopup from "./DuplicatePopup.svelte";

  export let date: dayjs.Dayjs;
  export let records: DataRecord[];
  export let checkField: string | undefined;
  export let visible: boolean = false;
  
  const dispatch = createEventDispatcher<{
    close: void;
    recordClick: DataRecord;
    recordSettings: DataRecord;
    recordDelete: DataRecord;
    recordDuplicate: { record: DataRecord; targetDates: dayjs.Dayjs[] };
    recordTimeChange: { record: DataRecord; newTime: string };
    recordCheck: { record: DataRecord; checked: boolean };
    createNote: dayjs.Dayjs;
  }>();

  let showDuplicatePopup = false;
  let duplicateRecord: DataRecord | null = null;

  $: formattedDate = date.format('D MMMM YYYY');
  $: dayOfWeek = date.format('dddd');
  $: isToday = date.isSame(dayjs(), 'day');

  function handleClose() {
    visible = false;
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleRecordClick(record: DataRecord) {
    dispatch('recordClick', record);
  }

  function handleRecordSettings(record: DataRecord) {
    dispatch('recordSettings', record);
  }

  function handleRecordDelete(record: DataRecord) {
    dispatch('recordDelete', record);
  }

  function handleRecordDuplicate(record: DataRecord) {
    duplicateRecord = record;
    showDuplicatePopup = true;
  }

  function handleDuplicateConfirm(targetDates: dayjs.Dayjs[]) {
    if (duplicateRecord) {
      dispatch('recordDuplicate', { record: duplicateRecord, targetDates });
    }
    showDuplicatePopup = false;
    duplicateRecord = null;
  }

  function handleRecordTimeChange(record: DataRecord, newTime: string) {
    dispatch('recordTimeChange', { record, newTime });
  }

  function handleRecordCheck(record: DataRecord, checked: boolean) {
    dispatch('recordCheck', { record, checked });
  }

  function handleCreateNote() {
    dispatch('createNote', date);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <div class="day-popup-backdrop" on:click={handleBackdropClick} on:keydown={handleBackdropKeydown} role="presentation">
    <div class="day-popup" role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <header class="popup-header">
        <div class="date-info">
          <h2 id="popup-title" class="date-title" class:today={isToday}>
            {formattedDate}
          </h2>
          <span class="day-of-week">{dayOfWeek}</span>
        </div>
        <button class="close-button" on:click={handleClose} aria-label="Close">
          <Icon name="x" size="lg" />
        </button>
      </header>

      <div class="popup-content">
        {#if records.length === 0}
          <div class="empty-state">
            <Icon name="calendar" size="lg" />
            <p>{$i18n.t("views.calendar.no-events")}</p>
          </div>
        {:else}
          <div class="records-list">
            {#each records as record (record.id)}
              <RecordItem
                {record}
                {checkField}
                on:click={() => handleRecordClick(record)}
                on:settings={() => handleRecordSettings(record)}
                on:delete={() => handleRecordDelete(record)}
                on:duplicate={() => handleRecordDuplicate(record)}
                on:timeChange={({ detail }) => handleRecordTimeChange(record, detail)}
                on:check={({ detail }) => handleRecordCheck(record, detail)}
              />
            {/each}
          </div>
        {/if}
      </div>

      <footer class="popup-footer">
        <button class="create-button" on:click={handleCreateNote}>
          <Icon name="plus" size="sm" />
          {$i18n.t("views.calendar.new-note")}
        </button>
      </footer>
    </div>
  </div>
{/if}

{#if showDuplicatePopup && duplicateRecord}
  <DuplicatePopup
    visible={showDuplicatePopup}
    currentDate={date}
    on:confirm={({ detail }) => handleDuplicateConfirm(detail)}
    on:close={() => { showDuplicatePopup = false; duplicateRecord = null; }}
  />
{/if}

<style>
  .day-popup-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .day-popup {
    background: var(--background-primary);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 500px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  }

  @keyframes slideUp {
    from { 
      transform: translateY(100%);
      opacity: 0;
    }
    to { 
      transform: translateY(0);
      opacity: 1;
    }
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .date-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .date-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal);
  }

  .date-title.today {
    color: var(--interactive-accent);
  }

  .day-of-week {
    font-size: 13px;
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .popup-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    -webkit-overflow-scrolling: touch;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--text-muted);
    gap: 12px;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .records-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .popup-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .create-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-radius: 10px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .create-button:hover {
    filter: brightness(1.1);
  }

  .create-button:active {
    transform: scale(0.98);
  }

  @media (min-width: 481px) {
    .day-popup-backdrop {
      align-items: center;
    }

    .day-popup {
      border-radius: 16px;
      max-height: 70vh;
    }
  }
</style>
