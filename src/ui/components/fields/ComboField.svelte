<script lang="ts" context="module">
  // One counter per bundle: each field's ids are unique within the document.
  let sequence = 0;
</script>

<script lang="ts">
  /** Re-arm an unchanged draft after the consumer reports a failed write. */
  export function retryCommit(): void { ctl.arm(); }
  /** A containing editor can own Tab while keeping the field's selected option. */
  export function commitForNavigation(): boolean {
    if (readOnly || disabled || ctl.isComposing()) return false;
    const pick = allowEmpty && ctl.getState().draft === "" && !userNav ? undefined : activeNow();
    const accepted = !multi && pick && (userNav || !allowCustom) ? choose(pick) : finish("tab");
    hide();
    return accepted;
  }
  /** Forms may reconcile an accepted draft with an older parent snapshot. */
  export function syncForSubmit(): boolean {
    if (!alive || readOnly || disabled || ctl.isComposing()) return false;
    if (multi) return commitForNavigation();
    const effective = ctl.valueForSubmit();
    if (effective !== ctl.getState().draft) { ctl.reset(effective); pull(false); }
    const before = commits, accepted = commitForNavigation();
    if (!accepted || commits !== before || ctl.valueForSubmit() === value) return accepted;
    const submitted = ctl.valueForSubmit(), exact = exactMatch(submitted);
    ctl.arm();
    const result = ctl.commit("tab", {value: submitted, unchanged: true});
    if (!result) return false;
    if (exact && submitted === (exact.value ?? exact.label)) dispatch("select", exact);
    commits++;
    dispatch("commit", result);
    return true;
  }
  export function isComposing(): boolean { return ctl.isComposing(); }
  /**
   * ComboField (stab-forms) — a text input with a suggestion listbox. DOM focus
   * stays on the input (role=combobox, aria-activedescendant names the active
   * option); the list is a role=listbox portalled to the body of the anchor's
   * own document and positioned from the anchor, so a clipping container or a
   * popout window cannot cut it off.
   *
   * Keys: ArrowDown/Up move the active option, Enter chooses it (or commits the
   * typed text when `allowCustom`), Escape closes the list and, with the list
   * closed, restores the text the field had on entry, Tab commits. A pointer or
   * touch pick selects before the input blurs and commits once. IME composition
   * suppresses every key action. The consumer owns persistence.
   *
   * The list is outside its host in the DOM, so a host that closes on a press
   * outside itself must know it belongs to the field: `data-settings-dropdown`
   * is the marker `SettingsMenuPopover` already honours.
   *
   * `multi`: a pick toggles and keeps the list open; the text is only a query and
   * is never committed, the consumer ends the interaction (Done/Cancel).
   */
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
  import { setIcon } from "obsidian";
  import { portal } from "src/ui/portal";
  import { keepInView } from "./keepInView";
  import { releaseOnOutsideTap } from "./releaseOnOutsideTap";
  import { createDraftController, recordImeCompositionEnd, type CommitReason } from "./draftController";
  import { createOptionSearch, optionDomId, stepActive, type ComboOption } from "./comboOptions";
  import { onKeyboardChange, visibleViewport } from "src/ui/utils/visibleViewport";
  import { placeAboveField } from "./placeAboveField";
  import { revealInList } from "./revealInList";

  export let value = "";
  export let options: ComboOption[] = [];
  export let allowCustom = false;
  export let allowEmpty = false;
  /** A legacy stored value can be left untouched without becoming a new option. */
  export let allowUnlistedUnchanged = false;
  export let multi = false;
  export let loading = false;
  /** Ids shown as chosen in `multi` mode. */
  export let selectedIds: string[] = [];
  export let placeholder = "";
  export let disabled = false;
  /** A pending write keeps the same focused input and its draft. */
  export let readOnly = false;
  export let id: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
  export let inputClass = "";
  export let inputMode: "text" | "numeric" | "decimal" | "search" | "email" | "url" | "tel" | "none" = "text";
  export let validate: ((draft: string) => boolean) | undefined = undefined;
  export let preserveInvalidOnBlur = false;
  export let error = false;
  /** Class on each option row, for a consumer that styles or queries them. */
  export let optionClass = "";
  /** Open the list when the field gets focus (default), not only on typing or ArrowDown. */
  export let openOnFocus = true;
  /** Report a blur that changed nothing (a cell editor that must leave edit mode). */
  export let commitUnchanged = false;
  /** Query-only selectors retire their draft when the owner removes them. */
  export let commitOnDestroy = true;
  /** Focus the input once mounted. */
  export let focusOnMount = false;

  const dispatch = createEventDispatcher<{
    draftChange: string;
    select: ComboOption;
    commit: { value: string; reason: CommitReason };
    cancel: void;
  }>();

  const uid = `ppp-combo-${++sequence}`;
  const listId = `${uid}-list`;

  const ctl = createDraftController(value);
  const search = createOptionSearch<ComboOption>();
  $: suggestions = search.update(options);
  let draft = value;
  let reportedDraft = value;
  let invalid = false, alive = true;
  let commits = 0;
  onDestroy(() => { alive = false; });
  let open = false;
  let active = -1;
  // The user typed since the list opened: only then is the list filtered, so a
  // field that already holds a value still offers every option on entry.
  let dirty = false;
  // The active option was chosen with the arrow keys, not by default.
  let userNav = false;
  // The option a pointer just picked, so the click that follows does not pick again.
  let pickedByPointer: string | null = null;
  let rootEl: HTMLDivElement | null = null;
  let inputEl: HTMLInputElement | null = null;
  let popupEl: HTMLDivElement | null = null;
  let insetEl: HTMLSpanElement | null = null;
  let popupStyle = "visibility: hidden;";
  let placementHidden = true;
  let placementVersion = 0;
  let roomAttempt = "";
  let watching: Window | null = null;
  let unwatchKeyboard: (() => void) | null = null;

  /** Show the controller's text, and report it when it changed (an edit, a pick, a restore). */
  function pull(notify = true): void {
    const next = ctl.getState().draft;
    draft = next;
    if (!readOnly && !disabled && !ctl.isComposing() && next !== reportedDraft) { reportedDraft = next; if (notify) dispatch("draftChange", next); }
  }
  // A text the parent passed is not an edit of the user's: shown, not reported.
  function adopt(next: string): void {
    if (ctl.refresh(next)) { draft = ctl.getState().draft; reportedDraft = draft; }
  }
  $: adopt(value);

  function visible(): ComboOption[] {
    return suggestions(dirty ? draft : "");
  }
  $: shown = suggestions(dirty ? draft : "");
  $: expanded = open && !disabled && (shown.length > 0 || loading);
  $: activeOpt = expanded && !placementHidden && active >= 0 && active < shown.length ? shown[active] : undefined;

  /** Move focus into the input. */
  export function focus(): void {
    if (alive) inputEl?.focus();
  }
  export function select(): void { focus(); inputEl?.select(); }

  export function reset(next = ""): void {
    ctl.reset(next);
    pull();
    dirty = false;
    active = -1;
    invalid = false;
  }

  onMount(async () => {
    if (!focusOnMount) return;
    await tick();
    if (alive && inputEl?.isConnected) inputEl.focus();
  });

  // ── Popup placement ────────────────────────────────────────
  function measureAnchor(): DOMRect | undefined {
    return inputEl?.getBoundingClientRect();
  }
  async function place(): Promise<void> {
    const version = ++placementVersion;
    await tick();
    if (!alive || version !== placementVersion || !expanded || !rootEl || !popupEl || !inputEl) return;
    const placement = placeAboveField(inputEl, popupEl, insetEl, roomAttempt);
    if (version !== placementVersion || !expanded) return;
    roomAttempt = placement.roomAttempt;
    placementHidden = !placement.visible;
    popupStyle = placement.style;
  }
  $: if (expanded && popupEl && shown) void place();

  function onViewChange(e?: Event): void {
    // i3-input: the list scrolling its own rows is not a move of the field;
    // re-placing on it re-capped the list mid-flick and made it jump.
    const target = e?.target;
    if (popupEl && target && typeof target === "object" && "nodeType" in target && popupEl.contains(target as Node)) return;
    if (expanded) void place();
  }
  function watch(view: Window | null): void {
    if (view === watching) return;
    watching?.removeEventListener("resize", onViewChange);
    watching?.removeEventListener("scroll", onViewChange, true);
    watching?.visualViewport?.removeEventListener("resize", onViewChange);
    watching?.visualViewport?.removeEventListener("scroll", onViewChange);
    unwatchKeyboard?.();
    unwatchKeyboard = null;
    watching = view;
    watching?.addEventListener("resize", onViewChange);
    watching?.addEventListener("scroll", onViewChange, true);
    watching?.visualViewport?.addEventListener("resize", onViewChange);
    watching?.visualViewport?.addEventListener("scroll", onViewChange);
    // w4-input: Obsidian's keyboard (`--keyboard-height`) moves no viewport.
    if (watching) unwatchKeyboard = onKeyboardChange(watching, () => onViewChange());
  }
  $: watch(expanded ? rootEl?.ownerDocument.defaultView ?? null : null);
  onDestroy(() => { placementVersion++; watch(null); });

  // i3-input: the list follows its field. A sheet that fits itself to the
  // keyboard moves the field by layout alone — no scroll or resize event —
  // and the list stayed where the field used to be. While the list is open,
  // each frame compares the field's box and re-places the list on a change.
  let anchorFrame: number | null = null;
  let lastAnchor = "";
  function trackAnchor(): void {
    anchorFrame = null;
    const view = rootEl?.ownerDocument.defaultView;
    if (!expanded || !rootEl || !view?.requestAnimationFrame) return;
    const r = measureAnchor()!;
    const area = visibleViewport(view);
    // A pan of the visual viewport (iOS) or the keyboard moves the visible
    // area, not the field.
    const key = `${r.top}|${r.left}|${r.width}|${r.height}|${area.top}|${area.height}`;
    if (key !== lastAnchor) {
      lastAnchor = key;
      void place();
    }
    anchorFrame = view.requestAnimationFrame(trackAnchor);
  }
  function untrackAnchor(): void {
    if (anchorFrame !== null) rootEl?.ownerDocument.defaultView?.cancelAnimationFrame(anchorFrame);
    anchorFrame = null;
    lastAnchor = "";
  }
  $: if (expanded && anchorFrame === null) trackAnchor();
  $: if (!expanded) untrackAnchor();
  onDestroy(untrackAnchor);

  async function revealActive(): Promise<void> {
    await tick();
    if (!alive) return;
    const row = popupEl?.querySelector<HTMLElement>(".ppp-combo-option--active");
    if (row) revealInList(row, popupEl);
  }

  // ── Lifecycle ──────────────────────────────────────────────
  function show(): void {
    if (open || disabled || readOnly) return;
    open = true;
    roomAttempt = "";
    // A reopened list is a new interaction inside the same focus.
    ctl.arm();
    pickedByPointer = null;
  }
  function hide(): void {
    placementVersion++;
    open = false;
    placementHidden = true;
    active = -1;
    userNav = false;
    popupStyle = "visibility: hidden;";
  }
  /** The default active option: the top match when text cannot be committed as typed. */
  function resetActive(): void {
    userNav = false;
    active = allowCustom || multi || visible().length === 0 ? -1 : 0;
  }

  function onFocus(): void {
    ctl.focus(draft, { resume: preserveInvalidOnBlur && invalid });
    reportedDraft = draft;
    dirty = false;
    userNav = false;
    pickedByPointer = null;
    const at = visible().findIndex((o) => (o.value ?? o.label) === draft);
    active = at;
    if (openOnFocus) show();
  }
  function onInput(e: Event): void {
    if (readOnly || disabled) return;
    ctl.input((e.currentTarget as HTMLInputElement).value);
    pull();
    dirty = true;
    invalid = false;
    if (ctl.getState().focused) show();
    resetActive();
  }

  // ── Commit paths ───────────────────────────────────────────
  function exactMatch(text: string): ComboOption | undefined {
    // Typed stored syntax must win over another option's display label.
    return options.find((o) => (o.value ?? o.label) === text)
      ?? options.find((o) => o.label === text);
  }
  /**
   * i3-input — the option a typed text plainly means: the same label in
   * another case, or the only option the text still matches. In a field that
   * takes only its options, such text used to be thrown away on blur (the
   * keyboard closed, a tap elsewhere), which read as the field losing data.
   */
  function plainMatch(text: string): ComboOption | undefined {
    const t = text.trim().toLowerCase();
    if (!t) return undefined;
    const same = options.filter((o) => o.label.toLowerCase() === t);
    if (same.length) return same.length === 1 ? same[0] : undefined;
    const hits = suggestions(text);
    return hits.length === 1 ? hits[0] : undefined;
  }
  /**
   * Commit the typed text (Enter, Tab, blur); a pick of an exact option is
   * reported as a select too. `change` is the native signal that the text was
   * accepted (autofill, assistive technology); it commits like a blur that
   * leaves the field where it is.
   */
  function finish(reason: "enter" | "tab" | "blur" | "change"): boolean {
    if (readOnly || disabled || ctl.isComposing()) return false;
    const before = ctl.getState();
    if (multi) {
      if (reason === "blur") {
        ctl.blur({ accept: false });
        pull(before.draft !== before.baseline || ctl.getState().draft === before.draft);
      }
      return true;
    }
    const text = ctl.getState().draft;
    const exact = exactMatch(text);
    if (exact?.value !== undefined && exact.value !== text && (reason !== "blur" || dirty)) {
      const accepted = choose(exact);
      if (reason === "blur" && accepted) ctl.blur();
      return accepted;
    }
    if (!allowCustom && exact === undefined && text !== ctl.getState().baseline) {
      const meant = plainMatch(text);
      if (meant) {
        const accepted = choose(meant);
        if (reason === "blur" && accepted) ctl.blur();
        return accepted;
      }
    }
    const accept = (allowCustom || exact !== undefined || allowEmpty && text === "" ||
      allowUnlistedUnchanged && text === ctl.getState().baseline) && (!validate || validate(text));
    invalid = !accept && (reason !== "blur" || preserveInvalidOnBlur);
    const opts = { accept, unchanged: commitUnchanged, preserveDraft: preserveInvalidOnBlur };
    const result = reason === "blur" ? ctl.blur(opts) : ctl.commit(reason === "change" ? "blur" : reason, opts);
    // A pending parent value adopted by an untouched blur is synchronization,
    // not a user edit. Keep the notification baseline without triggering saves.
    const adoptedParent = reason === "blur" && before.draft === before.baseline && ctl.getState().draft !== before.draft;
    pull(!adoptedParent);
    dirty = false;
    if (!result) return accept;
    if (exact && !adoptedParent && result.value === (exact.value ?? exact.label)) dispatch("select", exact);
    commits++;
    dispatch("commit", { value: result.value, reason: result.reason });
    return true;
  }
  function choose(opt: ComboOption): boolean {
    if (readOnly || disabled || ctl.isComposing()) return false;
    const next = opt.value ?? opt.label;
    if (validate && !validate(next)) { invalid = true; return false; }
    invalid = false;
    if (multi) {
      dispatch("select", opt);
      return true;
    }
    const result = ctl.commit("select", { value: next });
    if (!result) return true;
    pull();
    dirty = false;
    hide();
    dispatch("select", opt);
    commits++;
    dispatch("commit", { value: result.value, reason: "select" });
    return true;
  }
  function pointerPick(opt: ComboOption): void {
    pickedByPointer = opt.id;
    choose(opt);
  }
  function clickPick(opt: ComboOption): void {
    // The click that follows a pointer pick is the same tap.
    if (pickedByPointer === opt.id) {
      pickedByPointer = null;
      return;
    }
    choose(opt);
  }

  // The derived `expanded` and `activeOpt` settle on the next flush; a key handler
  // runs between flushes (two keys in one task), so it reads the live state.
  function expandedNow(): boolean {
    return open && !disabled && !placementHidden && (visible().length > 0 || loading);
  }
  function activeNow(): ComboOption | undefined {
    const list = visible();
    return expandedNow() && active >= 0 && active < list.length ? list[active] : undefined;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (readOnly || disabled || ctl.isComposing(e)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const wasOpen = expandedNow();
      show();
      if (!wasOpen && !userNav && active >= 0) {
        // Opening on the option that is already the field's value.
        userNav = true;
        void revealActive();
        return;
      }
      userNav = true;
      active = stepActive(active, e.key === "ArrowDown" ? 1 : -1, visible().length);
      void revealActive();
    } else if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    } else if (e.key === "Escape") {
      if (expandedNow()) {
        // The first Escape only closes the list.
        e.preventDefault();
        e.stopPropagation();
        hide();
        return;
      }
      const edited = ctl.getState().draft !== ctl.getState().baseline;
      ctl.cancel();
      pull();
      dirty = false;
      invalid = false;
      // The restore consumed this Escape; an untouched field lets it through.
      if (edited) e.stopPropagation();
      dispatch("cancel");
    } else if (e.key === "Tab") {
      commitForNavigation();
    }
  }
  function confirm(): void {
    if (readOnly || disabled || ctl.isComposing()) return;
    if (!multi && allowEmpty && ctl.getState().draft === "" && !userNav) { finish("enter"); hide(); return; }
    const pick = activeNow();
    if (pick) choose(pick);
    else if (!multi) {
      finish("enter");
      // Text that cannot be committed as typed keeps the list open to pick from.
      if (allowCustom || exactMatch(ctl.getState().draft) !== undefined) hide();
    }
  }
  function onBlur(): void {
    hide();
    if (ctl.isComposing()) { ctl.blur(); return; }
    finish("blur");
    dirty = false;
  }
  function onCompositionEnd(event: CompositionEvent): void {
    if (!alive) return;
    recordImeCompositionEnd(event);
    if (inputEl && inputEl.value !== draft) ctl.input(inputEl.value);
    ctl.compositionEnd(); pull();
    if (ctl.needsBlurCommit()) finish("blur");
  }
  // i3-input: a host that closes on an outside press removes the field while
  // it still has focus, and whether a blur fires first depends on the browser.
  // An edit still pending when the field goes is committed as a blur would.
  onDestroy(() => {
    if (commitOnDestroy && !multi && ctl.getState().draft !== ctl.getState().baseline) finish("blur");
  });

  function isSelected(opt: ComboOption, chosen: string[], text: string): boolean {
    return multi ? chosen.includes(opt.id) : (opt.value ?? opt.label) === text;
  }

  function iconAction(node: HTMLElement, icon: string) {
    setIcon(node, icon);
    return {
      update(next: string) {
        node.replaceChildren();
        setIcon(node, next);
      },
    };
  }
</script>

<div class="ppp-combo" bind:this={rootEl}>
  <input
    bind:this={inputEl}
    use:keepInView={{ confirm }}
    use:releaseOnOutsideTap
    {id}
    class="ppp-combo-input {inputClass}"
    type="text"
    inputmode={inputMode}
    enterkeyhint="done"
    role="combobox"
    aria-autocomplete="list"
    aria-haspopup="listbox"
    aria-expanded={expanded && !placementHidden}
    data-ppp-dirty={dirty ? "true" : undefined}
    aria-controls={expanded ? listId : undefined}
    aria-activedescendant={activeOpt ? optionDomId(listId, activeOpt.id) : undefined}
    aria-label={ariaLabel}
    aria-invalid={invalid || error || undefined}
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    value={draft}
    {placeholder}
    {disabled}
    readonly={readOnly}
    on:focus={onFocus}
    on:focus
    on:blur={onBlur}
    on:input={onInput}
    on:click={show}
    on:change={() => finish("change")}
    on:keydown={onKeydown}
    on:keydown
    on:compositionstart={() => ctl.compositionStart()}
    on:compositionend={onCompositionEnd}
    {...$$restProps}
  />
  {#if expanded}
    <div
      bind:this={popupEl}
      use:portal={{ to: "document-body" }}
      class="ppp-popup ppp-combo-popup"
      id={listId}
      role="listbox"
      tabindex="-1"
      data-settings-dropdown="combo"
      aria-multiselectable={multi ? "true" : undefined}
      aria-busy={loading ? "true" : undefined}
      aria-hidden={placementHidden ? "true" : undefined}
      style={popupStyle}
      on:mousedown|preventDefault
    >
      <span bind:this={insetEl} class="ppp-combo-insets" aria-hidden="true"></span>
      {#each shown as opt (opt.id)}
        <button
          type="button"
          tabindex="-1"
          role="option"
          id={optionDomId(listId, opt.id)}
          class="ppp-combo-option {optionClass}"
          class:ppp-combo-option--active={activeOpt?.id === opt.id}
          aria-selected={isSelected(opt, selectedIds, draft)}
          on:mousedown|preventDefault={() => pointerPick(opt)}
          on:click={() => clickPick(opt)}
        ><!-- no whitespace between the parts: the row's text is the label, exactly -->{#if opt.icon}<span class="ppp-combo-option-icon" aria-hidden="true" use:iconAction={opt.icon}></span>{/if}<span class="ppp-combo-option-label">{opt.label}</span>{#if multi && selectedIds.includes(opt.id)}<span class="ppp-combo-option-check" aria-hidden="true" use:iconAction={"check"}></span>{/if}</button>
      {/each}
      {#if loading}
        <span class="ppp-combo-hint" role="presentation">…</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ppp-combo {
    position: relative;
    display: flex;
    min-width: 0;
  }
  .ppp-combo-input {
    flex: 1;
    min-width: 0;
  }
  .ppp-combo-input[aria-invalid="true"] { border-color: var(--text-error); }
  .ppp-combo-insets {
    position: fixed;
    width: 0;
    height: 0;
    padding: env(safe-area-inset-top, 0rem) env(safe-area-inset-right, 0rem) env(safe-area-inset-bottom, 0rem) env(safe-area-inset-left, 0rem);
    visibility: hidden;
    pointer-events: none;
  }
  .ppp-combo-popup {
    position: fixed;
    z-index: max(var(--ppp-z-popover, 50), calc(var(--layer-modal, 50) + 1));
    box-sizing: border-box;
    max-width: var(--ppp-popup-max-w, 24rem);
    max-height: 12rem;
    overflow-y: auto;
    /* i3-input: a flick at the list's end does not scroll the page under it. */
    overscroll-behavior: contain;
    touch-action: pan-y;
    padding: var(--ppp-space-2, 0.25rem);
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-md, 0.25rem);
    box-shadow: var(--ppp-shadow-lg, 0 0.25rem 0.5rem rgba(0, 0, 0, 0.15));
    display: flex;
    flex-direction: column;
  }
  .ppp-combo-option {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-3, 0.375rem);
    width: 100%;
    height: auto;
    min-height: 1.75rem;
    padding: var(--ppp-space-2, 0.25rem) var(--ppp-space-4, 0.5rem);
    border: none;
    /* w4-p06 (N9): not Obsidian's raised button — a row of the list. */
    box-shadow: none;
    border-radius: var(--ppp-radius-md, 0.25rem);
    background: transparent;
    color: var(--text-normal);
    font-size: var(--ppp-font-size-md, 0.8125rem);
    text-align: left;
    cursor: pointer;
  }
  .ppp-combo-option:hover,
  .ppp-combo-option--active {
    background: var(--background-modifier-hover);
  }
  .ppp-combo-option[aria-selected="true"] {
    color: var(--interactive-accent);
  }
  .ppp-combo-option-icon,
  .ppp-combo-option-check {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .ppp-combo-option-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-combo-hint {
    padding: var(--ppp-space-3, 0.375rem);
    color: var(--text-muted);
    font-size: var(--ppp-font-size-md, 0.8125rem);
  }
  @media (pointer: coarse) {
    .ppp-combo-option {
      min-height: 2.75rem;
    }
  }
</style>
