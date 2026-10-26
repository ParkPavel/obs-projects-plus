<script lang="ts">
  /**
   * B9 — the gallery's own «Card» panel, opened from the gallery itself (the
   * Notion "Layout / Properties" pattern): cover field and fit, card size,
   * layout and the visible properties in their order. It writes the very keys
   * the view settings tab writes (ViewConfigTab.svelte), through the same
   * normaliser and the same order helpers, so the two never disagree; it holds
   * no state of its own beyond what the config says. Nothing appears only on
   * hover.
   *
   * i3-gallery: the card width is a slider too (Bases sizes a card by its
   * width), with the presets as quick choices; the cover can be a list or link
   * property; the card preview, the cover ratio, a compact (title only) card
   * and grouping by a field are set here as well.
   *
   * i3-close: the width, preview, title-only and group-by rows moved to
   * GalleryCardOptions.svelte, which the view settings tab draws as well.
   */
  import { Icon } from "obsidian-svelte";
  import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import type { GalleryConfig } from "../../types";
  import {
    GALLERY_ASPECT_RATIOS,
    GALLERY_LAYOUTS,
    GALLERY_SIZE_PRESETS,
    normalizeGalleryConfig,
    sizePresetOf,
    type GallerySizePreset,
  } from "../../galleryOptions";
  import GalleryCardOptions from "./GalleryCardOptions.svelte";
  import GalleryFieldList from "./GalleryFieldList.svelte";

  export let fields: DataField[];
  export let config: GalleryConfig | undefined;
  /** Receives the next whole config; the view saves it and re-renders. */
  export let onChange: (next: GalleryConfig) => void;
  export let onClose: () => void;

  $: options = normalizeGalleryConfig(config);
  $: preset = sizePresetOf(options.cardWidth);
  // The cover is a path, a link, or a list of them (`cover: ["[[a.png]]"]`):
  // text, list and relation properties; never a number, a date or a checkbox.
  const COVER_TYPES: readonly string[] = [DataFieldType.String, DataFieldType.List, DataFieldType.Relation, "String", "text"];
  $: coverCandidates = fields.filter((f) => COVER_TYPES.includes(f.type));
  const presets = Object.keys(GALLERY_SIZE_PRESETS) as GallerySizePreset[];

  function patch(next: Partial<Record<keyof GalleryConfig, unknown>>) {
    onChange({ ...(config ?? {}), ...next } as GalleryConfig);
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

  <!-- i3-close: width, preview, title only and group by are the shared rows the view settings tab draws too. -->
  <GalleryCardOptions {fields} {config} onPatch={patch} />

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

  <div class="ppp-gcp-row">
    <label class="ppp-gcp-label" for="ppp-gcp-ratio">{$i18n.t("settings-menu.view-config.gallery.aspect-ratio")}</label>
    <select
      id="ppp-gcp-ratio"
      class="dropdown"
      data-gcp-ratio
      value={options.coverAspectRatio}
      on:change={(e) => patch({ coverAspectRatio: e.currentTarget.value })}
    >
      {#each GALLERY_ASPECT_RATIOS as ratio}
        <option value={ratio}>{ratio === "none" ? $i18n.t("settings-menu.view-config.gallery.aspect-ratio-none") : ratio.replace("/", ":")}</option>
      {/each}
    </select>
  </div>

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

  <div class="ppp-gcp-fields">
    <span class="ppp-gcp-label">{$i18n.t("views.gallery.card-panel.fields")}</span>
    <GalleryFieldList {fields} includeFields={options.includeFields} onChange={(includeFields) => patch({ includeFields })} />
  </div>
</section>

<style>
  /* w4-p10a (N12): the inspector's body; the shared popup is its frame. */
  .ppp-gallery-card-panel {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
    width: min(22rem, 100%);
    padding: var(--size-4-1);
  }
  .ppp-gcp-head,
  .ppp-gcp-row {
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
    font-size: var(--font-ui-small);
  }
  /* A finger's target on a touch screen; a computer keeps the rows compact. */
  @media (pointer: coarse) {
    .ppp-gcp-seg button {
      min-height: var(--ppp-touch-target-min);
    }
  }
  .ppp-gcp-seg button[aria-pressed="true"] {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  .ppp-gcp-btn {
    min-width: var(--ppp-touch-target-min, 2rem);
    min-height: var(--ppp-touch-target-min, 2rem);
  }
</style>
