<script>
  // Fallback stand-in for obsidian-svelte's Switch, used only when the real
  // component cannot be `require`d through the package's exports map (see
  // FieldControl.echo.test.ts). Copies the one behaviour the echo test exists
  // to catch: `$: dispatch("check", checked)` fires on ANY change to the
  // `checked` prop, not only on a real click.
  import { createEventDispatcher } from "svelte";
  export let checked = false;
  export let disabled = false;
  const dispatch = createEventDispatcher();
  $: dispatch("check", checked);

  function onClick() {
    if (disabled) return;
    checked = !checked;
  }
</script>

<button
  type="button"
  data-testid="switch"
  role="switch"
  aria-checked={checked}
  disabled={disabled}
  on:click={onClick}
>
  switch
</button>
