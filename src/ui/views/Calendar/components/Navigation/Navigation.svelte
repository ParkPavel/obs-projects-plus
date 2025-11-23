<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { Button, IconButton } from "obsidian-svelte";

  export let onNext: () => void;
  export let onPrevious: () => void;
  export let onToday: () => void;
</script>

<div
  class="calendar-navigation"
  role="group"
  aria-label="Навигация по календарю"
>
  <IconButton
    icon="chevron-left"
    onClick={onPrevious}
    tooltip={$i18n.t("views.calendar.navigation.previous")}
  />
  <Button
    on:click={onToday}
    tooltip={$i18n.t("views.calendar.navigation.today")}
  >
    {$i18n.t("views.calendar.today")}
  </Button>
  <IconButton
    icon="chevron-right"
    onClick={onNext}
    tooltip={$i18n.t("views.calendar.navigation.next")}
  />
</div>

<style>
  .calendar-navigation {
    display: flex;
    gap: 4px;
    align-items: center;
  }
</style>
