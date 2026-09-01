import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * R0.12 — every protective hook compiles, and the destructive-git guard is precise
 *
 * `R0.9` pins `check-commit-branch` after #177. Nothing pinned the others, and on
 * 2026-09-01 that cost us: `check-destructive-git` carried the *same* defect #177
 * had fixed — a single match over the whole command text — and had simply been
 * left out of that ticket's scope. It blocked any command that merely mentioned a
 * destructive operation, and was found only because it fired on a diagnostic that
 * held the patterns in a test-data array.
 *
 * It was then rewritten and checked by hand, 8 cases out of 8. Hand-checking is
 * how the first one passed too. So this ratchet holds the fix.
 *
 * The compile case matters most and is easy to underrate: Windows PowerShell 5.1
 * reads a BOM-less `.ps1` as ANSI, so one non-ASCII character breaks the parse —
 * and **a parse error exits 1, which the harness reads as ALLOW**. A hook that
 * fails to compile does not fail closed. It stops guarding, silently. That
 * happened during the #177 work, from a single em dash.
 *
 * The hooks live under `.claude/`, which is gitignored, so this skips on a clean
 * clone — the contract `R0.9` and `R0.10` already use.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const HOOK_DIR = path.join(ROOT, ".claude", "hooks");
const DESTRUCTIVE = path.join(HOOK_DIR, "check-destructive-git.ps1");

const RUNNABLE = process.platform === "win32" && fs.existsSync(DESTRUCTIVE);
const whenRunnable = RUNNABLE ? describe : describe.skip;

const BLOCK = 2;
const ALLOW = 0;

/** Judges every case in one PowerShell process; per-case spawning cost 24s. */
const RUNNER = `
param([string]$Hook, [string]$CasesPath)
$cases = Get-Content -Raw $CasesPath | ConvertFrom-Json
$results = @()
foreach ($c in $cases) {
    try {
        & $Hook -Command $c.command | Out-Null
        $code = $LASTEXITCODE
    } catch {
        $code = -1
    }
    $results += [pscustomobject]@{ id = $c.id; code = $code }
}
ConvertTo-Json -Compress -InputObject @($results)
`;

// Assembled, so this file does not trip the very hook it tests when the text
// appears on a command line.
const RESET = ["git", "reset", "--hard"].join(" ");
const FORCE = ["git", "push", "--force"].join(" ");

whenRunnable("R0.12 - protective hook precision", () => {
  const verdicts = new Map<string, number>();
  let runnerError = "";
  const temps: string[] = [];

  beforeAll(() => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "r012-"));
    temps.push(work);

    const cases = [
      // Real invocations — must block.
      { id: "reset-hard", command: `${RESET} HEAD~1` },
      { id: "force-push", command: `${FORCE} origin main` },
      { id: "repo-option", command: `git -C . ${["reset", "--hard"].join(" ")}` },
      { id: "clean-fd", command: "git clean -fd" },
      // Mentions and neighbours — must pass. This is the class the old
      // implementation blocked, making it impossible to read or write about the
      // commands it guards.
      { id: "plain-status", command: "git status" },
      { id: "ordinary-push", command: "git push origin main" },
      { id: "mention-in-string", command: `echo "never use ${RESET} here"` },
      { id: "mention-in-grep", command: `grep -n "${FORCE}" ci.yml` },
      { id: "unrelated-reset", command: "git reset HEAD~1" },
    ];

    const runnerPath = path.join(work, "runner.ps1");
    const casesPath = path.join(work, "cases.json");
    fs.writeFileSync(runnerPath, RUNNER, "utf8");
    fs.writeFileSync(casesPath, JSON.stringify(cases), "utf8");

    const run = spawnSync(
      "powershell",
      ["-NoProfile", "-File", runnerPath, "-Hook", DESTRUCTIVE, "-CasesPath", casesPath],
      { encoding: "utf8" }
    );
    runnerError = (run.stderr || "").trim();

    if (run.stdout && run.stdout.trim()) {
      for (const row of JSON.parse(run.stdout) as Array<{ id: string; code: number }>) {
        verdicts.set(row.id, row.code);
      }
    }
  }, 60_000);

  afterAll(() => {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("every protective hook compiles - a parse error exits 1 and reads as ALLOW", () => {
    const broken: string[] = [];
    for (const file of fs.readdirSync(HOOK_DIR).filter((f) => f.endsWith(".ps1"))) {
      const probe = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          "$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile(" +
            `'${path.join(HOOK_DIR, file).replace(/'/g, "''")}'` +
            ", [ref]$null, [ref]$e); if ($e -and $e.Count) { exit 1 } else { exit 0 }",
        ],
        { encoding: "utf8" }
      );
      if (probe.status !== 0) broken.push(file);
    }
    expect(broken).toEqual([]);
  });

  it("the destructive-git hook ran every case", () => {
    expect(runnerError).toBe("");
    expect(verdicts.size).toBe(9);
  });

  it("blocks a real hard reset", () => {
    expect(verdicts.get("reset-hard")).toBe(BLOCK);
  });

  it("blocks a force push", () => {
    expect(verdicts.get("force-push")).toBe(BLOCK);
  });

  it("blocks a destructive call reached through git's own repo option", () => {
    expect(verdicts.get("repo-option")).toBe(BLOCK);
  });

  it("blocks a forced clean", () => {
    expect(verdicts.get("clean-fd")).toBe(BLOCK);
  });

  it("allows ordinary git", () => {
    expect(verdicts.get("plain-status")).toBe(ALLOW);
    expect(verdicts.get("ordinary-push")).toBe(ALLOW);
  });

  it("allows a soft reset - only --hard is destructive", () => {
    expect(verdicts.get("unrelated-reset")).toBe(ALLOW);
  });

  it("allows commands that merely mention the operation", () => {
    // The defect that made this ratchet necessary: reading or writing ABOUT a
    // destructive command was indistinguishable from running one.
    expect(verdicts.get("mention-in-string")).toBe(ALLOW);
    expect(verdicts.get("mention-in-grep")).toBe(ALLOW);
  });
});
