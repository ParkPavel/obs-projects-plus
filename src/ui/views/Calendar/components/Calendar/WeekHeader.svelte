<div
  role="row"
  aria-rowindex="1"
  class="calendar-week-header"
>
  <slot />
</div>

<style>
  .calendar-week-header {
    display: flex;
    background: transparent;
    flex-shrink: 0;
    overflow: hidden; /* Prevent subpixel artifacts */
  }
</style>
