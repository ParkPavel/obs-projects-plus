/**
 * R0_5_textIntegrity.test.ts — UT2026-B T1 invariant (#069).
 *
 * No U+FFFD replacement characters anywhere in src/. A U+FFFD in a source
 * file means an encoding-corrupting commit destroyed a literal (emoji,
 * em-dash, Cyrillic) — it always reaches the user as a broken glyph.
 * 2026-06-11 user testing found 25 of them across 4 files (plus 2 files
 * with invalid raw bytes); this ratchet keeps the count at zero.
 */

import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");
const SCANNED_EXTENSIONS = new Set([".ts", ".svelte", ".json", ".css"]);

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      collectFiles(full, out);
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

// Built from the char code so THIS file never contains the literal itself.
// Note: reading with "utf8" also surfaces invalid byte sequences (e.g. stray
// cp1251 bytes) as U+FFFD — the invariant catches both stored replacement
// chars and latent encoding corruption ripgrep cannot see.
const REPLACEMENT_CHAR = new RegExp(String.fromCharCode(0xfffd), "g");

describe("R0.5 text integrity (UT2026-B)", () => {
  it("contains zero U+FFFD replacement characters in src/", () => {
    const offenders: string[] = [];
    for (const file of collectFiles(SRC_ROOT)) {
      const content = fs.readFileSync(file, "utf8");
      const count = (content.match(REPLACEMENT_CHAR) ?? []).length;
      if (count > 0) {
        offenders.push(`${path.relative(SRC_ROOT, file)} (${count})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
