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
    overscroll-behavior: contain;
    container-type: inline-size;
    container-name: view-content;
  }

  .no-scroll {
    overflow: hidden;
  }

  .padding {
    padding: 1.5rem;
  }
  
  /* v4.0.0: Mobile-friendly padding */
  @media (max-width: 30rem) {
    .padding {
      padding: 0.75rem;
    }
  }
</style>
