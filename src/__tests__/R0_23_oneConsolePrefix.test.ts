import * as fs from "fs";
import * as path from "path";

/**
 * R0.23 — the console speaks with one voice (#202 step 6).
 *
 * Five prefixes shipped side by side: `[obs-projects-plus]`, `[Projects+]`,
 * `[Calendar]`, `[ErrorBoundary]`, `[EditNote]`. A user asked to "check the
 * console" had nothing to search for, and the person reading their paste could
 * not tell one product's lines from another's. That was the same failure the
 * codes fix on the Notice side, one surface over.
 *
 * What is pinned: a bracketed tag at the start of a console string is
 * `[Projects+]`. An area word after it is welcome — `[Projects+] Calendar` says
 * more than `[Projects+]` alone, and flattening it would throw away meaning to
 * satisfy a rule.
 *
 * Like R0.22, this reads source text rather than data flow, and says so instead
 * of implying more: a tag built at runtime from a variable passes it. The
 * defect it prevents is the one that actually happened — a new file inventing
 * its own tag because nothing said otherwise.
 */

const ROOT = path.join(__dirname, "..");
const PREFIX = "[Projects+]";

/** A bracketed tag opening a console argument: `console.error("[Foo] …`. */
const TAG = /console\.(?:log|info|warn|error|debug)\(\s*[`'"]\s*(\[[^\]]+\])/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function strayTags(): string[] {
  const stray: string[] = [];
  for (const file of walk(ROOT)) {
    if (!/\.(ts|svelte)$/.test(file)) continue;
    if (/__tests__|\.test\.|\.spec\./.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(TAG)) {
      const tag = match[1] as string;
      if (tag !== PREFIX) {
        stray.push(`${tag} in ${path.relative(ROOT, file)}`);
      }
    }
  }
  return stray;
}

/** A console call whose first argument is a literal that does not carry the prefix. */
const LITERAL_HEAD =
  /console\.(?:log|info|warn|error|debug)\(\s*[`'"]([^`'"]{0,60})/g;

function unprefixed(): string[] {
  const found: string[] = [];
  for (const file of walk(ROOT)) {
    if (!/\.(ts|svelte)$/.test(file)) continue;
    if (/__tests__|\.test\.|\.spec\./.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(LITERAL_HEAD)) {
      const head = (match[1] as string).trim();
      if (!head.startsWith(PREFIX)) {
        found.push(`${path.relative(ROOT, file)} :: ${head.slice(0, 40)}`);
      }
    }
  }
  return found;
}

describe("R0.23 — one console prefix", () => {
  it("no console line opens with a tag of its own", () => {
    expect(strayTags()).toEqual([]);
  });

  it("no console line goes out with no prefix at all", () => {
    // The second half of the rule, and the review was right that the first
    // half alone did not deliver it: a line reading "Failed to save …" is just
    // as unsearchable as one tagged `[Widget]`, and six of those were in the
    // tree while this test passed. Lines built through a logger's formatter are
    // not literals here and are not the target.
    expect(unprefixed()).toEqual([]);
  });

  it("the shared logger writes that prefix", () => {
    const logger = fs.readFileSync(
      path.join(ROOT, "lib", "errors", "errorLog.ts"),
      "utf8"
    );
    expect(logger).toMatch(/const PREFIX = "\[Projects\+\]"/);
  });

  it("the Calendar's own logger keeps its area after the shared prefix", () => {
    // Area words are the part worth keeping: `[Projects+] Calendar` tells the
    // reader where a line came from, which one flat token cannot.
    const logger = fs.readFileSync(
      path.join(ROOT, "ui", "views", "Calendar", "logger.ts"),
      "utf8"
    );
    expect(logger).toMatch(/\[Projects\+\] Calendar/);
  });

  it("a logger call does not repeat the prefix its formatter adds", () => {
    // Caught by review on the first pass: `calendarLogger` prepends
    // `[Projects+] Calendar`, so a message that also opened with the product
    // prefix printed it twice on one line.
    //
    // Component tags inside these calls — `[ViewportStateManager]`,
    // `[NavigationController]` — are deliberately NOT forbidden. They say which
    // part of the Calendar spoke, which the shared prefix cannot, and removing
    // them would trade information for uniformity.
    const doubled: string[] = [];
    for (const file of walk(path.join(ROOT, "ui", "views", "Calendar"))) {
      if (!/\.(ts|svelte)$/.test(file)) continue;
      if (/__tests__|\.test\.|\.spec\./.test(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(
        /calendarLogger\.[a-z]+\(\s*[`'"]\s*\[Projects\+\]/g
      )) {
        doubled.push(`${path.relative(ROOT, file)} :: ${match[0].slice(0, 40)}`);
      }
    }
    expect(doubled).toEqual([]);
  });

  it("catches a tag this rule would have missed before", () => {
    // The matcher's own falsification: a planted stray must be reported.
    const planted = 'console.error("[Widget] something went wrong", err);';
    const found = [...planted.matchAll(TAG)].map((m) => m[1]);
    expect(found).toEqual(["[Widget]"]);
  });
});
