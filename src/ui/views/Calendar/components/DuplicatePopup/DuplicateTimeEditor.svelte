<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import dayjs from "dayjs";
  import { i18n } from "src/lib/stores/i18n";
  
  export let startTime: dayjs.Dayjs;
  export let endTime: dayjs.Dayjs;
  export let originalStartTime: dayjs.Dayjs;
  export let originalEndTime: dayjs.Dayjs;
  
  const dispatch = createEventDispatcher<{
    change: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs };
    reset: void;
  }>();
  
  $: duration = endTime.diff(startTime, 'minute');
  $: durationFormatted = formatDuration(duration);
  $: isModified = !startTime.isSame(originalStartTime, 'minute') || !endTime.isSame(originalEndTime, 'minute');
  
  function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }
  
  function handleStartChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const [h, m] = input.value.split(':').map(Number);
    if (h === undefined || m === undefined) return;
    const newStart = startTime.hour(h).minute(m).second(0);
    dispatch('change', { startTime: newStart, endTime });
  }
  
  function handleEndChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const [h, m] = input.value.split(':').map(Number);
    if (h === undefined || m === undefined) return;
    const newEnd = endTime.hour(h).minute(m).second(0);
    dispatch('change', { startTime, endTime: newEnd });
  }
  
  function handleReset() {
    dispatch('reset');
  }
</script>

<div class="time-editor">
  <div class="time-label">{$i18n.t("views.calendar.duplicate.time") || "Время"}:</div>
  
  <div class="time-inputs">
    <input 
      type="time" 
      value={startTime.format('HH:mm')}
      on:change={handleStartChange}
      class="time-input"
    />
    <span class="time-separator">—</span>
    <input 
      type="time" 
      value={endTime.format('HH:mm')}
      on:change={handleEndChange}
      class="time-input"
    />
    <span class="duration">({durationFormatted})</span>
  </div>
  
  {#if isModified}
    <button 
      class="reset-btn" 
      on:click={handleReset} 
      title="Reset to original"
      aria-label="Reset to original time"
    >
      ↺
    </button>
  {/if}
</div>

<style>
  .time-editor {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--background-secondary);
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
  }
  
  .time-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    min-width: 4rem;
    flex-shrink: 0;
  }
  
  .time-inputs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }
  
  .time-input {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.25rem;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: inherit;
    font-size: 0.875rem;
    min-width: 0;
    flex: 0 0 auto;
  }
  
  .time-separator {
    color: var(--text-muted);
    flex-shrink: 0;
  }
  
  .duration {
    font-size: 0.75rem;
    color: var(--text-faint);
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .reset-btn {
    padding: 0.25rem 0.5rem;
    background: none;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.25rem;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  
  .reset-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-muted);
  }
  
  /* Mobile adjustments */
  @media (max-width: 30rem) { /* 480px at 16px base */
    .time-editor {
      flex-wrap: wrap;
    }
    
    .time-label {
      min-width: auto;
      width: 100%;
    }
    
    .time-inputs {
      flex: 1 1 auto;
    }
  }
</style>
