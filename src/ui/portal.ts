/**
 * #192 — one action that moves a node, with the target named at the call site.
 *
 * Six copies of "append this element somewhere else" had grown across the tree,
 * each with its own lifecycle and its own idea of where "somewhere else" is.
 * Two of them (`HeaderStripsSection`, `TimelineView`) were the same function
 * twice, comment included. One of them was wrong: `FloatingPopup` used the
 * bundle's `document`, which is the MAIN window's document, so a Projects leaf
 * moved into an Obsidian popout window sent its popup to the wrong window.
 *
 * The fix is not `activeDocument`, and that correction is the useful part of
 * this module. `activeDocument` is the FOCUSED document — a component mounting
 * while another window has focus would land in that other window. The node
 * itself knows which document it belongs to, so `node.ownerDocument` is the
 * answer, and exactly one site in the tree already did it that way.
 *
 * ## What is shared, and what deliberately is not
 *
 * Shared: resolving the target, the one-`tick()` retry with its destroyed
 * guard, the stay-put fallback, and an idempotent destroy.
 *
 * Not shared: geometry. `AgendaSidebar` tracks a container's bounds and
 * `DayPopup` manages pointer events and layering; those belong to the
 * components. This action moves a node and says where. Nothing else.
 *
 * ## The name is load-bearing
 *
 * R0.16 exempts `FloatingPopup` from the rem-in-container rule on a word-bound
 * match for `use:portal`, so the action must be called `portal`. Renaming it
 * would silently re-arm a ratchet against a file that is exempt on purpose.
 */

import { tick } from "svelte";

/** The layer's class, written as a literal in `App.svelte` too. */
export const OVERLAY_CLASS = "ppp-app-overlay";

/** The plugin subtree of ONE leaf. The search for a layer never leaves it. */
const CONTAINER_CLASS = "projects-container";

/** Where the node should go. */
export type PortalTarget =
  /**
   * The overlay layer of the node's own Projects leaf (#190). Two leaves put
   * two subtrees in one document, so the target is found by walking UP from the
   * node: a caller that cannot name the layer cannot name the wrong one.
   */
  | "leaf-overlay"
  /** The body of the node's OWN document — correct inside a popout window. */
  | "document-body";

export interface PortalOptions {
  to: PortalTarget;
}

export interface PortalAction {
  destroy(): void;
}

function resolveTarget(node: HTMLElement, to: PortalTarget): HTMLElement | null {
  if (to === "document-body") return node.ownerDocument.body;
  const container = node.closest("." + CONTAINER_CLASS);
  return (
    container?.querySelector<HTMLElement>(`:scope > .${OVERLAY_CLASS}`) ?? null
  );
}

/**
 * Move `node` to the target named in `options`.
 *
 * If the target cannot be found the node stays where it is. That fallback is
 * weaker than the real thing and deliberately so: for the peek panel it means
 * the panel scrolls with the content instead of standing still. It degrades; it
 * does not break.
 */
export function portal(node: HTMLElement, options: PortalOptions): PortalAction {
  let destroyed = false;

  const place = (): boolean => {
    const target = resolveTarget(node, options.to);
    if (!target) return false;
    target.appendChild(node);
    return true;
  };

  const placeAfterTick = async (): Promise<void> => {
    // On first mount a layer may exist in the component but not yet in the
    // document: Svelte inserts the container, then its children in order. One
    // tick is enough. Between the await and its continuation the component may
    // unmount, and appending then would resurrect a destroyed node.
    await tick();
    if (destroyed) return;
    place();
  };

  if (!place()) void placeAfterTick();

  return {
    destroy() {
      destroyed = true;
      // Svelte 3.59.2 detaches the element BEFORE running this — measured in
      // `A192_portalContract.test.ts`, not assumed — so in the normal path
      // there is nothing left to remove. `remove()` is kept because a caller
      // may destroy the action by hand, and it is a no-op on a detached node,
      // which is what makes a second destroy harmless.
      node.remove();
    },
  };
}
