<script lang="ts">
  export let value: number;
</script>

<div>
  {new Intl.NumberFormat().format(value)}
</div>

<style>
  div {
    width: 100%;
    padding: 0.375rem;
    text-align: right;
  }
</style>
