<script lang="ts">
  import dayjs from "dayjs";
  import { i18n } from "src/lib/stores/i18n";

  export let onToday: () => void;
  
  // Format: "3 дек" for Russian, "3 Dec" for English
  $: todayFormatted = dayjs().format('D MMM');
</script>

<div
  class="calendar-navigation"
  role="navigation"
  aria-label={$i18n.t("views.calendar.navigation.aria-label")}
>
  <button
    class="today-button"
    on:click={onToday}
    title={$i18n.t("views.calendar.navigation.today-tooltip")}
  >
    <span class="today-label">{$i18n.t("views.calendar.today")}</span>
    <span class="today-separator">·</span>
    <span class="today-date">{todayFormatted}</span>
  </button>
</div>

<style>
  .calendar-navigation {
    display: flex;
    align-items: center;
  }

  .today-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-user-select: none;
    user-select: none;
    white-space: nowrap;
  }

  .today-button:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .today-button:active {
    transform: scale(0.97);
  }

  .today-label {
    font-weight: 600;
  }

  .today-separator {
    opacity: 0.5;
    font-weight: 400;
  }

  .today-date {
    font-weight: 400;
    opacity: 0.85;
  }

  .today-button:hover .today-separator,
  .today-button:hover .today-date {
    opacity: 1;
  }
</style>
