<script lang="ts">
  /**
   * DateField (3.7.2 B1) — a date a person can type, with the calendar one tap
   * away. The native `<input type="date">` it replaces was a wheel on iOS and
   * took no typing. Text goes through parseTypedDate (14.10.2026, 1.11,
   * «завтра», «+3», «9:30»); a refused draft is marked and never committed, so
   * the stored date survives (AD-03). Enter/blur/Escape/IME behave as in every
   * TextField. The calendar button opens the platform picker over a hidden
   * native input — the OS control is used, not imitated.
   */
  import { createEventDispatcher, tick } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { formatTypedDate, parseTypedDate } from "src/lib/helpers/typedDate";
  import TextField from "./TextField.svelte";

  export let value: Date | null = null;
  /** Date and time («14.10.2026 09:30») instead of a day. */
  export let withTime = false;
  export let disabled = false;
  export let ariaLabel: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ change: Date | null; input: Date | null; blur: void }>();

  let shown: Date | null = value;
  $: shown = value;
  $: text = shown ? formatTypedDate(shown, withTime) : "";

  let pickerEl: HTMLInputElement | null = null;
  $: nativeValue = shown ? toNative(shown) : "";

  function toNative(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return withTime ? `${day}T${p(d.getHours())}:${p(d.getMinutes())}` : day;
  }

  function accepts(draft: string): boolean {
    return parseTypedDate(draft).kind !== "invalid";
  }

  function emit(next: Date | null): void {
    shown = next;
    dispatch("change", next);
    dispatch("input", next);
  }

  function onCommit(e: CustomEvent<{ value: string; reason: "enter" | "blur" }>): void {
    const parsed = parseTypedDate(e.detail.value);
    if (parsed.kind === "invalid") return;
    if (parsed.kind === "empty") { emit(null); return; }
    let date = parsed.date;
    // A typed day in a date-and-time field keeps the time it had.
    if (withTime && !parsed.hasTime && shown) {
      date = new Date(date);
      date.setHours(shown.getHours(), shown.getMinutes(), 0, 0);
    }
    emit(date);
  }

  async function openPicker(): Promise<void> {
    if (disabled || !pickerEl) return;
    await tick();
    const el = pickerEl as HTMLInputElement & { showPicker?: () => void };
    try {
      if (typeof el.showPicker === "function") { el.showPicker(); return; }
    } catch { /* not allowed here (no user activation) — fall back below */ }
    el.focus();
    el.click();
  }

  let rootEl: HTMLElement | null = null;
  // Consumers commit on blur (FieldControl); report it once focus has left the
  // whole field, after the text field committed its draft.
  async function onFocusOut(e: FocusEvent): Promise<void> {
    const next = e.relatedTarget as Node | null;
    if (next && rootEl?.contains(next)) return;
    await tick();
    dispatch("blur");
  }

  function onPicked(e: Event): void {
    const raw = (e.currentTarget as HTMLInputElement).value;
    if (!raw) { emit(null); return; }
    const parsed = parseTypedDate(raw.replace("T", " "));
    if (parsed.kind === "date") emit(parsed.date);
    dispatch("blur");
  }
</script>

<span class="ppp-date-field" class:ppp-date-field--disabled={disabled} bind:this={rootEl} on:focusout={onFocusOut}>
  <TextField
    value={text}
    {disabled}
    {ariaLabel}
    inputMode="text"
    inputClass="ppp-date-field__text"
    placeholder={$i18n.t(withTime ? "common.datetime-typed-placeholder" : "common.date-typed-placeholder")}
    validate={accepts}
    on:commit={onCommit}
    on:cancel
  />
  <button
    type="button"
    class="ppp-date-field__calendar clickable-icon"
    aria-label={$i18n.t("common.select-date")}
    title={$i18n.t("common.select-date")}
    {disabled}
    on:click={openPicker}
  >
    <Icon name="calendar" size="sm" />
  </button>
  <input
    bind:this={pickerEl}
    class="ppp-date-field__native"
    type={withTime ? "datetime-local" : "date"}
    tabindex="-1"
    aria-hidden="true"
    value={nativeValue}
    max={withTime ? "9999-12-31T23:59" : "9999-12-31"}
    {disabled}
    on:change={onPicked}
  />
</span>

<style>
  .ppp-date-field {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--ppp-gap-xs, 0.25rem);
    min-width: 0;
    width: 100%;
  }
  .ppp-date-field :global(.ppp-date-field__text) {
    flex: 1 1 auto;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }
  .ppp-date-field__calendar {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--ppp-touch-target, 2.75rem);
    min-height: var(--ppp-touch-target, 2.75rem);
    background: none;
    border: none;
    box-shadow: none;
    color: var(--text-muted);
  }
  /* Kept in the layout under the button so the platform anchors its picker here. */
  .ppp-date-field__native {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 0.0625rem;
    height: 0.0625rem;
    opacity: 0;
    pointer-events: none;
  }
  .ppp-date-field--disabled .ppp-date-field__calendar {
    opacity: 0.5;
  }
</style>
