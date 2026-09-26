<script>
  // Fallback stand-in for obsidian-svelte's NumberInput, used only when the
  // real component cannot be `require`d through the package's exports map
  // (see EditNote.echo.test.ts). Copies the one behaviour the echo test
  // exists to catch: `$: dispatch("input", value)` fires on ANY change to
  // the `value` prop, not only on a real keystroke.
  import { createEventDispatcher } from "svelte";
  export let value = null;
  export let readonly = false;
  const dispatch = createEventDispatcher();
  $: dispatch("input", value);

  function onInput(e) {
    value = e.currentTarget.valueAsNumber;
  }
</script>

<input
  type="number"
  data-testid="number-input"
  value={value ?? ""}
  disabled={readonly}
  on:input={onInput}
/>
