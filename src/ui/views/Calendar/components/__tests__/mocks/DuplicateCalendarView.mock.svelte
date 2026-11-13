<script>
  // Stand-in for the month scroller inside the duplicate window: the window's
  // layer and focus are under test, not the grid, which needs a whole calendar
  // frame. It keeps the props and the one method the window calls on it.
  export let firstDayOfWeek = 1;
  export let sourceDate = undefined;
  export let displayMode = "bars";
  export let startHour = 7;
  export let endHour = 21;
  export function scrollToDate() {}
</script>

<div data-testid="duplicate-calendar-stub" data-mode={displayMode} data-first-day={firstDayOfWeek} data-source={sourceDate} data-hours={`${startHour}-${endHour}`}></div>
