import { portalToOverlay, OVERLAY_CLASS } from "src/ui/app/overlayPortal";
import { portal } from "src/ui/portal";

/**
 * A192 step 0 — what the portals do TODAY, pinned before anything is shared.
 *
 * #192 consolidates six node-moving actions into one primitive. A refactor is
 * only safe if the behaviour it preserves was written down first, so this suite
 * is green against unmodified code — that is the only state in which it is
 * evidence rather than decoration.
 *
 * It also answers the question the plan refused to reason about (S8): in
 * Svelte 3.59.2, is an element still in its parent when an action's `destroy`
 * runs? `AgendaSidebar`'s restore branch is live code or dead code depending on
 * the answer, and the plan says to measure it rather than argue from the
 * framework source.
 */

function container(): HTMLElement {
  const root = document.createElement("div");
  root.className = "projects-container";
  const main = document.createElement("div");
  main.className = "projects-main";
  const layer = document.createElement("div");
  layer.className = OVERLAY_CLASS;
  root.append(main, layer);
  document.body.appendChild(root);
  return root;
}

describe("A192 — the portal contract as it stands", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("portalToOverlay (#190)", () => {
    it("moves the node into its own leaf's layer", () => {
      const root = container();
      const node = document.createElement("div");
      root.querySelector(".projects-main")?.appendChild(node);

      const action = portalToOverlay(node);

      expect(node.parentElement?.className).toBe(OVERLAY_CLASS);
      action.destroy();
    });

    it("in a split pane, the node lands in ITS leaf's layer, not the other one", () => {
      const first = container();
      const second = container();
      const node = document.createElement("div");
      second.querySelector(".projects-main")?.appendChild(node);

      const action = portalToOverlay(node);

      expect(second.querySelector(`.${OVERLAY_CLASS}`)?.contains(node)).toBe(true);
      expect(first.querySelector(`.${OVERLAY_CLASS}`)?.contains(node)).toBe(false);
      action.destroy();
    });

    it("leaves a node with no container where it is", () => {
      const orphan = document.createElement("div");
      const parent = document.createElement("section");
      parent.appendChild(orphan);
      document.body.appendChild(parent);

      const action = portalToOverlay(orphan);

      expect(orphan.parentElement).toBe(parent);
      action.destroy();
    });

    it("survives a second destroy", () => {
      const root = container();
      const node = document.createElement("div");
      root.querySelector(".projects-main")?.appendChild(node);

      const action = portalToOverlay(node);
      action.destroy();

      expect(() => action.destroy()).not.toThrow();
    });
  });

  /**
   * The two Calendar copies and FloatingPopup are the same shape, written out
   * three times. Pinned here as behaviour rather than by importing them: the
   * components drag their whole graph into a unit test, which is the reason
   * `headerChrome.ts` exists.
   */
  describe("the body-portal shape, as the three copies implement it", () => {
    function portalToBody(node: HTMLElement): { destroy(): void } {
      // Copied verbatim in shape from HeaderStripsSection.svelte:29-36 and
      // TimelineView.svelte:20-27 — the target differs from FloatingPopup's,
      // which is the defect #192 fixes.
      node.ownerDocument.body.appendChild(node);
      return {
        destroy() {
          if (node.parentNode) node.parentNode.removeChild(node);
        },
      };
    }

    it("moves the node to the body of ITS OWN document", () => {
      // The check that would have caught the defect: a node living in a second
      // document must not travel to the first one's body.
      const other = document.implementation.createHTMLDocument("second");
      const node = other.createElement("div");
      other.body.appendChild(node);
      const host = other.createElement("section");
      other.body.appendChild(host);
      host.appendChild(node);

      const action = portalToBody(node);

      expect(node.ownerDocument).toBe(other);
      expect(node.parentElement).toBe(other.body);
      expect(document.body.contains(node)).toBe(false);
      action.destroy();
    });

    it("removes the node on destroy, and a second destroy is harmless", () => {
      const node = document.createElement("div");
      document.body.appendChild(node);

      const action = portalToBody(node);
      action.destroy();

      expect(node.parentNode).toBeNull();
      expect(() => action.destroy()).not.toThrow();
    });
  });

  describe("the shared primitive (#192)", () => {
    it("sends a node to the body of ITS OWN document, not the main window's", () => {
      // The defect, expressed as a test: `FloatingPopup` used the bundle's
      // `document`, which is the main window's, so a Projects leaf in an
      // Obsidian popout sent its popup to the wrong window.
      const other = document.implementation.createHTMLDocument("popout");
      const host = other.createElement("section");
      other.body.appendChild(host);
      const node = other.createElement("div");
      host.appendChild(node);

      const action = portal(node, { to: "document-body" });

      expect(node.parentElement).toBe(other.body);
      expect(document.body.contains(node)).toBe(false);
      action.destroy();
    });

    it("still walks up to the leaf's own layer for the peek panel", () => {
      const root = container();
      const node = document.createElement("div");
      root.querySelector(".projects-main")?.appendChild(node);

      const action = portal(node, { to: "leaf-overlay" });

      expect(node.parentElement?.className).toBe(OVERLAY_CLASS);
      action.destroy();
    });

    it("destroy twice is harmless for either target", () => {
      const node = document.createElement("div");
      document.body.appendChild(node);
      const action = portal(node, { to: "document-body" });

      action.destroy();

      expect(() => action.destroy()).not.toThrow();
    });
  });

  describe("the old target cannot come back by hand", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");

    function read(rel: string): string {
      return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
    }

    it("no portal in the tree appends to the bundle's own document", () => {
      // `document.body` here is the MAIN window's body regardless of where the
      // node lives, and `activeDocument` is not the fix either — it is the
      // FOCUSED document, so a component mounting while another window has
      // focus would land in that one.
      for (const file of [
        "ui/components/FloatingPopup/FloatingPopup.svelte",
        "ui/views/Calendar/components/Calendar/HeaderStripsSection.svelte",
        "ui/views/Calendar/components/Calendar/TimelineView.svelte",
        "ui/portal.ts",
      ]) {
        expect(read(file)).not.toMatch(/document\.body\.appendChild/);
        expect(read(file)).not.toMatch(/activeDocument\.body\.appendChild/);
      }
    });

    it("the action is still called `portal`, because a ratchet reads that word", () => {
      // R0.16 exempts FloatingPopup on a word-bound `use:portal`. Renaming the
      // action would silently re-arm a ratchet against a file exempt on purpose.
      expect(read("ui/components/FloatingPopup/FloatingPopup.svelte")).toMatch(
        /use:portal/
      );
    });
  });

  /**
   * S8, measured rather than argued: does the element still have a parent when
   * the action's `destroy` runs? `AgendaSidebar.svelte:525-531` restores the
   * node to its original parent inside `destroy`, and that branch is only
   * reachable if the answer is yes.
   */
  describe("S8 — is the node still attached when destroy runs", () => {
    it("records what the framework does, whatever it is", () => {
      // `require`, not a dynamic import: this runner has no ESM VM modules, and
      // the Svelte transformer is wired for CommonJS — the same idiom the
      // existing component tests use.
      const Probe = require("./support/DestroyOrderProbe.svelte").default;

      const target = document.createElement("div");
      document.body.appendChild(target);
      const seen: Array<string | null> = [];
      const component = new (Probe as never as new (o: unknown) => {
        $destroy(): void;
      })({
        target,
        props: { report: (parent: string | null) => seen.push(parent) },
      });

      component.$destroy();

      // MEASURED, 2026-09-06, Svelte 3.59.2: the element is already detached
      // when the action's `destroy` runs. Consequence, and it is the reason
      // this test exists: `AgendaSidebar.svelte:525-531` restores the node to
      // its original parent under `node.parentElement === doc.body`, which can
      // never be true here. That branch is dead code, and #192 step 4 deletes
      // it citing this measurement rather than an argument about the framework.
      expect(seen).toHaveLength(1);
      expect(seen[0]).toBeNull();
    });
  });
});
