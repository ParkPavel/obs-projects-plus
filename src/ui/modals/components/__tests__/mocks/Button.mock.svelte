<script>
  // `variant` is accepted so the real props pass through, and shown as a data
  // attribute so the stand-in uses it.
  export let variant = undefined;
  export let disabled = false;
</script>

<button type="button" data-variant={variant} disabled={disabled} on:click><slot /></button>
