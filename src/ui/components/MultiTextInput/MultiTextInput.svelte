<script context="module" lang="ts">
  let nextEditor = 0;
</script>
<script lang="ts">
  import { Button, Icon } from "obsidian-svelte";
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { dndzone, TRIGGERS, SHADOW_ITEM_MARKER_PROPERTY_NAME, SHADOW_PLACEHOLDER_ITEM_ID } from "svelte-dnd-action";
  import { i18n } from "src/lib/stores/i18n";
  import { tick, onDestroy } from "svelte";

  export let options: string[];
  export let onChange: (options: string[]) => void;
  export let contextKey = "";
  export let disabled = false;
  type OptionItem = { id: number | string; value: string };
  const zoneType = "ppp-options-" + ++nextEditor;
  const flipDurationMs = 200;
  let nextId = 0, revision = 0, alive = true;
  let root: HTMLDivElement;
  const composing = new Set<OptionItem["id"]>();
  const makeItems = (values: string[]): OptionItem[] => values.map(value => ({ id: nextId++, value }));
  const equal = (a: string[], b: string[]) => a.length === b.length && a.every((value, i) => value === b[i]);
  let savedItems = makeItems(options), optionItems = savedItems;
  let source = options, sourceValues = [...options], savedValues = [...options];
  let owner = contextKey, writer = onChange, locked = disabled;
  const isShadow = (item: OptionItem) => Boolean((item as Record<string, unknown>)[SHADOW_ITEM_MARKER_PROPERTY_NAME]) || item.id === SHADOW_PLACEHOLDER_ITEM_ID;

  // Acknowledged edits retain IDs/DOM; a different source or owner ends that draft.
  function reset(next: string[]) {
    source = next; sourceValues = [...next]; savedValues = [...next];
    savedItems = makeItems(next); optionItems = savedItems;
    composing.clear(); revision++;
  }
  function sync(next: string[], key: string, callback: typeof onChange, isLocked: boolean) {
    if (owner !== key || writer !== callback || locked !== isLocked) reset(next);
    else if (next !== source || !equal(next, sourceValues)) {
      source = next; sourceValues = [...next];
      if (!equal(next, savedValues)) reset(next);
    }
    owner = key; writer = callback; locked = isLocked;
  }
  $: sync(options, contextKey, onChange, disabled);
  const refresh = () => sync(options, contextKey, onChange, disabled);
  function publish(items: OptionItem[]) {
    if (!alive || disabled) return;
    savedItems = items; optionItems = items;
    const next = items.map(item => item.value);
    if (equal(next, savedValues)) return;
    savedValues = [...next]; onChange(next);
  }
  function commit(id: OptionItem["id"], value: string) {
    refresh();
    if (!savedItems.some(item => item.id === id)) return;
    publish(savedItems.map(item => item.id === id ? { ...item, value } : item));
  }
  function handleOptionAdd() {
    refresh(); if (!alive || disabled) return;
    const item = { id: nextId++, value: "" }, epoch = revision;
    publish([...savedItems, item]);
    void tick().then(() => {
      if (alive && !disabled && epoch === revision && savedItems.some(current => current.id === item.id)) {
        root?.querySelector<HTMLInputElement>('[data-option-id="' + item.id + '"] input')?.focus();
      }
    });
  }
  function remove(id: OptionItem["id"]) {
    refresh(); if (!savedItems.some(item => item.id === id)) return;
    composing.delete(id); publish(savedItems.filter(item => item.id !== id));
  }
  function handleKeyDown(id: OptionItem["id"], event: KeyboardEvent) {
    refresh();
    if (disabled || !savedItems.some(item => item.id === id) || composing.has(id) || isImeKey(event)) return;
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleOptionAdd(); }
    else if (event.key === "Delete" && event.ctrlKey) { event.preventDefault(); remove(id); }
  }
  function ownItems(items: OptionItem[], draggedId?: string | number): boolean {
    const ids = items.map(item => item.id === SHADOW_PLACEHOLDER_ITEM_ID ? draggedId : item.id);
    return ids.length === savedItems.length && new Set(ids).size === ids.length && ids.every(id => savedItems.some(item => item.id === id));
  }
  function handleDndConsider(event: CustomEvent<DndEvent<OptionItem>>) {
    refresh();
    if (disabled || !ownItems(event.detail.items, event.detail.info?.id)) return;
    optionItems = event.detail.info?.trigger === TRIGGERS.DRAG_STOPPED ? savedItems : event.detail.items;
  }
  function handleDndFinalize(event: CustomEvent<DndEvent<OptionItem>>) {
    refresh();
    const items = event.detail.items;
    if (disabled || items.some(isShadow) || !ownItems(items)) { optionItems = savedItems; return; }
    // Only identities come from the drag event; values come from the current owner.
    publish(items.map(item => savedItems.find(saved => saved.id === item.id)!));
  }
  onDestroy(() => { alive = false; revision++; composing.clear(); });
</script>

<div class="multi-text-container" bind:this={root}>
  <div
    class="multi-text-list"
    use:dndzone={{
      type: zoneType,
      dropFromOthersDisabled: true,
      dragDisabled: disabled,
      items: optionItems,
      flipDurationMs,
      dropTargetStyle: {
        outline: "none",
        borderRadius: "var(--radius-s)",
        background: "hsla(var(--interactive-accent-hsl), 0.3)",
        transition: "all 150ms ease-in-out",
      },
    }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
    role="list"
    aria-label={$i18n.t("components.multi-text-input.list")}
  >
    {#each optionItems as optionItem, i (optionItem.id)}
      <div class="dnd-item-wrapper" role="listitem" data-option-id={optionItem.id}
        on:compositionstart={() => composing.add(optionItem.id)}
        on:compositionend={() => composing.delete(optionItem.id)}>
        <div class="dnd-item">
          <span class="drag-handle" role="button" tabindex="0" title={$i18n.t("common.drag-to-reorder")}>
            <Icon name="grip-vertical" />
          </span>
          <div class="input-wrapper">
            <TextField
              value={optionItem.value}
              disabled={disabled || isShadow(optionItem)}
              placeholder={$i18n.t("components.multi-text-input.option", { index: i + 1 })}
              ariaLabel={$i18n.t("components.multi-text-input.option", { index: i + 1 })}
              on:commit={({ detail }) => commit(optionItem.id, detail.value)}
              on:keydown={(event) => handleKeyDown(optionItem.id, event)}
            />
          </div>
          <IconButton 
            icon="cross" 
            onClick={() => remove(optionItem.id)}
            {disabled}
            tooltip={$i18n.t("components.multi-text-input.remove-option", { index: i + 1 })}
          />
        </div>
      </div>
    {/each}
  </div>
  <Button 
    variant="plain" 
    on:click={handleOptionAdd}
    {disabled}
    tooltip={$i18n.t("components.multi-text-input.add-option")}
  >
    <Icon name="plus" />
    {$i18n.t("components.multi-text.add")}
  </Button>
  {#if optionItems.length > 5}
    <div class="item-count" role="status" aria-live="polite">
      {optionItems.length} {optionItems.length === 1 ? 'option' : 'options'}
    </div>
  {/if}
</div>

<style>
  .multi-text-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }
  
  .multi-text-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    min-height: 2rem;
  }
  
  .dnd-item-wrapper {
    width: 100%;
    will-change: transform;
  }
  
  .dnd-item {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.375rem;
    border-radius: var(--radius-s);
    background: var(--background-primary);
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    transition: all 0.15s ease;
  }
  
  .dnd-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: grab;
    flex-shrink: 0;
    padding: 0.25rem;
    border-radius: var(--radius-s);
    transition: all 0.15s ease;
  }
  
  .drag-handle:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
  
  .drag-handle:active {
    cursor: grabbing;
  }
  
  .input-wrapper {
    flex: 1;
    min-width: 0;
  }
  
  .input-wrapper :global(.text-input-wrapper) {
    width: 100%;
  }
  
  .input-wrapper :global(input) {
    width: 100%;
  }
  
  .item-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: right;
    padding: 0.25rem 0.5rem;
    font-style: italic;
  }
  
  /* Performance optimization: use transform for animations */
  .dnd-item-wrapper {
    transform: translateZ(0);
  }
  
  /* Mobile responsive styles */
  @media (max-width: 48em) {
    .dnd-item {
      padding: 0.5rem;
      gap: 0.625rem;
    }
    
    .drag-handle {
      padding: 0.375rem;
      min-width: 2.25rem;
      min-height: 2.25rem;
    }
    
    .dnd-item :global(.icon-button) {
      min-width: 2.25rem;
      min-height: 2.25rem;
    }
    
    .input-wrapper :global(input) {
      font-size: 1rem;
      padding: 0.625rem;
    }
    
    .item-count {
      font-size: 0.6875rem;
    }
  }
  
  /* Touch-friendly spacing for tablets */
  @media (min-width: 48.0625em) and (max-width: 64em) {
    .dnd-item {
      padding: 0.5rem;
    }
    
    .drag-handle {
      padding: 0.3125rem;
      min-width: 2rem;
      min-height: 2rem;
    }
  }
  
  /* Accessibility: focus styles */
  .drag-handle:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.125rem;
  }
  
  .dnd-item:focus-within {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 0.125rem hsla(var(--interactive-accent-hsl), 0.2);
  }
  
  /* Virtual scrolling optimization for large lists */
  .multi-text-list {
    contain: layout style;
  }
</style>
