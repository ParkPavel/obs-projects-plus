/**
 * The config walk's exclusion is bounded — #181.
 *
 * R0.7, R0.10 and R0.11 stopped seeing a nested checkout inside `.claude/`.
 * That fix is one line of set membership, and one line of set membership is
 * exactly the kind of thing that quietly grows until a real finding falls
 * through it. An exclusion is only safe when both directions are pinned:
 *
 *   - a file planted inside `worktrees/` yields NO finding, and
 *   - the same file planted in `agents/` DOES.
 *
 * Without the second half, excluding everything would pass.
 *
 * Everything here runs against a temp fixture. The real `.claude/` is never
 * touched: a test that plants a number-shaped or credential-shaped string in
 * the live config layer to prove a point would be racing the very ratchets it
 * is proving, and would leave debris behind on a failure.
 */

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join, relative, sep } from "path";

import {
  EXCLUDED_DIR_NAMES,
  STALE_NUMBER_PATTERNS,
  walkConfigTree,
} from "./support/configScan";

/**
 * A line that trips R0.7's px-budget rule wherever the walk can see it.
 *
 * The number is deliberately not the real budget. What is under test is the
 * *shape* the rule matches, and copying the canonical value into a second file
 * is the drift R0.7 exists to stop — it would be absurd for its own boundary
 * test to commit it.
 */
const TRIPWIRE = "px-budget <= 4242";

let fixture: string;

/** Write `body` to `relPath` under the fixture, creating parents. */
function plant(relPath: string, body: string): void {
  const full = join(fixture, ...relPath.split("/"));
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, body, "utf8");
}

const asRelative = (files: string[]): string[] =>
  files.map((f) => relative(fixture, f).split(sep).join("/")).sort();

/** Every stale-number finding the shared rule produces over a walked tree. */
function findings(root: string): string[] {
  return walkConfigTree(root)
    .filter((f) => /\.(md|json)$/i.test(f))
    .flatMap((file) => {
      const rel = relative(root, file).split(sep).join("/");
      // Reading the planted body back is the point. The direction that matters
      // is not "the path was skipped" but "the rule found nothing to report".
      const text = readFileSync(file, "utf8");
      return STALE_NUMBER_PATTERNS.filter(({ re }) => re.test(text)).map(
        ({ label }) => `${rel} — ${label}`
      );
    })
    .sort();
}

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), "ppp-configscan-"));

  // Visible: ordinary config, at the root and nested.
  plant("agents/probe.md", TRIPWIRE);
  plant("agents/nested/role.md", "no numbers here");
  plant("settings.json", "{}");

  // Excluded: what `isolation: worktree` leaves behind. A full repository copy,
  // its own dependency tree, and — the shape that made #181 easy to miss — a
  // linked worktree's `.git`, which is a FILE, not a directory.
  plant("worktrees/agent-abc/CHANGELOG.md", TRIPWIRE);
  plant("worktrees/agent-abc/node_modules/pkg/README.md", TRIPWIRE);
  plant(
    "worktrees/agent-abc/.git",
    "gitdir: ../../../.git/worktrees/agent-abc"
  );

  // Excluded: dependency trees and repository internals under the root itself.
  plant("node_modules/pkg/README.md", TRIPWIRE);
  plant("nested/.git/config", TRIPWIRE);
  plant(".git", "gitdir: elsewhere");
});

afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});

describe("config walk exclusion is bounded (#181)", () => {
  it("returns config files and nothing out of an excluded subtree", () => {
    expect(asRelative(walkConfigTree(fixture))).toEqual([
      "agents/nested/role.md",
      "agents/probe.md",
      "settings.json",
    ]);
  });

  it("excludes only the three names it declares", () => {
    // Pinned as a list, not a count: this set decides what a gate can no longer
    // see, so growing it has to be a deliberate edit in two places.
    expect([...EXCLUDED_DIR_NAMES].sort()).toEqual([
      ".git",
      "node_modules",
      "worktrees",
    ]);
  });

  it("the tripwire inside worktrees/ yields no finding; the same line in agents/ does", () => {
    expect(findings(fixture)).toEqual([
      "agents/probe.md — hardcoded px budget",
    ]);
  });

  it("the identical file DOES produce a finding once it is not in a worktree", () => {
    // The negative half proves nothing alone — a walk returning an empty list
    // would satisfy it. Move the byte-identical file out of the excluded
    // subtree and the rule must fire on it.
    const moved = mkdtempSync(join(tmpdir(), "ppp-configscan-moved-"));
    try {
      mkdirSync(join(moved, "agents"), { recursive: true });
      writeFileSync(join(moved, "agents", "CHANGELOG.md"), TRIPWIRE, "utf8");
      expect(findings(moved)).toEqual([
        "agents/CHANGELOG.md — hardcoded px budget",
      ]);
    } finally {
      rmSync(moved, { recursive: true, force: true });
    }
  });

  it("a missing directory walks to an empty list rather than throwing", () => {
    // A fresh clone has no config layers at all, and that is not a failure.
    expect(walkConfigTree(join(fixture, "does-not-exist"))).toEqual([]);
  });
});
