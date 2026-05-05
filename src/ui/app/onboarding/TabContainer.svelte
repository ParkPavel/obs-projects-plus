<script lang="ts">
  export let options: string[];

  let selected: string = options[0] ?? "";
</script>

<div>
  <div class="header">
    {#each options as option}
      <div
        class="clickable-icon"
        class:is-active={option === selected}
        on:keypress
        on:click={() => {
          selected = option;
        }}
      >
        {option}
      </div>
    {/each}
  </div>
  <div class="card nomargin">
    <slot {selected} />
  </div>
</div>

<style>
  .nomargin {
    margin: 0;
    padding: 0.5rem;
  }

  .header {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }
</style>
