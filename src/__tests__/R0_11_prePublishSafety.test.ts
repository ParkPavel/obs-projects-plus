import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * R0.11 — nothing publishable carries a secret
 *
 * The working-stack configuration (`.claude/`, `.codex/`, `.agents/`) is local
 * and gitignored today, and is intended to become an open-source repository once
 * the setup has settled. That plan is the hazard: the moment those directories
 * are published, everything in them is public forever, and one of them holds a
 * live Obsidian REST API key right now.
 *
 * So the split is drawn here, while it is cheap:
 *
 * - **PUBLISHABLE** — role definitions, commands, hooks, project config. These
 *   describe *how* the work is done and are the point of publishing. They must
 *   contain no credential, ever.
 * - **QUARANTINED** — files that legitimately hold machine-specific secrets.
 *   `settings.local.json` is exactly what its name promises. These must never
 *   leave the machine, so the assertion is that git refuses to track them.
 *
 * The test reports the KIND and LOCATION of a finding and never the value: a
 * failing assertion that prints the secret it found would leak it into CI logs
 * and into this repository's own history.
 *
 * Absolute machine paths and personal handles are NOT failures — they are
 * functional configuration today (the `filesystem` MCP root is a real path).
 * They are reported by `npm run publish-check` as a templating checklist instead
 * of being failed here, because breaking a working setup to satisfy a future
 * publish would be the wrong trade.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const LAYERS = [".claude", ".codex", ".agents"].map((d) => path.join(ROOT, d));

const RUNNABLE = LAYERS.some((d) => fs.existsSync(d));
const whenRunnable = RUNNABLE ? describe : describe.skip;

/** Files that may hold a secret, and therefore must never be tracked. */
const QUARANTINE = [".claude/settings.local.json", ".codex/settings.local.json"];

/**
 * Credential shapes. Deliberately narrow: a broad pattern that fires on ordinary
 * prose gets disabled, and a disabled guard is worse than none.
 */
const CREDENTIAL_RULES: ReadonlyArray<{ kind: string; re: RegExp }> = [
  { kind: "long hex token (>=32 chars)", re: /\b[0-9a-f]{32,}\b/i },
  {
    kind: "credential assignment",
    re: /\b(api[_-]?key|apikey|token|secret|password|bearer)\b\s*[:=]\s*["'][^"']{8,}["']/i,
  },
  { kind: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const TEXT = /\.(md|json|ps1|toml|ya?ml|mjs|js|sh)$/i;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (TEXT.test(full)) out.push(full);
  }
  return out;
}

function isQuarantined(file: string): boolean {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  return QUARANTINE.includes(rel);
}

whenRunnable("R0.11 - pre-publish safety", () => {
  it("no publishable config file carries a credential", () => {
    const offenders: string[] = [];
    for (const layer of LAYERS) {
      for (const file of walk(layer)) {
        if (isQuarantined(file)) continue;
        const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
        lines.forEach((line, i) => {
          for (const rule of CREDENTIAL_RULES) {
            // Report kind and location. NEVER the matched value: a failure
            // message is written to logs, and that would publish the secret
            // this test exists to protect.
            if (rule.re.test(line)) {
              offenders.push(
                `${path.relative(ROOT, file).split(path.sep).join("/")}:${i + 1} — ${rule.kind}`
              );
            }
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every quarantined file is refused by git", () => {
    // The API key lives in settings.local.json by design. The guarantee that
    // matters is not that it is clean, but that it cannot be committed.
    const tracked: string[] = [];
    for (const rel of QUARANTINE) {
      const full = path.join(ROOT, rel);
      if (!fs.existsSync(full)) continue;
      try {
        execFileSync("git", ["check-ignore", "-q", rel], { cwd: ROOT, stdio: "pipe" });
      } catch {
        tracked.push(rel); // check-ignore exits non-zero when NOT ignored
      }
    }
    expect(tracked).toEqual([]);
  });

  it("the config layers themselves are refused by git", () => {
    // Until the user decides to publish deliberately, none of this may be
    // committed by accident.
    const notIgnored: string[] = [];
    for (const dir of [".claude", ".codex", ".agents"]) {
      if (!fs.existsSync(path.join(ROOT, dir))) continue;
      try {
        execFileSync("git", ["check-ignore", "-q", dir], { cwd: ROOT, stdio: "pipe" });
      } catch {
        notIgnored.push(dir);
      }
    }
    expect(notIgnored).toEqual([]);
  });
});
