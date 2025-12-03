<script lang="ts">
  import InternalLink from "src/ui/components/InternalLink.svelte";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  import Event from "./Event.svelte";
  import { dndzone } from "svelte-dnd-action";
  import { app } from "src/lib/stores/obsidian";
  import type {
    DataRecord,
    DataValue,
    Optional,
  } from "src/lib/dataframe/dataframe";
  import { getRecordColorContext, handleHoverLink } from "src/ui/views/helpers";
  import { settings } from "src/lib/stores/settings";

  export let records: DataRecord[];
  export let checkField: string | undefined;

  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;
  export let onRecordChange: ((record: DataRecord) => void) | undefined;
  
  /**
   * Disable drag and drop (for mobile)
   */
  export let disableDrag: boolean = false;

  function asOptionalBoolean(value: Optional<DataValue>): Optional<boolean> {
    if (typeof value === "boolean") {
      return value;
    }
    return null;
  }

  const flipDurationMs = 150;

  function handleDndConsider(e: CustomEvent<DndEvent<DataRecord>>) {
    if (disableDrag) return;
    records = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<DataRecord>>) {
    if (disableDrag) return;
    records = e.detail.items;
    records.forEach(r => onRecordChange?.(r));
  }

  const getRecordColor = getRecordColorContext.get();
  
  // DnD zone options - only when enabled
  $: dndOptions = {
    type: "entries",
    items: records,
    flipDurationMs,
    dropTargetStyle: {
      outline: "none",
      borderRadius: "8px",
      background: "hsla(var(--interactive-accent-hsl), 0.15)",
    },
    dropTargetClasses: ["drop-target-active"],
  };
</script>

{#if disableDrag}
  <!-- Mobile: no drag and drop -->
  <div class="event-list mobile">
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
            on:open={({ detail: { linkText, sourcePath, newLeaf } }) => {
              if (newLeaf) {
                $app.workspace.openLinkText(linkText, sourcePath, true);
              } else {
                let openEditor =
                  $settings.preferences.linkBehavior == "open-editor";
                if (openEditor) {
                  onRecordClick?.(record);
                } else {
                  $app.workspace.openLinkText(linkText, sourcePath, false);
                }
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
{:else}
  <!-- Desktop: with drag and drop -->
  <div
    class="event-list"
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
            on:open={({ detail: { linkText, sourcePath, newLeaf } }) => {
              if (newLeaf) {
                $app.workspace.openLinkText(linkText, sourcePath, true);
              } else {
                let openEditor =
                  $settings.preferences.linkBehavior == "open-editor";
                if (openEditor) {
                  onRecordClick?.(record);
                } else {
                  $app.workspace.openLinkText(linkText, sourcePath, false);
                }
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
{/if}

<style>
  .event-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 auto;
    min-height: 40px;
    width: 100%;
    overflow: visible;
    padding: 2px;
    border-radius: 6px;
    transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .event-list.mobile {
    pointer-events: none; /* Let taps pass through to parent */
  }

  .event-list.mobile :global(*) {
    pointer-events: auto;
  }

  .event-list:empty {
    min-height: 24px;
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
