<script lang="ts">
  /**
   * DatetimeInput — a date-and-time field (3.7.2 B1: «14.10.2026 09:30» typed,
   * or the platform date-time picker from the calendar button). API unchanged:
   * `value`, `change`, `input`, `blur`, `disabled`, `embed`.
   */
  import DateField from "src/ui/components/fields/DateField.svelte";

  /** Specifies the date time value. */
  export let value: Date | null;
  /** Removes decorations so that it can be embedded in other components. */
  export let embed: boolean = false;
  /**
   * Specifies whether the field rejects edits — the peek's read-only path
   * (#158 C1/C3) has no other way to stop it.
   */
  export let disabled: boolean = false;
</script>

<span class="ppp-datetime-input" class:embed>
  <DateField {value} withTime {disabled} on:change on:input on:blur />
</span>

<style>
  .ppp-datetime-input {
    display: flex;
    width: 100%;
    min-width: 0;
  }
  .embed {
    margin: 0 0.5rem;
  }
</style>
