<script>
  // Stand-in for DateInput.svelte with its interface — `value`, and the
  // change / input / blur events — minus dayjs, whose default import the
  // jest Svelte transform cannot resolve. What the echo tests exercise is
  // FieldControl's commit rule, not DateInput's own parsing.
  import { createEventDispatcher } from "svelte";
  export let value = null;
  export let embed = false;
  export let disabled = false;
  void embed;
  const dispatch = createEventDispatcher();
  const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : "");
  function handleChange(event) {
    const v = event.currentTarget.value;
    dispatch("change", v ? new Date(`${v}T00:00:00`) : null);
  }
</script>

<input type="date" value={iso(value)} {disabled} on:change={handleChange} on:blur />
