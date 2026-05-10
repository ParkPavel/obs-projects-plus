<script lang="ts">
  import { Button, Icon } from "obsidian-svelte";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import CardGroup from "./CardList.svelte";
  import ColumnHeader from "./ColumnHeader.svelte";
  import type {
    OnRecordClick,
    OnRecordCheck,
    OnRecordDrop,
    OnColumnCollapse,
  } from "./types";
  import { openContextMenu } from "src/lib/contextMenu";

  export let width: number;

  export let name: string;
  export let records: DataRecord[];
  export let readonly: boolean;
  export let richText: boolean;
  export let checkField: string | undefined;
  export let includeFields: DataField[];
  export let customHeader: DataField | undefined;
  export let iconField: DataField | undefined = undefined;
  export let pinned: boolean;
  export let collapse: boolean;
  export let persisted: boolean;

  export let onDrop: OnRecordDrop;
  export let onRecordClick: OnRecordClick;
  export let onRecordCheck: OnRecordCheck;
  export let onRecordAdd: () => void;
  export let onColumnPin: (name: string) => void;
  export let onColumnPersist: (name: string) => void;
  export let onColumnCollapse: OnColumnCollapse;
  export let onColumnDelete: (name: string, records: DataRecord[]) => void;
  export let onColumnRename: (name: string) => void;
  export let onValidate: (name: string) => boolean;

  let editing: boolean = false;

  export let boardEditing: boolean = false;
  export let onEdit: (editing: boolean) => void;
  $: onEdit(editing);

  $: count = records.length;
  $: checkedCount = records.filter((r) => r.values[checkField ?? ""]).length;

  function onColumnMenu(event: MouseEvent) {
    openContextMenu([
      {
        title: $i18n.t("components.board.column.rename"),
        icon: "edit",
        onClick: () => { editing = true; },
      },
      {
        title: collapse
          ? $i18n.t("components.board.column.expand")
          : $i18n.t("components.board.column.collapse"),
        icon: collapse ? "chevrons-left-right" : "chevrons-right-left",
        onClick: () => { onColumnCollapse(name); },
      },
      {
        title: pinned
          ? $i18n.t("components.board.column.unpin")
          : $i18n.t("components.board.column.pin"),
        icon: pinned ? "pin-off" : "pin",
        onClick: () => { onColumnPin(name); },
      },
      {
        title: persisted
          ? $i18n.t("components.board.column.unpersist")
          : $i18n.t("components.board.column.persist"),
        icon: persisted ? "bookmark-minus" : "bookmark-plus",
        onClick: () => { onColumnPersist(name); },
      },
      ...(name !== $i18n.t("views.board.no-status")
        ? [
            { separator: true as const },
            {
              title: $i18n.t("components.board.column.delete"),
              icon: "trash-2",
              danger: true,
              onClick: () => { onColumnDelete(name, records); },
            },
          ]
        : []),
    ], event);
  }
</script>

<section
  data-id={name}
  class="projects--board--column"
  class:collapse
  class:pinned
  class:persisted
  style={`width: ${width}px; min-width: ${width}px; max-width: ${width}px;${collapse ? ` margin-right: ${48 - width}px;` : ''}`}
>
  <ColumnHeader
    value={name}
    {count}
    {checkedCount}
    bind:editing
    {richText}
    {collapse}
    {pinned}
    {persisted}
    {checkField}
    {onColumnMenu}
    {onColumnRename}
    onColumnPin={() => onColumnPin(name)}
    onColumnPersist={() => onColumnPersist(name)}
    onColumnCollapse={() => onColumnCollapse(name)}
    {onValidate}
  />

  {#if !collapse}
    <CardGroup
      items={records}
      {boardEditing}
      disableDnd={pinned}
      {customHeader}
      {iconField}
      {onRecordClick}
      {checkField}
      {onRecordCheck}
      {onDrop}
      {includeFields}
    />
    <!-- C18: aggregation footer -->
    <div class="projects--board--column-footer">
      <span class="projects--board--column-footer-count">
        {count}
        {$i18n.t("views.board.records", { count, defaultValue: count === 1 ? "record" : "records" })}
        {#if checkField && checkedCount > 0}
          · {checkedCount} ✓
        {/if}
      </span>
    </div>
    {#if !readonly}
      <span>
        <Button variant="plain" on:click={() => onRecordAdd()}>
          <Icon name="plus" />
          {$i18n.t("views.board.note.add")}
        </Button>
      </span>
    {/if}
  {/if}
</section>

<style>
  .projects--board--column-footer {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .projects--board--column-footer-count {
    font-size: 0.75rem;
    color: var(--text-faint);
    user-select: none;
  }

  span {
    display: inline-flex;
    align-content: center;
    justify-content: center;
    border-radius: var(--button-radius);
  }

  span:focus-within {
    box-shadow: 0 0 0 0.125rem var(--background-modifier-border-focus);
  }

  .collapse {
    transform: rotate(-90deg) translateX(-100%);
    transform-origin: left top 0px;
    height: 3rem;
    overflow: hidden;
  }

  .pinned {
    border-left: 0.125rem solid var(--interactive-accent);
    background: color-mix(in srgb, var(--background-primary) 92%, var(--interactive-accent) 8%);
  }

  .persisted:not(.pinned) {
    border-left: 0.125rem solid var(--text-faint);
    background: color-mix(in srgb, var(--background-primary) 96%, var(--text-faint) 4%);
  }

  .pinned.persisted {
    border-left: 0.125rem solid var(--interactive-accent);
  }
</style>
