<div>
  <slot />
</div>

<style>
  div {
    height: 100%;
    display: flex;
    flex-direction: column;
    /* v3.2.8: Prevent horizontal expansion beyond allocated width */
    overflow: hidden;
  }
</style>
