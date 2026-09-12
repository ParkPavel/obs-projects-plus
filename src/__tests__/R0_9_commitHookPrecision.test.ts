/**
 * R0.9 - the commit-branch hook decides by branch, not by substring (#177).
 *
 * `.claude/hooks/check-commit-branch.ps1` is the only thing enforcing invariant
 * 12 (no direct commits to main/master). It had failed in both directions:
 *
 *   - It matched the literal words anywhere in the command text, so a `grep`
 *     whose search PATTERN contained them was blocked, and `ci.yml` could not
 *     be read on main at all.
 *   - It read HEAD before the tool ran. Creating a branch and committing in
 *     one command was blocked, because HEAD was still main at check time;
 *     checking out main and committing in one command was allowed, because
 *     HEAD was still the feature branch at check time. The second is the
 *     violation the rule exists to stop.
 *
 * And the failure mode that argues for testing a hook at all: a PowerShell
 * parse error exits 1, not 2, and Claude Code reads any exit that is not 2 as
 * ALLOW. On 2026-08-31 a single em dash in a double-quoted string silently
 * disabled the entire file - the hook was not enforcing anything and nothing
 * said so. Hence "the hook still compiles" below; it is not a formality, and
 * it is why the hook is ASCII-only.
 *
 * The hook lives under `.claude/`, which is gitignored: a fresh clone and CI
 * have nothing to run, and that is not a failure. Same posture R0.7 takes
 * toward the agent configs it scans. It still guards every machine that HAS
 * the hook, which is where commits are actually made.
 *
 * HEAD comes from throwaway repos in the OS temp dir, not from the checkout
 * running the test, so the expectations do not change with the branch the
 * maintainer happens to be on. Every case is judged in ONE PowerShell process
 * (the hook's own `-Command` entry point); spawning per case cost more than
 * the rest of the suite put together.
 */

import { execFileSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const HOOK = path.resolve(__dirname, "..", "..", ".claude", "hooks", "check-commit-branch.ps1");

const RUNNABLE = process.platform === "win32" && fs.existsSync(HOOK);
const whenRunnable = RUNNABLE ? describe : describe.skip;

const BLOCK = 2;
const ALLOW = 0;

// Assembled rather than written out, so this file does not trip the very hook
// it tests when it appears on a command line.
const COMMIT = ["git", "commit"].join(" ");

/** Judges every case in one process; returns exit code per case id. */
const RUNNER = `
param([string]$Hook, [string]$CasesPath)
$cases = Get-Content -Raw $CasesPath | ConvertFrom-Json
$results = @()
foreach ($c in $cases) {
    Push-Location $c.repo
    try {
        & $Hook -Command $c.command | Out-Null
        $code = $LASTEXITCODE
    } catch {
        $code = -1
    }
    Pop-Location
    $results += [pscustomobject]@{ id = $c.id; code = $code }
}
ConvertTo-Json -Compress -InputObject @($results)
`;

/** A repo whose current branch is \`branch\`, so the hook has a HEAD to read. */
function makeRepo(branch: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r09-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", dir, ...args], { stdio: "pipe", encoding: "utf8" });
  git("init", "-q");
  git("symbolic-ref", "HEAD", `refs/heads/${branch}`);
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "root");
  return dir;
}

whenRunnable("R0.9 - commit-branch hook precision (#177)", () => {
  const verdicts = new Map<string, number>();
  let compileError = "";
  const temps: string[] = [];

  beforeAll(() => {
    const onMain = makeRepo("main");
    const onFeature = makeRepo("feat/x");
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "r09run-"));
    temps.push(onMain, onFeature, work);

    const cases = [
      { id: "commit-on-main", repo: onMain, command: `${COMMIT} -m "msg"` },
      { id: "repo-option", repo: onMain, command: `git -C . commit -m "msg"` },
      { id: "steps-onto-main", repo: onFeature, command: `git checkout main && ${COMMIT} -m "m"` },
      { id: "commit-on-feature", repo: onFeature, command: `${COMMIT} -m "msg"` },
      { id: "branch-then-commit", repo: onMain, command: `git checkout -b feat/y && ${COMMIT} -m "m"` },
      { id: "switch-then-commit", repo: onMain, command: `git switch -c feat/z; ${COMMIT} -m "m"` },
      { id: "grep-mentions", repo: onMain, command: `grep -n "${COMMIT}" .github/workflows/ci.yml` },
      { id: "echo-mentions", repo: onMain, command: `echo "never run ${COMMIT} on main"` },
      { id: "words-in-message", repo: onMain, command: `git checkout -b feat/w && ${COMMIT} -m "on ${COMMIT}"` },
    ];

    const runnerPath = path.join(work, "runner.ps1");
    const casesPath = path.join(work, "cases.json");
    fs.writeFileSync(runnerPath, RUNNER, "utf8");
    fs.writeFileSync(casesPath, JSON.stringify(cases), "utf8");

    const run = spawnSync(
      "powershell",
      ["-NoProfile", "-File", runnerPath, "-Hook", HOOK, "-CasesPath", casesPath],
      { encoding: "utf8" }
    );
    compileError = (run.stderr || "").trim();

    for (const row of JSON.parse(run.stdout) as Array<{ id: string; code: number }>) {
      verdicts.set(row.id, row.code);
    }
  }, 60_000);

  afterAll(() => {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("the hook still compiles - a parse error would exit 1 and allow everything", () => {
    expect(compileError).toBe("");
    expect(verdicts.size).toBe(9);
  });

  it("blocks a real commit on main", () => {
    expect(verdicts.get("commit-on-main")).toBe(BLOCK);
  });

  it("blocks a commit on main reached through git's own repo option", () => {
    // `git -C . commit` never matched the old adjacent-words pattern.
    expect(verdicts.get("repo-option")).toBe(BLOCK);
  });

  it("blocks a sequence that steps ONTO main and then commits", () => {
    // The leak: HEAD is a feature branch at check time, main when it runs.
    expect(verdicts.get("steps-onto-main")).toBe(BLOCK);
  });

  it("allows a commit on a feature branch", () => {
    expect(verdicts.get("commit-on-feature")).toBe(ALLOW);
  });

  it("allows a branch and a commit issued as one command", () => {
    // Both observed on 2026-08-31; each forced a two-call workaround.
    expect(verdicts.get("branch-then-commit")).toBe(ALLOW);
    expect(verdicts.get("switch-then-commit")).toBe(ALLOW);
  });

  it("allows commands that merely mention the words", () => {
    // The grep case made .github/workflows/ci.yml unreadable while on main.
    expect(verdicts.get("grep-mentions")).toBe(ALLOW);
    expect(verdicts.get("echo-mentions")).toBe(ALLOW);
  });

  it("is not fooled by the words appearing in a commit message", () => {
    expect(verdicts.get("words-in-message")).toBe(ALLOW);
  });
});
