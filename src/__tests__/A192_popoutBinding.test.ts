import * as fs from "fs";
import * as path from "path";

/**
 * A192 — moving the node is only half the fix (#192).
 *
 * The pre-merge review caught the other half: both popups kept listening on
 * the bundle's `document` and measuring against the bundle's `window` after
 * being portaled into a popout. Escape and outside-click would be watched in a
 * window the popup is not in — so it could not be dismissed at all — and the
 * main window's viewport would clamp its position to coordinates from a
 * different screen area.
 *
 * Asserted against the source because what is being pinned is a rule, not a
 * value: no popup that can travel between windows may reach for a global
 * `document` or `window` for its listeners or its measurements. jsdom has one
 * window, so a mounted test cannot tell the difference — which is exactly why
 * this defect survived the component suites.
 */

const ROOT = path.join(__dirname, "..");

function body(rel: string): string {
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  // Comments explain the rule and name the globals; the rule is about code.
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

const TRAVELLERS = [
  "ui/components/FloatingPopup/FloatingPopup.svelte",
  "ui/views/Calendar/components/DayPopup/DayPopup.svelte",
];

describe("A192 — a portaled popup belongs to one window, wholly", () => {
  it("registers no listener on a global document or window", () => {
    for (const file of TRAVELLERS) {
      const code = body(file);
      expect(code).not.toMatch(/\bdocument\.addEventListener/);
      expect(code).not.toMatch(/\bwindow\.addEventListener/);
      expect(code).not.toMatch(/\bactiveDocument\.addEventListener/);
    }
  });

  it("removes listeners from the same place it added them", () => {
    for (const file of TRAVELLERS) {
      const code = body(file);
      expect(code).not.toMatch(/\bdocument\.removeEventListener/);
      expect(code).not.toMatch(/\bwindow\.removeEventListener/);
    }
  });

  it("measures against its own view, not the bundle's", () => {
    for (const file of TRAVELLERS) {
      const code = body(file);
      expect(code).not.toMatch(/\bwindow\.inner(Width|Height)/);
      // `getComputedStyle` with no receiver is the global one.
      expect(code).not.toMatch(/[^.\w]getComputedStyle\(/);
    }
  });

  it("reads focus from the document it is bound to", () => {
    // A listener in the right window that then asks the WRONG document who has
    // focus is the same defect wearing a different coat: Tab never recognises
    // the first or last control, and arrow navigation always sees no selection.
    const code = body(TRAVELLERS[0] as string);
    expect(code).not.toMatch(/[^.\w]document\.activeElement/);
  });

  it("can move its binding, because the document is not known at mount", () => {
    // Both components can be mounted before the thing that names their
    // document exists: FloatingPopup's anchor arrives when a popover opens,
    // DayPopup's layer is built by an action that runs on a conditional
    // branch. A binding made once at mount would stay on the main window.
    for (const file of TRAVELLERS) {
      expect(body(file)).toMatch(/function bindTo\(/);
    }
  });

  it("does not bind the key handler through svelte:window", () => {
    // `<svelte:window>` is the bundle's window by definition, so a popup that
    // can be in another one cannot use it for dismissal.
    expect(body(TRAVELLERS[1] as string)).not.toMatch(/<svelte:window[^>]*keydown/);
  });
});
