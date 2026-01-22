<script lang="ts">
  import type { DataField } from "src/lib/dataframe/dataframe";
  import {
    ViewContent,
    ViewLayout,
  } from "src/ui/components/Layout";
  import type { GalleryConfig } from "./types";

  export let fields: DataField[];
  export let config: GalleryConfig | undefined;

  $: coverField = fields.find((field) => config?.coverField === field.name);
  $: fitStyle = config?.fitStyle ?? "cover";
  $: cardWidth = config?.cardWidth ?? 300;
</script>

<!--
    @component
    GalleryOptionsProvider - Cover, FitStyle, and Include fields
    are now managed via ViewConfigTab in the settings menu.
-->
<ViewLayout>
  <ViewContent padding>
    <slot {fitStyle} {coverField} {cardWidth} />
  </ViewContent>
</ViewLayout>
