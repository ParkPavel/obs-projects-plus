<script lang="ts">
  import InternalLink from "src/ui/components/InternalLink.svelte";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  import Event from "./Event.svelte";
  import { dndzone } from "svelte-dnd-action";
  import { app } from "src/lib/stores/obsidian";
  import { createEventDispatcher } from "svelte";
  import type {
    DataRecord,
    DataValue,
    Optional,
  } from "src/lib/dataframe/dataframe";
  import { getRecordColorContext, handleHoverLink } from "src/ui/views/helpers";

  import { hapticDrop } from "../../dnd/HapticManager";

  export let records: DataRecord[];
  export let checkField: string | undefined;

  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;
  
  /**
   * v3.2.0 Iteration 6: Mobile flag — enables touch delay for DnD
   */
  export let isMobile: boolean = false;

  function asOptionalBoolean(value: Optional<DataValue>): Optional<boolean> {
    if (typeof value === "boolean") {
      return value;
    }
    return null;
  }

  const flipDurationMs = 150;

  function handleDndConsider(e: CustomEvent<DndEvent<DataRecord>>) {
    records = e.detail.items;
    dispatch("dndConsider", e.detail);
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<DataRecord>>) {
    records = e.detail.items;
    if (isMobile) { hapticDrop(); }
    // Date changes are handled by Day.svelte's on:dndFinalize handler,
    // which correctly passes the target date to CalendarView.handleRecordChange.
    dispatch("dndFinalize", e.detail);
  }

  const getRecordColor = getRecordColorContext.get();

  const dispatch = createEventDispatcher();
  
  // v3.2.0 Iteration 6: DnD always enabled; touch uses long-press delay
  $: dndOptions = {
    type: "entries",
    items: records,
    flipDurationMs,
    ...(isMobile ? { dropFromOthersDisabled: false, dragDisabled: false } : {}),
    dropTargetStyle: {
      outline: "none",
      borderRadius: "8px",
      background: "hsla(var(--interactive-accent-hsl), 0.15)",
    },
    dropTargetClasses: ["drop-target-active"],
  };
</script>

<!-- v3.2.0 Iteration 6: Always use dndzone (mobile uses touch delay via svelte-dnd-action) -->
<div
  class="event-list"
  class:mobile={isMobile}
  use:dndzone={dndOptions}
  on:consider={handleDndConsider}
  on:finalize={handleDndFinalize}
>
  {#each records as record (record.id)}
    {#if getDisplayName(record.id)}
      <Event
        color={getRecordColor(record)}
        checked={checkField !== undefined
          ? asOptionalBoolean(record.values[checkField])
          : undefined}
        on:check={({ detail: checked }) => onRecordCheck?.(record, checked)}
      >
        <InternalLink
          linkText={record.id}
          sourcePath={record.id}
          resolved
          tooltip={getDisplayName(record.id)}
          on:open={({ detail: { linkText, sourcePath, newLeaf, shiftKey } }) => {
            // v3.0.8: Unified note navigation — Shift → new window, Ctrl → new tab, else → modal
            if (shiftKey) {
              $app.workspace.openLinkText(linkText, sourcePath, 'window');
            } else if (newLeaf) {
              $app.workspace.openLinkText(linkText, sourcePath, 'tab');
            } else {
              onRecordClick?.(record);
            }
          }}
          on:hover={({ detail: { event, sourcePath } }) => {
            handleHoverLink(event, sourcePath);
          }}
        >
          {getDisplayName(record.id)}
        </InternalLink>
      </Event>
    {/if}
  {/each}
</div>

<style>
  .event-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1 1 auto;
    min-height: 2.5rem;
    width: 100%;
    overflow: hidden;
    padding: 0.125rem;
    border-radius: 0.375rem;
    transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .event-list.mobile {
    touch-action: manipulation; /* Prevent double-tap zoom while allowing DnD */
  }

  .event-list:empty {
    min-height: 1.5rem;
  }

  /* DnD active state */
  :global(.drop-target-active) {
    background: hsla(var(--interactive-accent-hsl), 0.08) !important;
  }

  /* Dragging item style */
  .event-list :global([data-is-dragged]) {
    opacity: 0.9;
    transform: scale(1.02);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 100;
  }
</style>
