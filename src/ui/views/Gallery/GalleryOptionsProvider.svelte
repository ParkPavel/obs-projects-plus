<script lang="ts">
  import type { DataField } from "src/lib/dataframe/dataframe";
  import {
    ViewContent,
    ViewLayout,
  } from "src/ui/components/Layout";
  import type { GalleryConfig } from "./types";
  import { normalizeGalleryConfig } from "./galleryOptions";

  export let fields: DataField[];
  export let config: GalleryConfig | undefined;

  // cards-g3: one reading of the config for every option (galleryOptions.ts).
  $: options = normalizeGalleryConfig(config);
  $: coverField = fields.find((field) => options.coverField === field.name);
  $: iconField = fields.find((field) => options.iconField === field.name);
  $: fitStyle = options.fitStyle;
  $: cardWidth = options.cardWidth;
  $: layout = options.layout;
  $: coverAspectRatio = options.coverAspectRatio;
  $: showFieldLabels = options.showFieldLabels;
  $: includeFields = options.includeFields;
</script>

<!--
    @component
    GalleryOptionsProvider - every gallery option (cover, fit, size, layout,
    aspect ratio, labels, included fields) is managed via ViewConfigTab in the
    settings menu and read here through normalizeGalleryConfig.
-->
<ViewLayout>
  <ViewContent padding>
    <slot
      {fitStyle}
      {coverField}
      {iconField}
      {cardWidth}
      {layout}
      {coverAspectRatio}
      {showFieldLabels}
      {includeFields}
    />
  </ViewContent>
</ViewLayout>
