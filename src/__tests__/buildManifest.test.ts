import { execFileSync } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * w4-p00 (audit F01, F20) — a build handed to a person for acceptance names
 * the exact state it came from. The audit found the OBStests bundle matching
 * neither the branch nor its uncommitted changes, and nothing on disk said so.
 */

const SCRIPT = path.join(__dirname, "..", "..", "scripts", "build-manifest.mjs");

interface BuildRecord {
  schemaVersion: number;
  head: string;
  branch: string;
  dirty: boolean;
  changes: string[];
  files: Record<string, string>;
  version: string | null;
  builtAt: string;
}

/**
 * Fixture git. A process that dies before writing anything is the machine
 * (Windows 0xC0000005 under process pressure), not this test's subject, so it
 * is retried like the script retries; a git that explains itself is not.
 */
const git = (cwd: string, args: string[]): string => {
  let last: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch (err) {
      last = err;
      if (String((err as { stderr?: unknown }).stderr ?? "").trim()) break;
    }
  }
  throw last;
};

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

describe("w4-p00 build manifest", () => {
  let repo: string;
  let build: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "w4p00-repo-"));
    build = path.join(repo, "out");
    git(repo, ["init", "-q", "-b", "borshkit/w4-test"]);
    fs.writeFileSync(path.join(repo, "manifest.json"), JSON.stringify({ version: "9.9.9" }));
    fs.writeFileSync(path.join(repo, ".gitignore"), "out/\n");
    git(repo, ["add", "-A"]);
    git(repo, ["commit", "-q", "-m", "base"]);
    fs.mkdirSync(build);
    fs.writeFileSync(path.join(build, "main.js"), "console.log(1)");
    fs.writeFileSync(path.join(build, "styles.css"), ".a{}");
  });
  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const run = (): BuildRecord => {
    execFileSync(process.execPath, [SCRIPT, "out"], { cwd: repo, stdio: "pipe" });
    return JSON.parse(fs.readFileSync(path.join(build, "build-manifest.json"), "utf8")) as BuildRecord;
  };

  it("names the commit, the branch, the bundle hashes and the version", () => {
    const record = run();
    expect(record.schemaVersion).toBe(1);
    expect(record.head).toBe(git(repo, ["rev-parse", "HEAD"]));
    expect(record.branch).toBe("borshkit/w4-test");
    expect(record.dirty).toBe(false);
    expect(record.changes).toEqual([]);
    expect(record.files).toEqual({ "main.js": sha("console.log(1)"), "styles.css": sha(".a{}") });
    expect(record.version).toBe("9.9.9");
    expect(Number.isNaN(Date.parse(record.builtAt))).toBe(false);
  });

  it("says when the build carries uncommitted changes, and which", () => {
    fs.writeFileSync(path.join(repo, "manifest.json"), JSON.stringify({ version: "9.9.10" }));
    fs.writeFileSync(path.join(repo, "new.ts"), "export {}");
    const record = run();
    expect(record.dirty).toBe(true);
    expect(record.changes.sort()).toEqual(["manifest.json", "new.ts"]);
  });

  it("refuses a build without its bundle instead of writing a half record", () => {
    fs.rmSync(path.join(build, "styles.css"));
    expect(run).toThrow();
    expect(fs.existsSync(path.join(build, "build-manifest.json"))).toBe(false);
  });
});
