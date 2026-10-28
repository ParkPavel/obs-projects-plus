<script context="module" lang="ts">
  let instances = 0;
</script>

<script lang="ts">
  /**
   * w4-calendar-draft — the bottom form of a calendar draft. It is part of the
   * leaf's own layout, under the calendar, which shrinks to make room: no
   * backdrop, no focus trap, nothing over the grid, so the draft can still be
   * moved and stretched while the form is open. ✓ writes the one note (through
   * CalendarView), ✕ and Escape discard the draft. Text fields commit on Enter
   * or blur like every TextField; an IME composition neither confirms nor
   * cancels. A refusal is shown here and every value stays for another try.
   */
  import dayjs from "dayjs";
  import { onDestroy, onMount } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import DateField from "src/ui/components/fields/DateField.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { draftFileName, type CalendarDraft, type CalendarDraftController } from "./calendarDraft";

  export let controller: CalendarDraftController;
  export let templates: readonly string[] = [];
  /** Why a file name cannot be used ("" when it can): the create window's rules. */
  export let nameProblem: (fileName: string) => string = () => "";
  /** Desktop: the name is selected on open. A phone keeps its keyboard down. */
  export let autoFocus = false;
  /** Where focus goes when the form closes with focus inside it. */
  export let returnFocus: HTMLElement | null = null;
  export let onConfirm: () => void;

  const uid = `ppp-draft-sheet-${++instances}`;
  let rootEl: HTMLElement | null = null;
  let nameField: TextField | null = null;
  // The text in the name and icon fields; the draft takes it on commit, and ✓
  // takes it as well (a tap on a phone does not blur the field first).
  let typedName = "";
  let typedIcon = "";
  let seeded = -1;

  $: state = $controller;
  $: draft = state.draft;
  $: seed(draft);
  function seed(d: CalendarDraft | null): void {
    if (!d || d.session === seeded) return;
    seeded = d.session;
    typedName = d.name;
    typedIcon = d.icon;
  }

  $: untitled = $i18n.t("modals.note.create.untitled");
  $: problem = draft ? nameProblem(draftFileName({ ...draft, name: typedName }, untitled)) : "";
  $: computed = draft ? computedOf(draft) : [];
  $: writable = (name: string | undefined) => !!name && !computed.includes(name);

  function computedOf(d: CalendarDraft): string[] {
    const m = d.mapping;
    const mapped = [m.start, m.end, m.startTime, m.endTime, m.creation, m.color, m.icon, m.check];
    return [...new Set(mapped.filter((n): n is string => !!n && m.computed.includes(n)))];
  }

  /** Move focus to the name (the draft was tapped on the grid). */
  export function focusName(): void {
    nameField?.focus();
  }

  function confirm(): void {
    if (!draft || state.saving || problem) return;
    if (typedName !== draft.name || typedIcon !== draft.icon) controller.edit({ name: typedName, icon: typedIcon });
    onConfirm();
  }

  function onNameCommit(e: CustomEvent<{ value: string; reason: "enter" | "blur" | "tab" }>): void {
    typedName = e.detail.value;
    controller.edit({ name: e.detail.value });
    if (e.detail.reason === "enter") confirm();
  }

  function onIconCommit(e: CustomEvent<{ value: string }>): void {
    typedIcon = e.detail.value;
    controller.edit({ icon: e.detail.value });
  }

  function onKeydown(e: KeyboardEvent): void {
    // A field that restored its text has consumed this Escape already.
    if (e.key !== "Escape" || isImeKey(e) || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    controller.cancel();
  }

  const at = (date: Date | null) => (date ? dayjs(date) : null);

  onMount(() => {
    if (autoFocus) nameField?.select();
  });

  onDestroy(() => {
    const doc = rootEl?.ownerDocument;
    const active = doc?.activeElement ?? null;
    // ✓ is disabled while the note is written, which drops its focus to the body.
    const inside = !active || active === doc?.body || !!rootEl?.contains(active);
    if (rootEl && inside && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
</script>

{#if draft}
  <div
    bind:this={rootEl}
    class="ppp-draft-sheet"
    role="dialog"
    aria-modal="false"
    aria-labelledby="{uid}-title"
    aria-busy={state.saving}
    data-draft-session={draft.session}
    on:keydown={onKeydown}
  >
    <div class="ppp-draft-sheet__bar">
      <button
        type="button"
        class="ppp-draft-sheet__button clickable-icon"
        aria-label={$i18n.t("views.calendar.draft.discard")}
        title={$i18n.t("views.calendar.draft.discard")}
        on:click={() => controller.cancel()}
      >
        <Icon name="x" />
      </button>
      <span class="ppp-draft-sheet__title" id="{uid}-title">{$i18n.t("views.calendar.draft.title")}</span>
      <button
        type="button"
        class="ppp-draft-sheet__button ppp-draft-sheet__confirm mod-cta"
        aria-label={state.saving ? $i18n.t("modals.note.create.creating") : $i18n.t("modals.note.create.create")}
        title={state.saving ? $i18n.t("modals.note.create.creating") : $i18n.t("modals.note.create.create")}
        disabled={state.saving || !!problem}
        on:click={confirm}
      >
        <Icon name={state.saving ? "loader" : "check"} />
      </button>
    </div>

    {#if state.error}
      <p class="ppp-draft-sheet__error" role="alert">
        {$i18n.t("modals.note.create.save-error", { message: state.error })}
      </p>
    {/if}

    <div class="ppp-draft-sheet__fields">
      <div class="ppp-draft-sheet__field ppp-draft-sheet__field--wide">
        <label class="ppp-draft-sheet__caption" for="{uid}-name">{$i18n.t("modals.note.create.name.name")}</label>
        <TextField
          bind:this={nameField}
          id="{uid}-name"
          value={draft.name}
          inputClass="ppp-draft-sheet__input"
          error={!!problem}
          disabled={state.saving}
          on:input={(e) => (typedName = e.detail)}
          on:commit={onNameCommit}
          on:cancel={() => (typedName = draft?.name ?? "")}
        />
        {#if problem}<span class="ppp-draft-sheet__problem">{problem}</span>{/if}
      </div>

      {#if templates.length}
        <div class="ppp-draft-sheet__field ppp-draft-sheet__field--wide">
          <label class="ppp-draft-sheet__caption" for="{uid}-template">{$i18n.t("modals.note.create.templatePath.name")}</label>
          <select
            id="{uid}-template"
            class="dropdown ppp-draft-sheet__input"
            value={draft.templatePath}
            disabled={state.saving}
            on:change={(e) => controller.edit({ templatePath: e.currentTarget.value })}
          >
            <option value="">{$i18n.t("modals.note.create.templatePath.none")}</option>
            {#each templates as path}
              <option value={path}>{path}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div class="ppp-draft-sheet__field">
        <span class="ppp-draft-sheet__caption">{$i18n.t("views.calendar.draft.start")}</span>
        <DateField
          withTime
          value={draft.start.toDate()}
          disabled={state.saving}
          ariaLabel={$i18n.t("views.calendar.draft.start")}
          on:change={(e) => { const next = at(e.detail); if (next) controller.setStart(next); }}
        />
      </div>

      <div class="ppp-draft-sheet__field">
        <span class="ppp-draft-sheet__caption">{$i18n.t("views.calendar.draft.end")}</span>
        <DateField
          withTime
          value={draft.end.toDate()}
          disabled={state.saving}
          ariaLabel={$i18n.t("views.calendar.draft.end")}
          on:change={(e) => { const next = at(e.detail); if (next) controller.setEnd(next); }}
        />
      </div>

      {#if writable(draft.mapping.check)}
        <label class="ppp-draft-sheet__field ppp-draft-sheet__check">
          <input
            class="ppp-touch-target"
            type="checkbox"
            checked={draft.done}
            disabled={state.saving}
            on:change={(e) => controller.edit({ done: e.currentTarget.checked })}
          />
          <span>{$i18n.t("views.calendar.draft.done")}</span>
        </label>
      {/if}

      {#if writable(draft.mapping.icon)}
        <div class="ppp-draft-sheet__field">
          <label class="ppp-draft-sheet__caption" for="{uid}-icon">{$i18n.t("views.calendar.draft.icon")}</label>
          <TextField
            id="{uid}-icon"
            value={draft.icon}
            inputClass="ppp-draft-sheet__input"
            disabled={state.saving}
            on:input={(e) => (typedIcon = e.detail)}
            on:commit={onIconCommit}
            on:cancel={() => (typedIcon = draft?.icon ?? "")}
          />
        </div>
      {/if}

      {#if writable(draft.mapping.color)}
        <div class="ppp-draft-sheet__field">
          <label class="ppp-draft-sheet__caption" for="{uid}-color">{$i18n.t("views.calendar.draft.color")}</label>
          <span class="ppp-draft-sheet__color">
            <input
              id="{uid}-color"
              type="color"
              value={draft.color || "#808080"}
              disabled={state.saving}
              on:change={(e) => controller.edit({ color: e.currentTarget.value })}
            />
            {#if draft.color}
              <button
                type="button"
                class="ppp-draft-sheet__button clickable-icon"
                aria-label={$i18n.t("views.calendar.draft.clear-color")}
                title={$i18n.t("views.calendar.draft.clear-color")}
                disabled={state.saving}
                on:click={() => controller.edit({ color: "" })}
              >
                <Icon name="eraser" />
              </button>
            {/if}
          </span>
        </div>
      {/if}
    </div>

    {#if computed.length}
      <p class="ppp-draft-sheet__hint">{$i18n.t("views.calendar.draft.computed", { fields: computed.join(", ") })}</p>
    {/if}
  </div>
{/if}

<style>
  .ppp-draft-sheet {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    max-block-size: 55%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5em 0.75em calc(0.75em + env(safe-area-inset-bottom, 0rem));
    background: var(--background-primary);
    border-top: var(--ppp-border-width) solid var(--background-modifier-border);
    box-shadow: var(--shadow-s);
    /* It rises from the edge it belongs to; the reduced-motion rule over the
       plugin root (tokens.css) takes the movement away. */
    animation: ppp-draft-sheet-in var(--ppp-duration-normal, 200ms) cubic-bezier(0.23, 1, 0.32, 1);
  }
  @keyframes ppp-draft-sheet-in {
    from {
      opacity: 0;
      transform: translateY(0.75em);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ppp-draft-sheet {
      animation: none;
    }
  }
  .ppp-draft-sheet__bar {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
  .ppp-draft-sheet__title {
    flex: 1 1 auto;
    min-width: 0;
    font-weight: var(--font-semibold, 600);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-draft-sheet__button {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--ppp-touch-target, 2.75rem);
    min-block-size: var(--ppp-touch-target, 2.75rem);
    transition: transform 120ms ease-out;
  }
  .ppp-draft-sheet__button:active:not(:disabled) {
    transform: scale(0.96);
  }
  .ppp-draft-sheet__button:focus-visible {
    outline: var(--ppp-border-width-thick, 0.125rem) solid var(--interactive-accent);
    outline-offset: 0.125em;
  }
  .ppp-draft-sheet__fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12em), 1fr));
    gap: 0.5em 0.75em;
  }
  .ppp-draft-sheet__field {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    min-width: 0;
  }
  .ppp-draft-sheet__field--wide {
    grid-column: 1 / -1;
  }
  .ppp-draft-sheet__caption {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }
  .ppp-draft-sheet :global(.ppp-draft-sheet__input) {
    inline-size: 100%;
  }
  .ppp-draft-sheet__check {
    flex-direction: row;
    align-items: center;
    gap: 0.5em;
  }
  .ppp-draft-sheet__color {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
  .ppp-draft-sheet__color input {
    inline-size: 2.75em;
    block-size: 2em;
    padding: 0;
  }
  .ppp-draft-sheet__problem,
  .ppp-draft-sheet__error {
    margin: 0;
    color: var(--text-error);
    font-size: var(--font-ui-small);
    text-wrap: pretty;
  }
  .ppp-draft-sheet__hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-wrap: pretty;
  }
</style>
