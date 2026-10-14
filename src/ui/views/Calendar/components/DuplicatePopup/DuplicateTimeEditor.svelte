<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import dayjs from "dayjs";
  import { i18n } from "src/lib/stores/i18n";
  import DateField from "src/ui/components/fields/DateField.svelte";
  
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
  
  // Only the clock is taken from the field: the duplicate's day is chosen on the grid.
  function handleStartChange(e: CustomEvent<Date | null>) {
    if (!e.detail) return;
    const newStart = startTime.hour(e.detail.getHours()).minute(e.detail.getMinutes()).second(0);
    dispatch('change', { startTime: newStart, endTime });
  }
  
  function handleEndChange(e: CustomEvent<Date | null>) {
    if (!e.detail) return;
    const newEnd = endTime.hour(e.detail.getHours()).minute(e.detail.getMinutes()).second(0);
    dispatch('change', { startTime, endTime: newEnd });
  }
  
  function handleReset() {
    dispatch('reset');
  }
</script>

<div class="time-editor">
  <div class="time-label">{$i18n.t("views.calendar.duplicate.time") || "Время"}:</div>
  
  <div class="time-inputs">
    <div class="time-field">
      <DateField withTime value={startTime.toDate()} on:change={handleStartChange} />
    </div>
    <span class="time-separator">—</span>
    <div class="time-field">
      <DateField withTime value={endTime.toDate()} on:change={handleEndChange} />
    </div>
    <span class="duration">({durationFormatted})</span>
  </div>
  
  {#if isModified}
    <button 
      class="reset-btn" 
      on:click={handleReset} 
      title={$i18n.t("views.calendar.reset-to-original")}
      aria-label={$i18n.t("views.calendar.reset-to-original-time")}
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
  
  .time-field {
    flex: 1 1 0;
    min-width: 0;
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
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-sm);
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
  @media (max-width: 30rem) { /* 480 at 16 base */
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
