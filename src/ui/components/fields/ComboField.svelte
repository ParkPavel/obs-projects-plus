<script lang="ts" context="module">
  // One counter per bundle: each field's ids are unique within the document.
  let sequence = 0;
</script>

<script lang="ts">
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
  import { remAt, rootFontPx } from "src/ui/utils/cssLength";
  import { createDraftController, type CommitReason } from "./draftController";
  import { filterOptions, optionDomId, stepActive, type ComboOption } from "./comboOptions";
  import { visibleViewport } from "src/ui/utils/visibleViewport";

  export let value = "";
  export let options: ComboOption[] = [];
  export let allowCustom = false;
  export let multi = false;
  export let loading = false;
  /** Ids shown as chosen in `multi` mode. */
  export let selectedIds: string[] = [];
  export let placeholder = "";
  export let disabled = false;
  export let id: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
  export let inputClass = "";
  /** Class on each option row, for a consumer that styles or queries them. */
  export let optionClass = "";
  /** Open the list when the field gets focus (default), not only on typing or ArrowDown. */
  export let openOnFocus = true;
  /** Report a blur that changed nothing (a cell editor that must leave edit mode). */
  export let commitUnchanged = false;
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
  let draft = value;
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
  let popupStyle = "";
  let watching: Window | null = null;

  /** Show the controller's text, and report it when it changed (an edit, a pick, a restore). */
  function pull(): void {
    const next = ctl.getState().draft;
    if (next === draft) return;
    draft = next;
    dispatch("draftChange", next);
  }
  // A text the parent passed is not an edit of the user's: shown, not reported.
  function adopt(next: string): void {
    if (ctl.refresh(next)) draft = ctl.getState().draft;
  }
  $: adopt(value);

  function visible(): ComboOption[] {
    return filterOptions(options, dirty ? draft : "");
  }
  $: shown = filterOptions(options, dirty ? draft : "");
  $: expanded = open && !disabled && (shown.length > 0 || loading);
  $: activeOpt = expanded && active >= 0 && active < shown.length ? shown[active] : undefined;

  /** Move focus into the input. */
  export function focus(): void {
    inputEl?.focus();
  }

  onMount(async () => {
    if (!focusOnMount) return;
    await tick();
    inputEl?.focus();
  });

  // ── Popup placement ────────────────────────────────────────
  async function place(): Promise<void> {
    await tick();
    if (!rootEl || !popupEl) return;
    const doc = rootEl.ownerDocument;
    const view = doc.defaultView ?? window;
    const base = rootFontPx(doc);
    const margin = 0.5 * base;
    const gap = 0.25 * base;
    const anchor = rootEl.getBoundingClientRect();
    const box = popupEl.getBoundingClientRect();
    const bounds = visibleViewport(view);
    const below = Math.max(0, bounds.bottom - margin - anchor.bottom - gap);
    const above = Math.max(0, anchor.top - gap - bounds.top - margin);
    let top = anchor.bottom + gap;
    // Flip above the anchor when the list does not fit below and does above.
    if (box.height > below && above > below) {
      top = anchor.top - gap - Math.min(box.height, above);
    }
    const height = Math.max(0, bounds.height - 2 * margin);
    const width = Math.max(0, bounds.width - 2 * margin);
    top = Math.min(Math.max(top, bounds.top + margin), Math.max(bounds.top + margin, bounds.bottom - margin - Math.min(box.height, height)));
    const left = Math.min(Math.max(anchor.left, bounds.left + margin), Math.max(bounds.left + margin, bounds.right - Math.min(Math.max(box.width, anchor.width), width) - margin));
    popupStyle = `top: ${remAt(top, base)}; left: ${remAt(left, base)}; min-width: ${remAt(Math.min(anchor.width, width), base)}; max-width: ${remAt(width, base)}; max-height: ${remAt(Math.max(0, bounds.bottom - margin - top), base)};`;
  }
  $: if (expanded && popupEl && shown) void place();

  function onViewChange(): void {
    if (expanded) void place();
  }
  function watch(view: Window | null): void {
    if (view === watching) return;
    watching?.removeEventListener("resize", onViewChange);
    watching?.removeEventListener("scroll", onViewChange, true);
    watching?.visualViewport?.removeEventListener("resize", onViewChange);
    watching?.visualViewport?.removeEventListener("scroll", onViewChange);
    watching = view;
    watching?.addEventListener("resize", onViewChange);
    watching?.addEventListener("scroll", onViewChange, true);
    watching?.visualViewport?.addEventListener("resize", onViewChange);
    watching?.visualViewport?.addEventListener("scroll", onViewChange);
  }
  $: watch(expanded ? rootEl?.ownerDocument.defaultView ?? null : null);
  onDestroy(() => watch(null));

  async function revealActive(): Promise<void> {
    await tick();
    const row = popupEl?.querySelector<HTMLElement>(".ppp-combo-option--active");
    if (row && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
  }

  // ── Lifecycle ──────────────────────────────────────────────
  function show(): void {
    if (open || disabled) return;
    open = true;
    // A reopened list is a new interaction inside the same focus.
    ctl.arm();
    pickedByPointer = null;
  }
  function hide(): void {
    open = false;
    active = -1;
    userNav = false;
    popupStyle = "";
  }
  /** The default active option: the top match when text cannot be committed as typed. */
  function resetActive(): void {
    userNav = false;
    active = allowCustom || multi || visible().length === 0 ? -1 : 0;
  }

  function onFocus(): void {
    ctl.focus(draft);
    dirty = false;
    userNav = false;
    pickedByPointer = null;
    const at = visible().findIndex((o) => o.label === draft);
    active = at;
    if (openOnFocus) show();
  }
  function onInput(e: Event): void {
    ctl.input((e.currentTarget as HTMLInputElement).value);
    pull();
    dirty = true;
    show();
    resetActive();
  }

  // ── Commit paths ───────────────────────────────────────────
  function exactMatch(text: string): ComboOption | undefined {
    return options.find((o) => o.label === text);
  }
  /**
   * Commit the typed text (Enter, Tab, blur); a pick of an exact option is
   * reported as a select too. `change` is the native signal that the text was
   * accepted (autofill, assistive technology); it commits like a blur that
   * leaves the field where it is.
   */
  function finish(reason: "enter" | "tab" | "blur" | "change"): void {
    if (multi) {
      if (reason === "blur") {
        ctl.blur({ accept: false });
        pull();
      }
      return;
    }
    const text = ctl.getState().draft;
    const exact = exactMatch(text);
    const accept = allowCustom || exact !== undefined;
    const opts = { accept, unchanged: commitUnchanged };
    const result = reason === "blur" ? ctl.blur(opts) : ctl.commit(reason === "change" ? "blur" : reason, opts);
    pull();
    dirty = false;
    if (!result) return;
    if (exact) dispatch("select", exact);
    dispatch("commit", { value: result.value, reason: result.reason });
  }
  function choose(opt: ComboOption): void {
    if (multi) {
      dispatch("select", opt);
      return;
    }
    const result = ctl.commit("select", { value: opt.label });
    if (!result) return;
    pull();
    dirty = false;
    hide();
    dispatch("select", opt);
    dispatch("commit", { value: result.value, reason: "select" });
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
    return open && !disabled && (visible().length > 0 || loading);
  }
  function activeNow(): ComboOption | undefined {
    const list = visible();
    return expandedNow() && active >= 0 && active < list.length ? list[active] : undefined;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (ctl.isComposing(e)) return;
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
      const pick = activeNow();
      if (pick) {
        e.preventDefault();
        choose(pick);
      } else if (!multi) {
        e.preventDefault();
        finish("enter");
        // Text that cannot be committed as typed keeps the list open to pick from.
        if (allowCustom || exactMatch(ctl.getState().draft) !== undefined) hide();
      }
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
      // The restore consumed this Escape; an untouched field lets it through.
      if (edited) e.stopPropagation();
      dispatch("cancel");
    } else if (e.key === "Tab") {
      const pick = activeNow();
      if (!multi && pick && (userNav || !allowCustom)) choose(pick);
      else finish("tab");
      hide();
    }
  }
  function onBlur(): void {
    hide();
    finish("blur");
    dirty = false;
  }

  function isSelected(opt: ComboOption, chosen: string[], text: string): boolean {
    return multi ? chosen.includes(opt.id) : opt.label === text;
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
    use:keepInView
    {id}
    class="ppp-combo-input {inputClass}"
    type="text"
    role="combobox"
    aria-autocomplete="list"
    aria-haspopup="listbox"
    aria-expanded={expanded}
    data-ppp-dirty={dirty ? "true" : undefined}
    aria-controls={expanded ? listId : undefined}
    aria-activedescendant={activeOpt ? optionDomId(listId, activeOpt.id) : undefined}
    aria-label={ariaLabel}
    autocomplete="off"
    spellcheck="false"
    value={draft}
    {placeholder}
    {disabled}
    on:focus={onFocus}
    on:blur={onBlur}
    on:input={onInput}
    on:click={show}
    on:change={() => finish("change")}
    on:keydown={onKeydown}
    on:compositionstart={() => ctl.compositionStart()}
    on:compositionend={() => ctl.compositionEnd()}
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
      style={popupStyle}
      on:mousedown|preventDefault
    >
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
  .ppp-combo-popup {
    position: fixed;
    z-index: var(--ppp-z-popover, 50);
    box-sizing: border-box;
    max-width: var(--ppp-popup-max-w, 24rem);
    max-height: 12rem;
    overflow-y: auto;
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
    min-height: 1.75rem;
    padding: var(--ppp-space-2, 0.25rem) var(--ppp-space-4, 0.5rem);
    border: none;
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
