<script lang="ts" context="module">
  /** i3-close: each instance gets its own ids — the panel and the settings tab may be open together. */
  let instances = 0;
</script>

<script lang="ts">
  /**
   * i3-close — the gallery card options that live in two places: the
   * gallery's own «Card» panel (GalleryCardPanel.svelte) and the shared view
   * settings tab (ViewConfigTab.svelte). Card width (slider), card preview,
   * title only and group by are drawn here once, so the two surfaces cannot
   * drift apart. It reads the config through the gallery's one normaliser and
   * hands each change out as a partial config; it holds no state but the
   * slider's position while it is dragged. Nothing appears only on hover.
   */
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { GalleryCardPreview, GalleryConfig } from "../../types";
  import {
    GALLERY_CARD_PREVIEWS,
    GALLERY_WIDTH_RANGE,
    clampCardWidth,
    normalizeGalleryConfig,
  } from "../../galleryOptions";

  export let fields: ReadonlyArray<{ name: string; identifier?: boolean }>;
  export let config: GalleryConfig | Readonly<Record<string, unknown>> | undefined;
  /** Receives only the keys that changed; the caller merges and saves them. */
  export let onPatch: (partial: Partial<Record<keyof GalleryConfig, unknown>>) => void;

  const uid = `ppp-gco-${++instances}`;

  $: options = normalizeGalleryConfig(config);
  // Any field but the note's own name can split the cards into sections.
  $: groupCandidates = fields.filter((f) => !f.identifier);
  /** English for the preview modes until a locale carries them. */
  const PREVIEW_DEFAULTS: Record<GalleryCardPreview, string> = {
    cover: "Cover or first image",
    property: "Cover property only",
    content: "Page content",
  };

  // The slider's position while it is dragged; the config is written once, on release.
  let draftWidth: number | null = null;
  $: shownWidth = draftWidth ?? options.cardWidth;

  function commitWidth(value: string) {
    draftWidth = null;
    onPatch({ cardWidth: clampCardWidth(value) });
  }
</script>

<div class="ppp-gcp-row ppp-gcp-row--slider">
  <label class="ppp-gcp-label" for="{uid}-width">{$i18n.t("settings-menu.view-config.gallery.card-width")}</label>
  <input
    id="{uid}-width"
    class="slider"
    type="range"
    data-gcp-width
    min={GALLERY_WIDTH_RANGE.min}
    max={GALLERY_WIDTH_RANGE.max}
    step={GALLERY_WIDTH_RANGE.step}
    value={shownWidth}
    on:input={(e) => (draftWidth = clampCardWidth(e.currentTarget.value))}
    on:change={(e) => commitWidth(e.currentTarget.value)}
  />
  <output class="ppp-gcp-value" for="{uid}-width">{$i18n.t("views.gallery.card-panel.width-value", { value: Math.round(shownWidth), defaultValue: "{{value}} px" })}</output>
</div>

<div class="ppp-gcp-row">
  <label class="ppp-gcp-label" for="{uid}-preview">{$i18n.t("views.gallery.card-panel.preview", { defaultValue: "Card preview" })}</label>
  <select
    id="{uid}-preview"
    class="dropdown"
    data-gcp-preview
    value={options.cardPreview}
    on:change={(e) => onPatch({ cardPreview: e.currentTarget.value })}
  >
    {#each GALLERY_CARD_PREVIEWS as mode}
      <option value={mode}>{$i18n.t(`views.gallery.card-panel.preview-options.${mode}`, { defaultValue: PREVIEW_DEFAULTS[mode] })}</option>
    {/each}
  </select>
</div>

<div class="ppp-gcp-row">
  <span class="ppp-gcp-label">{$i18n.t("views.gallery.card-panel.compact", { defaultValue: "Title only" })}</span>
  <button
    type="button"
    class="ppp-gcp-toggle"
    data-gcp-compact
    role="switch"
    aria-checked={options.compact}
    aria-label={$i18n.t("views.gallery.card-panel.compact", { defaultValue: "Title only" })}
    on:click={() => onPatch({ compact: !options.compact })}
  ><Icon name={options.compact ? "toggle-right" : "toggle-left"} size="md" /></button>
</div>

<div class="ppp-gcp-row">
  <label class="ppp-gcp-label" for="{uid}-group">{$i18n.t("views.gallery.card-panel.group-by", { defaultValue: "Group by" })}</label>
  <select
    id="{uid}-group"
    class="dropdown"
    data-gcp-group
    value={options.groupByField ?? ""}
    on:change={(e) => onPatch({ groupByField: e.currentTarget.value || undefined, collapsedGroups: undefined })}
  >
    <option value="">{$i18n.t("views.gallery.fields.none")}</option>
    {#each groupCandidates as field (field.name)}
      <option value={field.name}>{field.name}</option>
    {/each}
  </select>
</div>

<style>
  .ppp-gcp-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
    min-width: 0;
  }
  .ppp-gcp-label {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }
  .ppp-gcp-toggle {
    min-width: var(--ppp-touch-target-min, 2em);
    min-height: var(--ppp-touch-target-min, 2em);
  }
  .ppp-gcp-toggle[aria-checked="true"] {
    color: var(--interactive-accent);
  }
  /* The slider takes the row's free width, its value after it. */
  .ppp-gcp-row--slider input {
    flex: 1 1 8em;
    min-width: 0;
  }
  .ppp-gcp-value {
    min-width: 4em;
    text-align: end;
    font-size: var(--font-ui-small);
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }
</style>
