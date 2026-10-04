<script lang="ts">
  import { onMount } from "svelte";
  import { gridColumnCount } from "src/ui/components/SharedCard/cardFrames";
  import { toRem } from "src/ui/utils/cssLength";
  import type { GalleryLayout } from "../../types";

  export let cardWidth: number;
  export let layout: GalleryLayout = "grid";

  // cards-g3: the width is the user's, at every device. What a narrow pane
  // does with it is decided by the gallery's own container (styles.css,
  // `ppp-gallery`), not by the kind of device: the v3.0.10 cap to 200 on any
  // phone is gone, and a card never grows wider than the container.
  // cards-g5: against the root of the window the grid is IN (a popout may have
  // its own root size), the same root the column count below is measured in.
  $: width = toRem(cardWidth, section?.ownerDocument ?? document);

  // cards-g5: how many columns the grid lays out, so a card's saved span can be
  // capped to them (a span wider than the grid would add implicit columns).
  // The count is the auto-fill rule itself, computed from the section's content
  // width (a ResizeObserver of the section's own window, so a popout counts its
  // own box, applied in that window's next animation frame), the column minimum (`cardWidth`, CSS pixels) and the column gap.
  // Unmeasured (no observer yet, masonry, list) it is undefined: nothing caps.
  let section: HTMLElement;
  let contentWidth = 0;
  let gap = 0;
  let columns: number | undefined = undefined;

  function readGap(): number {
    const view = section?.ownerDocument.defaultView;
    if (!view) return 0;
    // coercion-exempt: Class C - a computed CSS length read back from the DOM, not record data
    const measured = parseFloat(view.getComputedStyle(section).columnGap);
    return Number.isFinite(measured) && measured > 0 ? measured : 0;
  }

  function recount(columnMin: number, currentLayout: GalleryLayout): void {
    if (currentLayout !== "grid" || !(contentWidth > 0)) {
      columns = undefined;
      return;
    }
    gap = readGap();
    columns = gridColumnCount(contentWidth, columnMin, gap);
  }

  $: recount(cardWidth, layout);

  /** One column of horizontal travel for the resize handle: a track and its gap. */
  const columnStep = (): number => (columns ? (contentWidth + gap) / columns : 0);

  // chrome-filters: the observer only records the latest width; the state
  // update and the recount run once, in the next animation frame of the window
  // the grid is in. Writing state inside the observer callback re-laid the
  // cards in the same layout pass the observer was reporting, which is the
  // "ResizeObserver loop" warning; several callbacks before one frame are one
  // recount. A pending frame is cancelled on destroy.
  onMount(() => {
    const view = section.ownerDocument.defaultView;
    const Observer = section.ownerDocument.defaultView?.ResizeObserver;
    if (!view || !Observer) return;
    let pendingWidth = contentWidth;
    let frame: number | null = null;
    const flush = () => {
      frame = null;
      contentWidth = pendingWidth;
      recount(cardWidth, layout);
    };
    const observer = new Observer((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      pendingWidth = entry.contentRect.width;
      if (frame !== null) return;
      if (typeof view.requestAnimationFrame !== "function") {
        flush();
        return;
      }
      frame = view.requestAnimationFrame(flush);
    });
    observer.observe(section);
    return () => {
      observer.disconnect();
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
    };
  });
</script>

<!-- cards-g3: the wrapper is the gallery's own query container; the section
     inside it lays the cards out (grid, CSS columns, or one column of rows). -->
<div class="ppp-gallery-container">
  <section
    bind:this={section}
    class="projects--gallery--grid ppp-gallery--{layout}"
    data-layout={layout}
    style:--ppp-gallery-card-width={width}
  >
    <slot {columns} {columnStep} />
  </section>
</div>
