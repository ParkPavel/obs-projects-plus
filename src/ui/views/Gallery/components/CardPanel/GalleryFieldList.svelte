<script lang="ts">
  /**
   * i3-gallery — the «Card» panel's properties, as Notion lists them: the
   * shown ones in card order, each with a grip (≡) and an eye that hides it;
   * then the hidden ones, each with a crossed eye that shows it. Drag a shown
   * property by its grip onto another to take its place — with a mouse or a
   * finger (reorderGrip, w4-p06; HTML drag never started from touch); the
   * up/down buttons stay for the keyboard. Moved out of GalleryCardPanel (B9)
   * with the drag, so neither file outgrows itself.
   */
  import { Icon } from "obsidian-svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { reorderGrip } from "src/ui/actions/reorderGrip";
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

  let listEl: HTMLElement | null = null;
  let dragged: string | null = null;
  let over: string | null = null;

  const shownRows = (): HTMLElement[] => Array.from(listEl?.querySelectorAll<HTMLElement>("[data-gcp-field]") ?? []);
  const rowName = (row: HTMLElement): string | undefined => row.dataset["gcpField"];

  function dropOn(name: string, to: number) {
    const target = shown[to]?.name;
    if (target && target !== name) onChange(dropIncludedField(includeFields, name, target));
  }
</script>

<ol class="ppp-gcp-list" data-gcp-shown bind:this={listEl}>
  {#each shown as field, index (field.name)}
    <li
      data-gcp-field={field.name}
      class:ppp-gcp-dragging={dragged === field.name}
      class:ppp-gcp-over={over === field.name && dragged !== field.name}
    >
      <span
        class="ppp-gcp-grip"
        aria-hidden="true"
        data-gcp-grip
        use:reorderGrip={{
          key: field.name,
          rows: shownRows,
          keyOf: rowName,
          onMove: dropOn,
          onOver: (name) => { over = name; dragged = name === null ? null : field.name; },
        }}
      ><Icon name="menu" size="sm" /></span>
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
    align-items: center;
    justify-content: center;
    min-width: var(--ppp-touch-target-min, 2rem);
    min-height: var(--ppp-touch-target-min, 2rem);
    color: var(--text-faint);
    cursor: grab;
    /* A finger on the grip drags the row, it does not scroll the panel. */
    touch-action: none;
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
