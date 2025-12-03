<script lang="ts">
  export let padding: boolean = false;
  export let noScroll: boolean = false;
</script>

<div class:padding class:no-scroll={noScroll}>
  <slot />
</div>

<style>
  div {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .no-scroll {
    overflow: hidden;
  }

  .padding {
    padding: 24px;
  }
</style>
