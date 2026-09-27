import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * R0.27 — versions follow the Obsidian catalogue natively.
 *
 * `main` carries a strict x.y.z in package.json, package-lock.json and
 * manifest.json. `npm version X` only synchronizes; it never increments. A
 * beta is a tag `x.y.z-beta.N` whose manifest asset is staged in CI with
 * version = tag and is never committed.
 */

const ROOT = path.join(__dirname, "..", "..");
const BUMP = path.join(ROOT, "scripts", "version-bump.mjs");
const STAGE = path.join(ROOT, "scripts", "stage-release-manifest.mjs");
const STRICT = /^\d+\.\d+\.\d+$/;

interface Metadata {
  version?: string;
  minAppVersion?: string;
  [key: string]: unknown;
}

const readJson = (file: string): Metadata =>
  JSON.parse(fs.readFileSync(file, "utf8")) as Metadata;

interface Run {
  status: number;
  stderr: string;
}

function run(script: string, args: string[], cwd: string): Run {
  try {
    execFileSync(process.execPath, [script, ...args], { cwd, stdio: "pipe" });
    return { status: 0, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stderr?: Buffer };
    return { status: err.status ?? 1, stderr: String(err.stderr ?? "") };
  }
}

describe("R0.27 version workflow", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "r027-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function fixture(pkgVersion: string, manifestVersion: string, versions: Record<string, string>): void {
    const w = (name: string, value: unknown): void =>
      fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + "\n");
    w("package.json", { name: "obs-projects-plus", version: pkgVersion });
    w("manifest.json", {
      id: "obs-projects-plus",
      name: "OBS Projects Plus",
      version: manifestVersion,
      minAppVersion: "1.5.7",
      description: "d",
      isDesktopOnly: false,
    });
    w("versions.json", versions);
  }

  const snapshot = (): string =>
    ["package.json", "manifest.json", "versions.json"]
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .join("\u0000");

  describe("repository state", () => {
    it("carries one strict version everywhere, mapped in versions.json", () => {
      const pkg = readJson(path.join(ROOT, "package.json"));
      const manifest = readJson(path.join(ROOT, "manifest.json"));
      const lock = readJson(path.join(ROOT, "package-lock.json")) as {
        version: string;
        packages: Record<string, { version: string }>;
      };
      const versions = readJson(path.join(ROOT, "versions.json")) as Record<string, string>;

      expect(pkg.version).toMatch(STRICT);
      expect(manifest.version).toBe(pkg.version);
      expect(lock.version).toBe(pkg.version);
      expect(lock.packages[""]?.version).toBe(pkg.version);
      for (const key of Object.keys(versions)) expect(key).toMatch(STRICT);
      expect(versions[pkg.version as string]).toBe(manifest.minAppVersion);
    });

    it("has no legacy beta manifest path", () => {
      expect(fs.existsSync(path.join(ROOT, "manifest-beta.json"))).toBe(false);
      expect(fs.existsSync(path.join(ROOT, "version-beta-manifest.mjs"))).toBe(false);
    });
  });

  describe("version-bump synchronizer", () => {
    it("copies a strict version verbatim without incrementing", () => {
      fixture("3.6.1", "3.6.0", { "3.6.0": "1.5.7", "3.6.1-beta.1": "1.5.7", "2.0.0-beta": "1.5.7" });
      const r = run(BUMP, [], dir);
      expect(r.stderr).toBe("");
      expect(r.status).toBe(0);
      expect(readJson(path.join(dir, "package.json")).version).toBe("3.6.1");
      expect(readJson(path.join(dir, "manifest.json")).version).toBe("3.6.1");
      expect(readJson(path.join(dir, "versions.json"))).toEqual({
        "3.6.0": "1.5.7",
        "3.6.1": "1.5.7",
      });
    });

    it("mirrors a prerelease into the manifest but not into versions.json", () => {
      fixture("3.7.0-beta.1", "3.6.0", { "3.6.0": "1.5.7" });
      const r = run(BUMP, [], dir);
      expect(r.status).toBe(0);
      expect(readJson(path.join(dir, "manifest.json")).version).toBe("3.7.0-beta.1");
      expect(readJson(path.join(dir, "versions.json"))).toEqual({ "3.6.0": "1.5.7" });
    });
  });

  describe("stage-release-manifest", () => {
    const out = (): string => path.join(dir, "out");
    const stage = (tag: string): Run => run(STAGE, [tag, out()], dir);

    it("exists", () => {
      expect(fs.existsSync(STAGE)).toBe(true);
    });

    it("stages a beta manifest with version = tag and leaves tracked files alone", () => {
      fixture("3.6.0", "3.6.0", { "3.6.0": "1.5.7" });
      const before = snapshot();
      const r = stage("3.6.1-beta.2");
      expect(r.stderr).toBe("");
      expect(r.status).toBe(0);
      expect(readJson(path.join(out(), "manifest.json"))).toEqual({
        ...readJson(path.join(dir, "manifest.json")),
        version: "3.6.1-beta.2",
      });
      expect(snapshot()).toBe(before);
    });

    it("stages a stable manifest unchanged when tag equals the committed version", () => {
      fixture("3.6.0", "3.6.0", { "3.6.0": "1.5.7" });
      const r = stage("3.6.0");
      expect(r.status).toBe(0);
      expect(readJson(path.join(out(), "manifest.json"))).toEqual(readJson(path.join(dir, "manifest.json")));
    });

    it.each([
      ["a stable tag differing from the committed version", "3.6.1"],
      ["a beta whose core equals the committed version", "3.6.0-beta.1"],
      ["a beta whose core is lower", "3.5.0-beta.1"],
      ["a malformed tag", "v3.6.1"],
      ["a non-beta prerelease", "3.6.1-alpha"],
    ])("rejects %s", (_label, tag) => {
      fixture("3.6.0", "3.6.0", { "3.6.0": "1.5.7" });
      const r = stage(tag);
      expect(r.status).not.toBe(0);
      expect(fs.existsSync(path.join(out(), "manifest.json"))).toBe(false);
    });
  });

  describe("release.yml wiring", () => {
    const yml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "release.yml"), "utf8");

    it("stages the manifest and uploads the staged copy", () => {
      expect(yml).toContain("scripts/stage-release-manifest.mjs");
      expect(yml).not.toMatch(/main\.js\s+manifest\.json\s+styles\.css/);
    });

    it("marks only -beta.N tags as prerelease", () => {
      // The workflow names the beta pattern as a regex or glob: -beta\.[0-9]+, -beta\.\d+ or -beta.[0-9]
      expect(yml).toMatch(/-beta\\?\.(?:\[0-9\]|\\d)/);
    });

    it("corrects an existing release's title and prerelease flag on rerun", () => {
      expect(yml).toMatch(/gh release edit "\$tag" --title="\$tag" "\$prerelease"/);
      expect(yml).toContain('prerelease="--prerelease=false"');
      expect(yml).not.toMatch(/\*-\*\)\s*prerelease=/);
    });
  });
});
