<script lang="ts">
  import dayjs from "dayjs";
  
  export let month: dayjs.Dayjs;
  
  // Use locale-aware formatting
  $: monthTitle = month.format('MMMM YYYY');
</script>


<div class="month-header">
  <span class="month-title">{monthTitle}</span>
</div>

<style>
  .month-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 0.75rem;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    position: sticky;
    top: 0;
    z-index: 20;
    backdrop-filter: blur(0.625rem);
    -webkit-backdrop-filter: blur(0.625rem);
  }

  .month-title {
    font-size: 1.0625rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-normal);
    text-transform: capitalize;
    -webkit-user-select: none;
    user-select: none;
  }
</style>