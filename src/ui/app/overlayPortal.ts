/**
 * The overlay layer of one view, and the action that moves a node into it (#190).
 *
 * ## Why a node has to move at all
 *
 * The peek panel must be a sibling of the nav bar, so that a grid row — not a
 * measured height — puts its top edge at the bottom of the header. But
 * `A168_peekNotLeaving` pins where the peek is resolved: inside `View.svelte`,
 * which is the only place holding the frame the panel needs. The component
 * therefore stays where it is and only its DOM nodes travel.
 *
 * ## Why the target is derived and not passed in
 *
 * Two Obsidian leaves put two `.projects-container` subtrees in one document,
 * each with its own layer. A `document.querySelector` would send leaf B's panel
 * into leaf A's layer — silently, and only for the split-pane user this ticket
 * exists for. So the target is resolved by walking UP from the node, and the
 * action takes no parameter: a caller that cannot name the layer cannot name
 * the wrong one.
 *
 * ## The retry, and the flag that makes it safe
 *
 * On first mount the layer element exists in the component but is not yet in
 * the document: Svelte inserts the container, then its children in order, and
 * `.projects-main` — which holds the panel — precedes the layer in the markup.
 * One `tick()` is enough. Between the await and its continuation the component
 * may unmount, and an `appendChild` then would resurrect a destroyed node, so
 * `destroyed` is checked before the second attempt.
 *
 * If the layer is still not found, the node stays where it is. That fallback is
 * weaker than the real thing and deliberately so: with `position: relative` on
 * `.projects-main` the panel is still below the header and still the width of
 * the container, but it is inside a scroll container and so scrolls with the
 * content. It degrades; it does not break.
 */

import { tick } from "svelte";

/** The layer's class, written as a literal in `App.svelte` too. */
export const OVERLAY_CLASS = "ppp-app-overlay";

/** The plugin subtree of ONE leaf. The search for a layer never leaves it. */
const CONTAINER_CLASS = "projects-container";

export function portalToOverlay(node: HTMLElement): { destroy(): void } {
  let destroyed = false;

  const place = (): boolean => {
    const container = node.closest("." + CONTAINER_CLASS);
    const layer = container?.querySelector<HTMLElement>(
      `:scope > .${OVERLAY_CLASS}`
    );
    if (!layer) return false;
    layer.appendChild(node);
    return true;
  };

  const placeAfterTick = async (): Promise<void> => {
    await tick();
    if (destroyed) return;
    place();
  };

  if (!place()) void placeAfterTick();

  return {
    destroy() {
      destroyed = true;
      // Same shape as `FloatingPopup`'s portal, on purpose: five of these now
      // exist and a future consolidation should be mechanical.
      node.remove();
    },
  };
}
