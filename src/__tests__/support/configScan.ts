/**
 * Shared traversal for the config-layer ratchets — R0.7, R0.10, R0.11.
 *
 * All three walk `.claude/` / `.codex/` / `.agents/` / `.github/` and each
 * carried its own private copy of the same recursive `walk`. Three copies of a
 * predicate is three chances to fix a hole in one of them, which is the exact
 * defect class R0.10 exists for — so the predicate lives here once.
 *
 * Why exclusions are needed at all (#181, found 2026-09-01 by a live run, not
 * by reasoning): a delegated agent with `isolation: worktree` puts a **full
 * repository copy** at `.claude/worktrees/<agent-id>/`, inside the scanned
 * root. After one such run `npx jest` went red on R0.7, R0.10 and R0.11 with
 * 156 findings, every one of them the copy's own `CHANGELOG.md` rather than
 * anything about the change under test.
 *
 * The failure was worse than noisy, because it was asymmetric: inside the
 * worktree there is no `.claude/` of its own, so the same three suites *skip*
 * there. The main tree saw false failures and the agent saw false silence.
 * Neither side saw the truth, which is the definition of a hole in a gate.
 *
 * Scanning `.claude/` is right. What is wrong is that a checkout lives inside
 * it. So the walk stops at the boundary of a nested checkout and at dependency
 * trees, and nowhere else — see `configScanBoundary.test.ts`, which proves the
 * exclusion in both directions so it can never quietly grow to swallow a real
 * finding.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Directory (or file) names the config walk never descends into.
 *
 * Matched by name at any depth, because a nested checkout may itself contain
 * one. Keep this set minimal: every name added here is a place a real finding
 * could hide.
 *
 * - `worktrees` — where `isolation: worktree` places a full repository copy.
 * - `node_modules` — a dependency tree, and inside a worktree it is a junction
 *   pointing back at the real one, so following it rescans the whole project.
 * - `.git` — repository internals. Excluded by plain name rather than by type
 *   on purpose: in a linked worktree `.git` is a **file** (`gitdir: …`), not a
 *   directory, so a type-conditional check would miss exactly the case #181 is
 *   about.
 */
export const EXCLUDED_DIR_NAMES: ReadonlySet<string> = new Set([
  "worktrees",
  "node_modules",
  ".git",
]);

/**
 * Every file under `dir`, recursively, skipping `EXCLUDED_DIR_NAMES`.
 *
 * Returns absolute paths and an empty list for a directory that does not exist
 * — a fresh clone has no config layers at all, and that is not a failure.
 *
 * Symlinked directories (Windows junctions included) are listed but never
 * descended into: the junction an agent leaves behind points back into the real
 * tree, so following it both rescans the project under a second path and can
 * cycle. Symlinked *files* are still returned — a config file is a config file
 * however it got there.
 */
export function walkConfigTree(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;

    const full = join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      let target;
      try {
        target = statSync(full);
      } catch {
        continue; // broken link: nothing to read, and throwing here would take the gate down
      }
      if (!target.isDirectory()) out.push(full);
      continue;
    }

    if (entry.isDirectory()) walkConfigTree(full, out);
    else out.push(full);
  }

  return out;
}

/**
 * A suite/test baseline or a px budget written out as a literal — R0.7's rule.
 *
 * Deliberately pattern-based rather than a list of known-bad numbers: the
 * sweeps that preceded R0.7 failed precisely because they searched for the
 * generation of numbers somebody remembered.
 *
 * It lives here rather than in `R0_7_configDrift.test.ts` so that the boundary
 * test can assert against the **real** rule. A boundary proved with a stand-in
 * pattern would only prove the stand-in.
 */
export const STALE_NUMBER_PATTERNS: ReadonlyArray<{
  label: string;
  re: RegExp;
}> = [
  { label: "hardcoded suite count", re: /\b\d{2,4}\s+suites\b/i },
  { label: "hardcoded test count", re: /\b\d{3,5}\s+tests\b/i },
  {
    label: "hardcoded suites/tests pair",
    re: /\b\d{2,4}\s*\/\s*\d{3,5}\b(?=[^\n]*\b(?:suite|test)s?\b)/i,
  },
  { label: "hardcoded px budget", re: /px[- ]budget[^\n]{0,40}?[≤<]=?\s*\d+/i },
];
