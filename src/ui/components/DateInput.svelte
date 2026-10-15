<script lang="ts">
  /**
   * DateInput — a date field (3.7.2 B1: typed date with a calendar button, see
   * fields/DateField). The API is the one its consumers already use: `value`,
   * `change`, `input`, `blur`, `disabled`, `embed`.
   */
  import DateField from "src/ui/components/fields/DateField.svelte";

  /** Specifies the date value. */
  export let value: Date | null;
  /** Removes decorations so that it can be embedded in other components. */
  export let embed: boolean = false;
  /**
   * Specifies whether the input rejects edits — the peek's read-only path
   * (#158 C1/C3) has no other way to stop a date picker from writing.
   */
  export let disabled: boolean = false;
</script>

<span class="ppp-date-input" class:embed>
  <DateField {value} {disabled} on:change on:input on:blur />
</span>

<style>
  .ppp-date-input {
    display: flex;
    width: 100%;
    min-width: 0;
  }
  .embed {
    margin: 0 0.5rem;
  }
</style>
