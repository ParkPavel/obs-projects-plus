/**
 * R0_FIELDS_rawInputs.test.ts — 3.7.2 B1 ratchet: one field kit.
 *
 * The audit of 14.10.2026 found text, date and number entry hand-rolled as
 * raw `<input>` in dozens of components; each one met the on-screen keyboard,
 * IME, Escape and overflow its own way, and people saw "a different problem
 * in every window". The kit in src/ui/components/fields owns that behaviour.
 * The number of raw text-like inputs outside the kit may only go down.
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");
const KIT = path.join(SRC, "ui", "components", "fields");
const TEXT_LIKE = ["text", "date", "datetime-local", "number", "search", "time", "email", "url", "tel"];

<<<<<<< HEAD
// Measured 14.10.2026 on p372-b1b (was 29/52 on p372-b1). Lower it whenever a component moves to the kit.
const MAX_FILES = 16;
const MAX_TAGS = 27;
=======
// Measured 14.10.2026 on p372-b1; p372-b4 moved the duplicate time editors to DateField (29/52 → 27/48).
const MAX_FILES = 27;
const MAX_TAGS = 48;
>>>>>>> borshkit/p372-b4

function svelteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && full !== KIT) out.push(...svelteFiles(full));
    } else if (entry.name.endsWith(".svelte")) out.push(full);
  }
  return out;
}

function rawTextInputs(): Array<{ file: string; tags: number }> {
  const found: Array<{ file: string; tags: number }> = [];
  for (const file of svelteFiles(SRC)) {
    const tags = (fs.readFileSync(file, "utf8").match(/<input\b[^>]*>/gs) ?? []).filter((tag) => {
      const type = /\btype=["']?([a-z-]+)/.exec(tag)?.[1];
      return type === undefined || TEXT_LIKE.includes(type);
    });
    if (tags.length) found.push({ file: path.relative(SRC, file).replace(/\\/g, "/"), tags: tags.length });
  }
  return found.sort((a, b) => b.tags - a.tags);
}

describe("R0_FIELDS — raw text inputs outside the field kit only go down", () => {
  it(`at most ${MAX_FILES} files / ${MAX_TAGS} tags`, () => {
    const found = rawTextInputs();
    const tags = found.reduce((n, f) => n + f.tags, 0);
    const report = found.map((f) => `${f.tags}  ${f.file}`).join("\n");
    if (found.length > MAX_FILES || tags > MAX_TAGS) {
      throw new Error(`raw inputs grew: ${found.length} files / ${tags} tags (max ${MAX_FILES}/${MAX_TAGS})\n${report}`);
    }
  });
});
