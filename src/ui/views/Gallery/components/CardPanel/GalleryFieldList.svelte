<script lang="ts">
  /**
   * i3-gallery — the «Card» panel's properties, as Notion lists them: the
   * shown ones in card order, each with a drag grip and an eye that hides it;
   * then the hidden ones, each with a crossed eye that shows it. Drag a shown
   * property onto another to take its place; the up/down buttons stay for the
   * keyboard and for touch, where HTML drag and drop does not start. Moved out
   * of GalleryCardPanel (B9) with the drag, so neither file outgrows itself.
   */
  import { Icon } from "obsidian-svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { cardFieldsInOrder, dropIncludedField, moveIncludedField } from "../../galleryOptions";

  export let fields: DataField[];
  export let includeFields: string[];
  /** Receives the next whole `includeFields`. */
  export let onChange: (includeFields: string[]) => void;

  $: shown = cardFieldsInOrder(fields, includeFields);
  $: shownNames = new Set(shown.map((f) => f.name));
  $: hidden = fields.filter((f) => !shownNames.has(f.name));

  function move(name: string, delta: -1 | 1) {
    const present = new Set(fields.map((f) => f.name));
    onChange(moveIncludedField(includeFields, name, delta, (n) => present.has(n)));
  }

  function toggle(name: string) {
    onChange(includeFields.includes(name) ? includeFields.filter((n) => n !== name) : [...includeFields, name]);
  }

  let dragged: string | null = null;
  let over: string | null = null;

  function dragStart(event: DragEvent, name: string) {
    dragged = name;
    event.dataTransfer?.setData("text/plain", name);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  function dragOver(event: DragEvent, name: string) {
    if (dragged === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    over = name;
  }

  function drop(event: DragEvent, name: string) {
    event.preventDefault();
    const from = dragged ?? event.dataTransfer?.getData("text/plain") ?? "";
    dragged = null;
    over = null;
    if (from && from !== name) onChange(dropIncludedField(includeFields, from, name));
  }

  function dragEnd() {
    dragged = null;
    over = null;
  }
</script>

<ol class="ppp-gcp-list" data-gcp-shown>
  {#each shown as field, index (field.name)}
    <li
      data-gcp-field={field.name}
      draggable="true"
      class:ppp-gcp-dragging={dragged === field.name}
      class:ppp-gcp-over={over === field.name && dragged !== field.name}
      on:dragstart={(e) => dragStart(e, field.name)}
      on:dragover={(e) => dragOver(e, field.name)}
      on:dragleave={() => { if (over === field.name) over = null; }}
      on:drop={(e) => drop(e, field.name)}
      on:dragend={dragEnd}
    >
      <span class="ppp-gcp-grip" aria-hidden="true"><Icon name="grip-vertical" size="sm" /></span>
      <span class="ppp-gcp-name">{field.name}</span>
      <button type="button" class="ppp-gcp-btn clickable-icon" data-gcp-action="up" disabled={index === 0}
        aria-label={$i18n.t("settings-menu.view-config.gallery.move-up", { name: field.name })}
        on:click={() => move(field.name, -1)}><Icon name="chevron-up" size="sm" /></button>
      <button type="button" class="ppp-gcp-btn clickable-icon" data-gcp-action="down" disabled={index === shown.length - 1}
        aria-label={$i18n.t("settings-menu.view-config.gallery.move-down", { name: field.name })}
        on:click={() => move(field.name, 1)}><Icon name="chevron-down" size="sm" /></button>
      <button type="button" class="ppp-gcp-btn clickable-icon" data-gcp-action="hide" aria-pressed="true"
        aria-label={$i18n.t("settings-menu.view-config.gallery.remove-field", { name: field.name })}
        on:click={() => toggle(field.name)}><Icon name="eye" size="sm" /></button>
    </li>
  {/each}
</ol>
{#if hidden.length}
  <ul class="ppp-gcp-list ppp-gcp-list--hidden" data-gcp-hidden>
    {#each hidden as field (field.name)}
      <li data-gcp-field={field.name}>
        <span class="ppp-gcp-name">{field.name}</span>
        <button type="button" class="ppp-gcp-btn clickable-icon" data-gcp-action="show" aria-pressed="false"
          aria-label={$i18n.t("settings-menu.view-config.gallery.add-field", { name: field.name })}
          on:click={() => toggle(field.name)}><Icon name="eye-off" size="sm" /></button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .ppp-gcp-list {
    list-style: none;
    margin: 0.25em 0 0;
    padding: 0;
  }
  .ppp-gcp-list li {
    display: flex;
    align-items: center;
    gap: 0.5em;
    min-width: 0;
    border-radius: var(--radius-s);
  }
  .ppp-gcp-list--hidden .ppp-gcp-name {
    color: var(--text-muted);
  }
  .ppp-gcp-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-gcp-grip {
    display: inline-flex;
    color: var(--text-faint);
    cursor: grab;
  }
  .ppp-gcp-btn {
    min-width: var(--ppp-touch-target-min, 2rem);
    min-height: var(--ppp-touch-target-min, 2rem);
  }
  .ppp-gcp-dragging {
    opacity: 0.5;
  }
  .ppp-gcp-over {
    box-shadow: inset 0 0.125em 0 var(--interactive-accent);
  }
</style>
