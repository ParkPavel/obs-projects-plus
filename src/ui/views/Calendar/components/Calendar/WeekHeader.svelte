<div
  role="row"
  aria-rowindex="1"
  class="calendar-week-header"
>
  <slot />
</div>

<style>
  .calendar-week-header {
    /* v9.2: CSS Grid — identical column tracks as multiday-lane & calendar-week */
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: transparent;
    flex-shrink: 0;
    overflow: hidden; /* Prevent subpixel artifacts */
  }
</style>
