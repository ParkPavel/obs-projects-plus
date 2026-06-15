/**
 * R0_4_archiveContainment.test.ts — UT2026-A L1 invariant (#068/#074 F3).
 *
 * Nothing outside src/archive may import from src/archive. Archived V1
 * code is reference material, not production code: the fields/groups
 * popover crash (#068) shipped because the archived DataTableWidget kept
 * executing in every dashboard. This ratchet makes the quarantine real.
 */

import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");
const ARCHIVE_DIR = path.join(SRC_ROOT, "archive");
const SCANNED = new Set([".ts", ".svelte"]);

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === ARCHIVE_DIR || entry.name === "node_modules") continue;
      collectFiles(full, out);
    } else if (SCANNED.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

describe("R0.4 archive containment (UT2026-A L1)", () => {
  it("has zero imports from src/archive outside the archive itself", () => {
    const offenders: string[] = [];
    for (const file of collectFiles(SRC_ROOT)) {
      const content = fs.readFileSync(file, "utf8");
      if (/from\s+["']src\/archive\//.test(content) || /require\(["']src\/archive\//.test(content)) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
