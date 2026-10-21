<script lang="ts">
  /**
   * ChipsEditor (i3-props) — a list, tags or relation value edited one item
   * at a time. The comma-joined text field it replaces re-split every item on
   * its commas, so «Smith, John» came back as two items; here an item is a
   * chip and is never split (a pasted text with commas stays one chip).
   *
   * Keys: Enter or «,» adds the typed text as a chip, Backspace in an empty
   * field removes the last chip, Escape clears the typed text and, with
   * nothing typed, ends the edit; Enter in an empty field ends it too. Leaving
   * the editor adds what was typed and ends the edit. Each add or remove is
   * reported as the whole next list; the consumer writes it.
   *
   * The text entry is the kit's TextField (R0.36 / R0_FIELDS); the chip keys
   * are read in the capture phase, before the field's own Enter and Escape.
   */
  import { createEventDispatcher, onMount } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { stripToDisplay } from "src/lib/engine/wikilink";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import { chipItem, type ListType } from "./noteProperties";

  export let items: string[] = [];
  export let type: ListType = "list";
  export let ariaLabel = "";

  // `done` carries whether the row takes focus back: a key ended the edit
  // (true), or focus already went elsewhere and must stay there (false).
  const dispatch = createEventDispatcher<{ change: string[]; done: boolean }>();

  let field: TextField | null = null;
  let rootEl: HTMLDivElement | null = null;
  let text = "";
  // i3-props: the list as the user has edited it. A second add made before
  // the first write reached the note must build on the first, not on the
  // stored value, or the first item is lost. A new stored value replaces it.
  let list: string[] = [...items];
  let adopted = JSON.stringify(items);
  function adopt(next: string[]): void {
    const key = JSON.stringify(next);
    if (key === adopted) return;
    adopted = key;
    list = [...next];
  }
  $: adopt(items);

  $: t = $i18n.t.bind($i18n);

  export function focus(): void {
    field?.focus();
  }
  onMount(focus);

  function label(item: string): string {
    if (type === "tags") return `#${item.replace(/^#+/, "")}`;
    return type === "relation" ? stripToDisplay(item) : item;
  }

  function emit(next: string[]): void {
    list = next;
    dispatch("change", next);
  }

  function clearText(): void {
    text = "";
    field?.reset("");
  }

  /** Add the typed text as one chip; true when something was added. */
  function addTyped(): boolean {
    const item = chipItem(text, type);
    clearText();
    if (item === null || list.includes(item)) return false;
    emit([...list, item]);
    return true;
  }

  function remove(index: number): void {
    emit(list.filter((_, i) => i !== index));
    focus();
  }

  function onKeydownCapture(e: KeyboardEvent): void {
    if (e.isComposing) return;
    const swallow = (): void => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === "Enter" || e.key === ",") {
      swallow();
      if (e.key === "Enter" && text.trim() === "") dispatch("done", true);
      else addTyped();
    } else if (e.key === "Backspace" && text === "" && list.length > 0) {
      swallow();
      remove(list.length - 1);
    } else if (e.key === "Escape") {
      swallow();
      if (text !== "") clearText();
      else dispatch("done", true);
    }
  }

  function onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (next && rootEl?.contains(next)) return;
    addTyped();
    dispatch("done", false);
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="ppp-chips"
  bind:this={rootEl}
  on:focusout={onFocusOut}
  on:keydown|capture={onKeydownCapture}
  on:click={focus}
>
  {#each list as item, index}
    <span class="ppp-chips__chip">
      <span class="ppp-chips__text">{label(item)}</span>
      <button
        type="button"
        class="ppp-chips__remove clickable-icon"
        aria-label={t("views.visualizer.block.chips.remove", { item: label(item), defaultValue: "Remove {{item}}" })}
        on:mousedown|preventDefault
        on:click|stopPropagation={() => remove(index)}
      ><Icon name="x" size="xs" /></button>
    </span>
  {/each}
  <TextField
    bind:this={field}
    inputClass="ppp-chips__input"
    ariaLabel={ariaLabel}
    placeholder={t("views.visualizer.block.chips.add", { defaultValue: "Add item" })}
    on:input={(e) => (text = e.detail)}
  />
</div>

<style>
  .ppp-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3em;
    min-height: 2.2em;
    padding: 0.15em 0.45em;
    border-radius: var(--radius-s, 0.3em);
    box-shadow: inset 0 0 0 var(--ppp-border-width) var(--interactive-accent);
    cursor: text;
  }
  .ppp-chips__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.15em;
    max-width: 100%;
    min-height: 1.7em;
    padding: 0 0.15em 0 0.45em;
    border-radius: var(--radius-s, 0.3em);
    background: var(--background-modifier-hover);
  }
  .ppp-chips__text {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .ppp-chips__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5em;
    min-height: 1.5em;
    padding: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .ppp-chips :global(.ppp-chips__input) {
    flex: 1 1 6em;
    min-width: 6em;
    height: 1.9em;
    padding: 0 0.2em;
    background: transparent;
    border: 0;
    box-shadow: none;
    font: inherit;
  }
</style>
