/**
 * R0.7 — config drift ratchet.
 *
 * The project carries the same rules in several hand-maintained copies: three
 * agent systems (.claude, .codex, .github/agents) and several rule documents.
 * Every copy is a chance for a number to go stale, and stale numbers in these
 * files are not cosmetic — they are the gates the agents check against.
 *
 * This has bitten repeatedly. A sweep in 2026-08-25 cleared "186 / 2020 / 134",
 * declared zero remaining, and missed an older generation ("139 / 2099") that a
 * PostToolUse hook was injecting into every session. A second sweep cleared
 * that and missed a third agent system entirely.
 *
 * Grep-by-memory does not converge; a test does. The canonical values live in
 * exactly two places and nowhere else:
 *
 *   - Jest baseline  → docs/internal/CONTEXT.md ("Canonical baseline")
 *   - PX budget      → the PX_BUDGET constant in R0_3_pxBudget.test.ts
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..", "..");

/** Files allowed to state the canonical numbers, because they define them. */
const CANONICAL_SOURCES = [
  "docs/internal/CONTEXT.md",
  "src/__tests__/R0_3_pxBudget.test.ts",
  "src/__tests__/R0_7_configDrift.test.ts",
];

/** Config surfaces that agents and instructions are read from. */
const SCANNED_ROOTS = [".claude", ".github/agents", ".github/instructions", ".github/hooks"];
const SCANNED_FILES = ["CLAUDE.md", "AGENTS.md", ".github/COPILOT_SETUP.md"];

/**
 * A suite/test baseline or a px budget written out as a literal. Deliberately
 * pattern-based rather than a list of known-bad numbers: the previous sweeps
 * failed precisely because they searched for the generations someone
 * remembered.
 */
const STALE_NUMBER_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "hardcoded suite count", re: /\b\d{2,4}\s+suites\b/i },
  { label: "hardcoded test count", re: /\b\d{3,5}\s+tests\b/i },
  { label: "hardcoded suites/tests pair", re: /\b\d{2,4}\s*\/\s*\d{3,5}\b(?=[^\n]*\b(?:suite|test)s?\b)/i },
  { label: "hardcoded px budget", re: /px[- ]budget[^\n]{0,40}?[≤<]=?\s*\d+/i },
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function collectConfigFiles(): string[] {
  const files: string[] = [];
  for (const root of SCANNED_ROOTS) files.push(...walk(join(ROOT, root)));
  for (const file of SCANNED_FILES) {
    const full = join(ROOT, file);
    if (existsSync(full)) files.push(full);
  }
  return files.filter((f) => /\.(md|json|ps1|toml|ya?ml)$/i.test(f));
}

const isCanonical = (relPath: string) =>
  CANONICAL_SOURCES.some((c) => relPath.replace(/\\/g, "/") === c);

describe("R0.7 — config drift ratchet", () => {
  const files = collectConfigFiles();

  test("there are config surfaces to scan (the walker still resolves)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  test("no agent or instruction file hardcodes a baseline or px budget", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (isCanonical(rel)) continue;

      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const { label, re } of STALE_NUMBER_PATTERNS) {
          if (re.test(line)) offenders.push(`${rel}:${i + 1} — ${label}: ${line.trim()}`);
        }
      });
    }

    // Point at CONTEXT.md / PX_BUDGET instead of updating the number here.
    expect(offenders).toEqual([]);
  });

  test("CONTEXT.md still carries the canonical baseline these files defer to", () => {
    const context = readFileSync(join(ROOT, "docs/internal/CONTEXT.md"), "utf8");

    expect(context).toMatch(/Canonical baseline/i);
    expect(context).toMatch(/\d{2,4}\s+suites\s*\/\s*\d{3,5}\s+tests/i);
  });
});
