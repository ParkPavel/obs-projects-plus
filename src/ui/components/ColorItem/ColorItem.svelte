<script lang="ts">
  export let color: string | null;
</script>

<div class="color-item">
  {#if color}
    <span
      style="margin-right: 0.5rem; background-color: {color}; min-width: 0.3125rem; border-radius: 624.9375rem;"
    />
  {/if}
  <div class="card-layout">
    <div class="card-header">
      <slot name="header" />
    </div>
    <slot />
  </div>
</div>

<style>
  .color-item {
    display: flex;
  }
  .card-layout {
    overflow: hidden;
    flex: 1;
  }
  .card-header {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .card-header:last-child {
    margin-bottom: 0;
  }
</style>
