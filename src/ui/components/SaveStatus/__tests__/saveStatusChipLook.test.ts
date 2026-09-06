import * as fs from "fs";
import * as path from "path";

/**
 * #201 — the mark must stay legible, and stay a mark.
 *
 * The defect this pins was found by looking at the running app: the chip
 * painted Obsidian's saturated error fill under its saturated error text, and
 * the result was a solid red rectangle with no readable glyph on it. Nothing in
 * the unit tests could see that — they assert what the chip SAYS, not what it
 * looks like — so what is pinned here is the rule that produced it.
 */

const CHIP = path.join(__dirname, "..", "SaveStatusChip.svelte");

function source(): string {
  return fs.readFileSync(CHIP, "utf8");
}

function styleBlock(): string {
  const text = source();
  return text.slice(text.indexOf("<style>"));
}

describe("#201 — the save-status mark", () => {
  it("never paints an error fill behind error text", () => {
    // The two tokens are both full-strength error red. Obsidian guarantees
    // --text-error against the ambient surface, and nothing else.
    expect(styleBlock()).not.toMatch(/background:[^;]*--background-modifier-error/);
  });

  it("has no fill at rest", () => {
    expect(styleBlock()).toMatch(/\.save-status-chip\s*\{[^}]*background:\s*transparent/);
  });

  it("derives its hover tint from the text colour rather than a second token", () => {
    // Derived, so it cannot land in the same lightness band as the text the way
    // two independently themed error tokens can.
    expect(styleBlock()).toMatch(
      /:hover\s*\{[^}]*color-mix\(in srgb, var\(--text-error\)/
    );
  });

  it("keeps the affordances that come with a real button", () => {
    const text = source();
    // "Not a button" was about shape. Dropping the element would take focus,
    // Enter and Space with it, and the retry is the only way back from a failed
    // write.
    expect(text).toMatch(/<button/);
    expect(text).toMatch(/type="button"/);
    expect(styleBlock()).toMatch(/cursor:\s*pointer/);
    expect(styleBlock()).toMatch(/:focus-visible/);
  });
});
