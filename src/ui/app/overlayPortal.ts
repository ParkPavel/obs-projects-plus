/**
 * The overlay layer of one view, and the action that moves a node into it
 * (#190) — now a thin re-export of the shared primitive (#192).
 *
 * ## Why this file still exists
 *
 * Its path and its exported name are referenced by `SlideInPanel.svelte` and
 * asserted by `A190_peekAnchoring.acceptance.test.ts`, which reads the
 * component's source for `use:portalToOverlay` and for this import string. The
 * consolidation is supposed to preserve behaviour, so it must not rewrite the
 * test that guards that behaviour: keeping the module makes A190 pass through
 * the refactor UNMODIFIED, which is the only way it stays evidence.
 *
 * ## Why the node has to move at all
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
 * into leaf A's layer — silently, and only for the split-pane user #190 exists
 * for. So the target is resolved by walking UP from the node, and the caller
 * takes no parameter: a caller that cannot name the layer cannot name the wrong
 * one. That behaviour now lives in `portal`, with the same reasoning.
 */

import { portal, type PortalAction } from "src/ui/portal";

export { OVERLAY_CLASS } from "src/ui/portal";

export function portalToOverlay(node: HTMLElement): PortalAction {
  return portal(node, { to: "leaf-overlay" });
}
