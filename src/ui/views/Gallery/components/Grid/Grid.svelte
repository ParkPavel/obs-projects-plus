<script lang="ts">
  import { toRem } from "src/ui/utils/cssLength";
  import type { GalleryLayout } from "../../types";

  export let cardWidth: number;
  export let layout: GalleryLayout = "grid";

  // cards-g3: the width is the user's, at every device. What a narrow pane
  // does with it is decided by the gallery's own container (styles.css,
  // `ppp-gallery`), not by the kind of device: the v3.0.10 cap to 200 on any
  // phone is gone, and a card never grows wider than the container.
  $: width = toRem(cardWidth);
</script>

<!-- cards-g3: the wrapper is the gallery's own query container; the section
     inside it lays the cards out (grid, CSS columns, or one column of rows). -->
<div class="ppp-gallery-container">
  <section
    class="projects--gallery--grid ppp-gallery--{layout}"
    data-layout={layout}
    style:--ppp-gallery-card-width={width}
  >
    <slot />
  </section>
</div>
