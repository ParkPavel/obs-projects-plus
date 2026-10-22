<script lang="ts">
  /**
   * i3-final (B4): «Properties» — the table's fields as one list, the way
   * Notion's view menu shows them. A search box narrows the list; the eye on a
   * row shows or hides that column; the grip reorders by drag, or by the Up and
   * Down arrow keys while it has focus; hidden fields sit in a group of their
   * own, collapsed until opened (or until a search reaches into it).
   *
   * The component owns no setting. It reports a partial `{ fieldConfig }` or
   * `{ orderFields }` and the view tab decides where that is stored — see the
   * rule above the list in ViewConfigTab and `fieldLayout.ts`.
   */
  import { afterUpdate, createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import SearchField from "src/ui/components/fields/SearchField.svelte";
  import { getFieldIcon } from "./filterHelpers";
  import {
    fieldRows,
    matchesFieldQuery,
    reorderShown,
    withHidden,
    type FieldHideConfig,
    type ListedField,
  } from "./fieldListModel";

  export let fields: ListedField[] = [];
  export let fieldConfig: FieldHideConfig = {};
  export let orderFields: string[] = [];

  const dispatch = createEventDispatcher<{
    change: { fieldConfig?: Record<string, Record<string, unknown>>; orderFields?: string[] };
  }>();

  let query = "";
  let hiddenOpen = false;
  let dragName: string | null = null;
  let overName: string | null = null;
  let listEl: HTMLElement | null = null;
  /**
   * The grip that keeps focus across a keyboard move. Reordering a keyed list
   * moves DOM nodes, which drops focus; it is put back once the list shows the
   * field at its new place (the order arrives later, through the parent).
   */
  let pendingFocus: { name: string; index: number } | null = null;

  $: rows = fieldRows(fields, fieldConfig, orderFields);
  $: shownNames = rows.shown.map((f) => f.name);
  $: hiddenNames = rows.hidden.map((f) => f.name);
  $: searching = query.trim() !== "";
  $: shown = rows.shown.filter((f) => matchesFieldQuery(f.name, query));
  $: hidden = rows.hidden.filter((f) => matchesFieldQuery(f.name, query));
  $: hiddenExpanded = hiddenOpen || (searching && hidden.length > 0);

  function setHidden(name: string, hide: boolean) {
    dispatch("change", { fieldConfig: withHidden(fieldConfig, name, hide) });
  }

  function showAll() {
    let next: FieldHideConfig = fieldConfig;
    for (const name of hiddenNames) next = withHidden(next, name, false);
    dispatch("change", { fieldConfig: next as Record<string, Record<string, unknown>> });
  }

  function moveTo(name: string, to: number) {
    if (to < 0 || to >= shownNames.length || shownNames.indexOf(name) === to) return;
    dispatch("change", { orderFields: reorderShown(shownNames, hiddenNames, name, to) });
  }

  function onGripKey(name: string, e: KeyboardEvent) {
    if (searching || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const to = shownNames.indexOf(name) + (e.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= shownNames.length) return;
    pendingFocus = { name, index: to };
    moveTo(name, to);
  }

  afterUpdate(() => {
    if (!pendingFocus || !listEl || shownNames.indexOf(pendingFocus.name) !== pendingFocus.index) return;
    const name = pendingFocus.name;
    pendingFocus = null;
    const row = Array.from(listEl.querySelectorAll<HTMLElement>("[data-view-property]")).find((el) => el.dataset["viewProperty"] === name);
    const grip = row?.querySelector<HTMLElement>("[data-property-grip]");
    if (grip && document.activeElement !== grip) grip.focus();
  });

  function onDragStart(name: string, e: DragEvent) {
    dragName = name;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(name: string, e: DragEvent) {
    if (dragName === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    overName = name;
  }

  function onDrop(name: string, e: DragEvent) {
    e.preventDefault();
    const moved = dragName;
    dragName = null;
    overName = null;
    if (moved !== null && moved !== name) moveTo(moved, shownNames.indexOf(name));
  }

  function onDragEnd() {
    dragName = null;
    overName = null;
  }
</script>

<div class="ppp-props" data-view-properties>
  <span class="ppp-props-label">{$i18n.t("settings-menu.view-config.table.properties")}</span>
  <span class="ppp-props-hint">{$i18n.t("settings-menu.view-config.table.hints.properties")}</span>
  <SearchField
    {query}
    placeholder={$i18n.t("settings-menu.view-config.table.search-properties")}
    ariaLabel={$i18n.t("settings-menu.view-config.table.search-properties")}
    inputClass="ppp-props-search"
    on:queryChange={(e) => (query = e.detail)}
  />

  <ol class="ppp-props-list" bind:this={listEl} aria-label={$i18n.t("settings-menu.view-config.table.shown-fields")}>
    {#each shown as field (field.name)}
      <li
        class="ppp-prop"
        class:ppp-prop--over={overName === field.name && dragName !== field.name}
        data-view-property={field.name}
        draggable={!searching}
        on:dragstart={(e) => onDragStart(field.name, e)}
        on:dragover={(e) => onDragOver(field.name, e)}
        on:drop={(e) => onDrop(field.name, e)}
        on:dragend={onDragEnd}
      >
        <button
          type="button"
          class="ppp-prop-btn ppp-prop-grip"
          data-property-grip
          disabled={searching}
          aria-label={$i18n.t("settings-menu.view-config.table.move-field", { name: field.name })}
          title={$i18n.t("settings-menu.view-config.table.move-field", { name: field.name })}
          on:keydown={(e) => onGripKey(field.name, e)}
        ><Icon name="grip-vertical" size="sm" /></button>
        <span class="ppp-prop-kind" aria-hidden="true"><Icon name={getFieldIcon(field.type)} size="sm" /></span>
        <span class="ppp-prop-name">{field.name}</span>
        <button
          type="button"
          class="ppp-prop-btn"
          data-property-action="hide"
          aria-pressed="true"
          disabled={field.name === rows.primary}
          aria-label={field.name === rows.primary
            ? $i18n.t("settings-menu.view-config.table.primary-field")
            : $i18n.t("settings-menu.view-config.table.hide-field", { name: field.name })}
          title={field.name === rows.primary
            ? $i18n.t("settings-menu.view-config.table.primary-field")
            : $i18n.t("settings-menu.view-config.table.hide-field", { name: field.name })}
          on:click={() => setHidden(field.name, true)}
        ><Icon name="eye" size="sm" /></button>
      </li>
    {/each}
  </ol>

  {#if rows.hidden.length > 0}
    <button
      type="button"
      class="ppp-props-group"
      data-property-group="hidden"
      aria-expanded={hiddenExpanded}
      on:click={() => (hiddenOpen = !hiddenOpen)}
    >
      <Icon name={hiddenExpanded ? "chevron-down" : "chevron-right"} size="sm" />
      <span>{$i18n.t("settings-menu.view-config.table.hidden-fields")}</span>
      <span class="ppp-props-count">{rows.hidden.length}</span>
    </button>
    {#if hiddenExpanded}
      <ul class="ppp-props-list" data-property-hidden-list>
        {#each hidden as field (field.name)}
          <li class="ppp-prop ppp-prop--hidden" data-view-property={field.name}>
            <span class="ppp-prop-kind" aria-hidden="true"><Icon name={getFieldIcon(field.type)} size="sm" /></span>
            <span class="ppp-prop-name">{field.name}</span>
            <button
              type="button"
              class="ppp-prop-btn"
              data-property-action="show"
              aria-pressed="false"
              aria-label={$i18n.t("settings-menu.view-config.table.show-field", { name: field.name })}
              title={$i18n.t("settings-menu.view-config.table.show-field", { name: field.name })}
              on:click={() => setHidden(field.name, false)}
            ><Icon name="eye-off" size="sm" /></button>
          </li>
        {/each}
      </ul>
      <button type="button" class="ppp-props-show-all" data-property-action="show-all" on:click={showAll}>
        {$i18n.t("settings-menu.view-config.table.show-all")}
      </button>
    {/if}
  {/if}

  {#if searching && shown.length === 0 && hidden.length === 0}
    <p class="ppp-props-empty" data-property-empty>{$i18n.t("settings-menu.view-config.table.no-matching-properties")}</p>
  {/if}
</div>

<style>
  .ppp-props {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    min-width: 0;
  }
  .ppp-props-label {
    font-size: var(--font-ui-small);
    font-weight: 500;
  }
  .ppp-props-hint,
  .ppp-props-empty {
    margin: 0;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }
  .ppp-props-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125em;
  }
  /* One line per field: grip, kind, the name taking what is left, the eye. */
  .ppp-prop {
    display: flex;
    align-items: center;
    gap: 0.375em;
    min-width: 0;
    min-height: 2em;
    padding: 0 0.25em;
    border-radius: var(--radius-s);
    border-top: var(--ppp-border-width) solid transparent;
  }
  .ppp-prop--over {
    border-top-color: var(--interactive-accent);
  }
  .ppp-prop-kind {
    display: inline-flex;
    flex: none;
    color: var(--text-muted);
  }
  .ppp-prop-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-ui-small);
  }
  .ppp-prop--hidden .ppp-prop-name {
    color: var(--text-muted);
  }
  .ppp-prop-btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2em;
    height: 2em;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .ppp-prop-grip {
    cursor: grab;
  }
  .ppp-prop-btn:disabled {
    cursor: default;
    color: var(--text-faint);
  }
  .ppp-props-group {
    display: flex;
    align-items: center;
    gap: 0.375em;
    margin-top: 0.25em;
    padding: 0.25em;
    border: none;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
    text-align: left;
  }
  .ppp-props-count {
    color: var(--text-muted);
  }
  .ppp-props-show-all {
    align-self: flex-start;
    font-size: var(--font-ui-smaller);
  }

  @media (hover: hover) and (pointer: fine) {
    .ppp-prop:hover {
      background: var(--background-modifier-hover);
    }
    .ppp-prop-btn:not(:disabled):hover,
    .ppp-props-group:hover {
      color: var(--text-normal);
    }
  }

  /* A finger needs a target-sized row and buttons. HTML drag never starts from
     touch, and a grip a finger cannot use is a promise, so it steps aside. */
  @media (pointer: coarse) {
    .ppp-prop {
      min-height: var(--ppp-touch-target-min);
    }
    .ppp-prop-grip {
      display: none;
    }
    .ppp-prop-btn,
    .ppp-props-group {
      min-width: var(--ppp-touch-target-min);
      min-height: var(--ppp-touch-target-min);
    }
  }
</style>
