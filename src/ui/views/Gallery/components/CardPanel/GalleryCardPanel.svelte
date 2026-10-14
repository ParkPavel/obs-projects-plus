<script lang="ts">
  /**
   * B9 — the gallery's own «Card» panel, opened from the gallery itself (the
   * Notion "Layout / Properties" pattern): cover field and fit, card size,
   * layout and the visible properties in their order. It writes the very keys
   * the view settings tab writes (ViewConfigTab.svelte), through the same
   * normaliser and the same order helpers, so the two never disagree; it holds
   * no state of its own beyond what the config says. Every control is a button
   * or a select (no raw text input), and nothing appears only on hover.
   */
  import { Icon } from "obsidian-svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import type { GalleryConfig } from "../../types";
  import {
    GALLERY_LAYOUTS,
    GALLERY_SIZE_PRESETS,
    cardFieldsInOrder,
    moveIncludedField,
    normalizeGalleryConfig,
    sizePresetOf,
    type GallerySizePreset,
  } from "../../galleryOptions";

  export let fields: DataField[];
  export let config: GalleryConfig | undefined;
  /** Receives the next whole config; the view saves it and re-renders. */
  export let onChange: (next: GalleryConfig) => void;
  export let onClose: () => void;

  $: options = normalizeGalleryConfig(config);
  $: preset = sizePresetOf(options.cardWidth);
  $: shown = cardFieldsInOrder(fields, options.includeFields);
  $: shownNames = new Set(shown.map((f) => f.name));
  $: hidden = fields.filter((f) => !shownNames.has(f.name));
  // The cover is a path or a link: the same text-like fields the settings tab offers.
  $: coverCandidates = fields.filter((f) => ["string", "String", "text"].includes(f.type));
  const presets = Object.keys(GALLERY_SIZE_PRESETS) as GallerySizePreset[];

  function patch(next: Partial<Record<keyof GalleryConfig, unknown>>) {
    onChange({ ...(config ?? {}), ...next } as GalleryConfig);
  }

  function move(name: string, delta: -1 | 1) {
    const present = new Set(fields.map((f) => f.name));
    patch({ includeFields: moveIncludedField(options.includeFields, name, delta, (n) => present.has(n)) });
  }

  function toggle(name: string) {
    patch({
      includeFields: options.includeFields.includes(name)
        ? options.includeFields.filter((n) => n !== name)
        : [...options.includeFields, name],
    });
  }
</script>

<section class="ppp-gallery-card-panel" data-gallery-card-panel aria-label={$i18n.t("views.gallery.card-panel.title")}>
  <header class="ppp-gcp-head">
    <span class="ppp-gcp-title">{$i18n.t("views.gallery.card-panel.title")}</span>
    <button type="button" class="ppp-gcp-btn clickable-icon" data-gcp-close aria-label={$i18n.t("views.gallery.card-panel.close")} on:click={onClose}>
      <Icon name="x" size="sm" />
    </button>
  </header>

  <div class="ppp-gcp-row">
    <span class="ppp-gcp-label">{$i18n.t("settings-menu.view-config.gallery.layout")}</span>
    <div class="ppp-gcp-seg" role="group" aria-label={$i18n.t("settings-menu.view-config.gallery.layout")}>
      {#each GALLERY_LAYOUTS as layout}
        <button type="button" data-gcp-layout={layout} aria-pressed={options.layout === layout} on:click={() => patch({ layout })}>
          {$i18n.t(`settings-menu.view-config.gallery.layout-options.${layout}`)}
        </button>
      {/each}
    </div>
  </div>

  <div class="ppp-gcp-row">
    <span class="ppp-gcp-label">{$i18n.t("settings-menu.view-config.gallery.card-size")}</span>
    <div class="ppp-gcp-seg" role="group" aria-label={$i18n.t("settings-menu.view-config.gallery.card-size")}>
      {#each presets as p}
        <button type="button" data-gcp-size={p} aria-pressed={preset === p} on:click={() => patch({ cardWidth: GALLERY_SIZE_PRESETS[p] })}>
          {$i18n.t(`settings-menu.view-config.gallery.size-options.${p}`)}
        </button>
      {/each}
    </div>
  </div>

  <div class="ppp-gcp-row">
    <label class="ppp-gcp-label" for="ppp-gcp-cover">{$i18n.t("views.gallery.card-panel.cover")}</label>
    <select
      id="ppp-gcp-cover"
      class="dropdown"
      data-gcp-cover
      value={options.coverField ?? ""}
      on:change={(e) => patch({ coverField: e.currentTarget.value || undefined })}
    >
      <option value="">{$i18n.t("views.gallery.fields.none")}</option>
      {#each coverCandidates as field (field.name)}
        <option value={field.name}>{field.name}</option>
      {/each}
    </select>
  </div>

  {#if options.coverField}
    <div class="ppp-gcp-row">
      <span class="ppp-gcp-label">{$i18n.t("settings-menu.view-config.gallery.fit-style")}</span>
      <div class="ppp-gcp-seg" role="group" aria-label={$i18n.t("settings-menu.view-config.gallery.fit-style")}>
        <button type="button" data-gcp-fit="cover" aria-pressed={options.fitStyle === "cover"} on:click={() => patch({ fitStyle: "cover" })}>
          {$i18n.t("settings-menu.view-config.gallery.fit-options.fill")}
        </button>
        <button type="button" data-gcp-fit="contain" aria-pressed={options.fitStyle === "contain"} on:click={() => patch({ fitStyle: "contain" })}>
          {$i18n.t("settings-menu.view-config.gallery.fit-options.fit")}
        </button>
      </div>
    </div>
  {/if}

  <div class="ppp-gcp-fields">
    <span class="ppp-gcp-label">{$i18n.t("views.gallery.card-panel.fields")}</span>
    <ol class="ppp-gcp-list" data-gcp-shown>
      {#each shown as field, index (field.name)}
        <li data-gcp-field={field.name}>
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
  </div>
</section>

<style>
  .ppp-gallery-card-panel {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
    margin: var(--size-4-2) var(--size-4-3) 0;
    padding: var(--size-4-3);
    max-width: 26rem;
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-primary);
    box-shadow: var(--shadow-s);
  }
  .ppp-gcp-head,
  .ppp-gcp-row,
  .ppp-gcp-list li {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    min-width: 0;
  }
  .ppp-gcp-head {
    justify-content: space-between;
  }
  .ppp-gcp-title {
    font-weight: var(--font-semibold);
  }
  .ppp-gcp-row {
    flex-wrap: wrap;
    justify-content: space-between;
  }
  .ppp-gcp-label {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }
  .ppp-gcp-seg {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--size-2-1);
  }
  .ppp-gcp-seg button {
    min-height: var(--ppp-touch-target-min, 2rem);
    font-size: var(--font-ui-small);
  }
  .ppp-gcp-seg button[aria-pressed="true"] {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  .ppp-gcp-btn {
    min-width: var(--ppp-touch-target-min, 2rem);
    min-height: var(--ppp-touch-target-min, 2rem);
  }
  .ppp-gcp-list {
    list-style: none;
    margin: var(--size-4-1) 0 0;
    padding: 0;
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
</style>
