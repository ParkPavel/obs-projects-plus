<script lang="ts">
  import { produce } from "immer";
  import { Button, Icon, IconButton, TextInput } from "obsidian-svelte";
  import { dndzone } from "svelte-dnd-action";
  import { i18n } from "src/lib/stores/i18n";
  import { tick, onMount } from "svelte";

  export let options: string[];
  export let onChange: (options: string[]) => void;

  type OptionItem = { id: number; value: string };
  
  // Optimize: use stable IDs for better performance with large lists
  let itemIdCounter = 0;
  const itemIdMap = new Map<string, number>();
  
  function getStableId(value: string, index: number): number {
    const key = `${index}:${value}`;
    if (!itemIdMap.has(key)) {
      itemIdMap.set(key, itemIdCounter++);
    }
    return itemIdMap.get(key)!;
  }
  
  $: optionItems = options.map((option, i) => ({
    id: getStableId(option, i),
    value: option,
  }));

  // Performance: debounce for real-time input changes
  let inputDebounceTimers = new Map<number, NodeJS.Timeout>();
  
  function handleOptionAdd() {
    onChange(
      produce(options, (draft) => {
        draft.push("");
      })
    );
    
    // Auto-focus the new input after render
    tick().then(() => {
      const inputs = activeDocument.querySelectorAll<HTMLInputElement>('.multi-text-input');
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.focus();
      }
    });
  }

  function handleOptionRemove(i: number) {
    return () => {
      // Clear any pending debounce for this item
      const timer = inputDebounceTimers.get(i);
      if (timer) {
        clearTimeout(timer);
        inputDebounceTimers.delete(i);
      }
      
      onChange(
        produce(options, (draft) => {
          draft.splice(i, 1);
        })
      );
    };
  }

  const flipDurationMs = 200;

  // Optimize: use input event for instant feedback, blur for final save
  function handleOptionInput(i: number) {
    return (event: Event) => {
      if (event.currentTarget instanceof HTMLInputElement) {
        const value = event.currentTarget.value;
        
        // Clear previous debounce timer
        const existingTimer = inputDebounceTimers.get(i);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        
        // Debounce onChange calls to improve performance
        const timer = setTimeout(() => {
          onChange(
            produce(options, (draft) => {
              draft.splice(i, 1, value);
            })
          );
          inputDebounceTimers.delete(i);
        }, 300); // 300ms debounce
        
        inputDebounceTimers.set(i, timer);
      }
    };
  }

  function handleOptionChange(i: number) {
    return (event: FocusEvent) => {
      // Clear debounce timer and apply immediately on blur
      const timer = inputDebounceTimers.get(i);
      if (timer) {
        clearTimeout(timer);
        inputDebounceTimers.delete(i);
      }
      
      if (event.currentTarget instanceof HTMLInputElement) {
        onChange(
          produce(options, (draft) => {
            if (event.currentTarget instanceof HTMLInputElement) {
              draft.splice(i, 1, event.currentTarget.value);
            }
          })
        );
      }
    };
  }

  function handleDndConsider(e: CustomEvent<DndEvent<OptionItem>>) {
    optionItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<OptionItem>>) {
    onChange(e.detail.items.map((item) => item.value));
  }
  
  // Keyboard shortcuts
  function handleKeyDown(i: number) {
    return (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleOptionAdd();
      } else if (event.key === 'Delete' && event.ctrlKey) {
        event.preventDefault();
        handleOptionRemove(i)();
      }
    };
  }
  
  // Cleanup debounce timers on unmount
  onMount(() => {
    return () => {
      inputDebounceTimers.forEach(timer => clearTimeout(timer));
      inputDebounceTimers.clear();
    };
  });
</script>

<div class="multi-text-container">
  <div
    class="multi-text-list"
    use:dndzone={{
      type: "multi-text",
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
    aria-label="Editable options list"
  >
    {#each optionItems as optionItem, i (optionItem.id)}
      <div class="dnd-item-wrapper" role="listitem">
        <div class="dnd-item">
          <span class="drag-handle" role="button" tabindex="0" title="Drag to reorder">
            <Icon name="grip-vertical" />
          </span>
          <div class="input-wrapper">
            <TextInput
              width="100%"
              value={optionItem.value}
              placeholder={`Option ${i + 1}`}
              on:input={handleOptionInput(i)}
              on:blur={handleOptionChange(i)}
              on:keydown={handleKeyDown(i)}
            />
          </div>
          <IconButton 
            icon="cross" 
            onClick={handleOptionRemove(i)}
            tooltip={`Remove option ${i + 1}`}
          />
        </div>
      </div>
    {/each}
  </div>
  <Button 
    variant="plain" 
    on:click={handleOptionAdd}
    tooltip="Add new option (or press Enter)"
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
    border: 1px solid var(--background-modifier-border);
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
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
  
  .dnd-item:focus-within {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px hsla(var(--interactive-accent-hsl), 0.2);
  }
  
  /* Virtual scrolling optimization for large lists */
  .multi-text-list {
    contain: layout style;
  }
</style>
