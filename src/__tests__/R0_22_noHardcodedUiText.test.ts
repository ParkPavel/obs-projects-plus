import * as fs from "fs";
import * as path from "path";

/**
 * R0.22 — no user-facing message is written in one language inside a component
 * (#202 step 5).
 *
 * This ratchet exists because of a defect that shipped and lived for months:
 * sixteen `new Notice('…')` calls in the Calendar view carried Russian strings,
 * shown verbatim to an English, Ukrainian or Chinese user. Nothing could catch
 * it — the strings were valid code, the tests passed, and only a reader who
 * knew both the language and the file would notice.
 *
 * What is pinned is narrow on purpose: a Notice must not be constructed from a
 * bare string literal. Whether the words come from `noticeFor` (a coded
 * message) or from `t(...)` (an uncoded one, such as a success) is not this
 * ratchet's business — both go through the locale layer, which is the whole
 * point.
 *
 * The count may only fall. It is not zero yet: the remaining sites are English
 * literals in files step 6 has not reached, and each one is a message somebody
 * outside English still cannot read.
 */

const ROOT = path.join(__dirname, "..");

/** Measured 2026-09-07, after the Calendar, Board and Gallery were converted.
 *  The two left are the commented-out example in dataApi and this ratchet's own
 *  doc comment naming the pattern -- neither is a message. May only fall. */
const BUDGET = 2;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** `new Notice(` whose first argument starts with a quote or a backtick. */
const LITERAL_NOTICE = /new Notice\(\s*(['"`])/g;

function offenders(): string[] {
  const found: string[] = [];
  for (const file of walk(path.join(ROOT))) {
    if (!/\.(ts|svelte)$/.test(file)) continue;
    if (/__tests__|\.test\.|\.spec\./.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const hits = [...text.matchAll(LITERAL_NOTICE)];
    for (let i = 0; i < hits.length; i += 1) {
      found.push(path.relative(ROOT, file));
    }
  }
  return found;
}

describe("R0.22 — user-facing text goes through the locale layer", () => {
  it("the count of literal Notice strings only falls", () => {
    const found = offenders();
    expect(found.length).toBeLessThanOrEqual(BUDGET);
  });

  it("the Calendar carries none of them", () => {
    // The file the defect lived in. Zero is the standard the rest is heading
    // for; pinning it here stops the sixteen from creeping back one at a time.
    const calendar = offenders().filter((file) => file.includes("Calendar"));
    expect(calendar).toEqual([]);
  });

  it("the budget is not slack", () => {
    // A ratchet loose enough to absorb a new offender is not a ratchet. If this
    // fails because the count dropped, lower BUDGET in the same commit.
    expect(offenders().length).toBe(BUDGET);
  });
});
