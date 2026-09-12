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
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join, relative, sep } from "path";

import {
  EXCLUDED_ANYWHERE,
  EXCLUDED_AT_ROOT,
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
/** Real directory that the fixture's `agents/shared` junction points at. */
let linkTarget: string;

/**
 * Remove a link without touching what it points at.
 *
 * Windows refuses `unlink` on a directory junction and wants `rmdir`; POSIX is
 * the other way round. Neither ever deletes the target — which is the whole
 * point, and the same distinction the worktree protocol turns on.
 */
function unlink(linkPath: string): void {
  try {
    unlinkSync(linkPath);
  } catch {
    rmdirSync(linkPath);
  }
}

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

  // Visible, and the case the Codex audit of #181 caught: `worktrees` is
  // excluded because of WHERE the checkout goes, not because the word is
  // forbidden. A config directory that happens to carry the name, anywhere
  // below the root, is ordinary config and a gate must still read it.
  plant("agents/worktrees/notes.md", TRIPWIRE);

  // Excluded: what `isolation: worktree` leaves behind. A full repository copy,
  // its own dependency tree, and — the shape that made #181 easy to miss — a
  // linked worktree's `.git`, which is a FILE, not a directory.
  plant("worktrees/agent-abc/CHANGELOG.md", TRIPWIRE);
  plant("worktrees/agent-abc/node_modules/pkg/README.md", TRIPWIRE);
  plant(
    "worktrees/agent-abc/.git",
    "gitdir: ../../../.git/worktrees/agent-abc"
  );

  // Excluded: dependency trees and repository internals, at the root and — the
  // difference from `worktrees` — at any depth below it too.
  plant("node_modules/pkg/README.md", TRIPWIRE);
  plant("agents/node_modules/pkg/README.md", TRIPWIRE);
  plant("nested/.git/config", TRIPWIRE);
  plant(".git", "gitdir: elsewhere");

  // Visible: a linked config directory. The second Codex audit of #181 found
  // that an interim version skipped every directory link, which would have
  // hidden real configuration reached this way from all three ratchets.
  linkTarget = mkdtempSync(join(tmpdir(), "ppp-configscan-linked-"));
  writeFileSync(join(linkTarget, "shared-role.md"), TRIPWIRE, "utf8");
  // "junction" is the type that needs no elevation on Windows; on other
  // platforms Node ignores the argument and makes an ordinary symlink.
  symlinkSync(linkTarget, join(fixture, "agents", "shared"), "junction");

  // A link back to an already-walked tree: following it must terminate, and
  // must not report the same file twice under a second name.
  symlinkSync(fixture, join(fixture, "agents", "loop"), "junction");
});

afterAll(() => {
  // Unlink the junctions BEFORE removing the tree that holds them — the same
  // order #181's operational note prescribes for a real worktree, and for the
  // same reason: a recursive delete can follow a link and empty its target.
  unlink(join(fixture, "agents", "loop"));
  unlink(join(fixture, "agents", "shared"));
  rmSync(fixture, { recursive: true, force: true });
  rmSync(linkTarget, { recursive: true, force: true });
});

describe("config walk exclusion is bounded (#181)", () => {
  it("returns config files and nothing out of an excluded subtree", () => {
    expect(asRelative(walkConfigTree(fixture))).toEqual([
      "agents/nested/role.md",
      "agents/probe.md",
      "agents/shared/shared-role.md",
      "agents/worktrees/notes.md",
      "settings.json",
    ]);
  });

  it("follows a linked config directory, and terminates on a link back", () => {
    const walked = asRelative(walkConfigTree(fixture));
    // The link is followed: config reached only through it is still read.
    expect(walked).toContain("agents/shared/shared-role.md");
    // The loop is entered once, so nothing is reported twice under a second
    // name — reaching this assertion at all is the termination proof.
    expect(walked.filter((f) => f.startsWith("agents/loop"))).toEqual([]);
    expect(new Set(walked).size).toBe(walked.length);
  });

  it("excludes only the names it declares, each at its declared scope", () => {
    // Pinned as lists, not counts: these sets decide what a gate can no longer
    // see, so growing either has to be a deliberate edit in two places. The
    // split is the point — `worktrees` is a location, `node_modules` and `.git`
    // are machinery.
    expect([...EXCLUDED_AT_ROOT].sort()).toEqual(["worktrees"]);
    expect([...EXCLUDED_ANYWHERE].sort()).toEqual([".git", "node_modules"]);
  });

  it("`worktrees` is excluded at the root only, never as a nested config directory", () => {
    const walked = asRelative(walkConfigTree(fixture));
    expect(walked).toContain("agents/worktrees/notes.md");
    expect(walked.filter((f) => f.startsWith("worktrees/"))).toEqual([]);
  });

  it("`node_modules` and `.git` are excluded at every depth", () => {
    const walked = asRelative(walkConfigTree(fixture));
    expect(walked.filter((f) => f.includes("node_modules"))).toEqual([]);
    expect(walked.filter((f) => f.includes(".git"))).toEqual([]);
  });

  it("the tripwire inside worktrees/ yields no finding; the same line in agents/ does", () => {
    // Both visible copies must be reported, and only those two: the byte for
    // byte identical file in the root checkout must not appear.
    expect(findings(fixture)).toEqual([
      "agents/probe.md — hardcoded px budget",
      "agents/shared/shared-role.md — hardcoded px budget",
      "agents/worktrees/notes.md — hardcoded px budget",
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
