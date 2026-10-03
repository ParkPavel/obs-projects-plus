<script lang="ts">
  import { isMobileDevice } from "src/lib/stores/ui";
  import { toRem } from "src/ui/utils/cssLength";

  export let cardWidth: number;

  // v3.0.10: On mobile, cap card width to ensure a reasonable grid
  $: effectiveWidth = $isMobileDevice ? Math.min(cardWidth, 200) : cardWidth;
</script>

<section
  class="projects--gallery--grid"
  style={`grid-template-columns: repeat(auto-fill, minmax(${toRem(effectiveWidth)}, 1fr));`}
>
  <slot />
</section>
