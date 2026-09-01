import * as fs from "fs";
import * as path from "path";

/**
 * R0.10 — the paired Claude + Codex working stack stays whole
 *
 * The two halves of the setup are meant to mirror each other: the same agent
 * roster on each side, the same protective hooks, the same rules. Nothing
 * verified that, and on 2026-09-01 an audit found four defects that had been
 * live for weeks:
 *
 * 1. All nine `.codex/agents/*.toml` were mojibake — UTF-8 read as cp1251 during
 *    the migration from `.claude/agents/*.md`. `>=2` had become two Cyrillic
 *    characters. These files are instructions to an agent, so the corruption
 *    was quietly degrading them.
 * 2. `check-push-branch` was removed from the Claude layer by the user and left
 *    registered in the Codex one, so a gate the user had lifted was still down
 *    for half the pair.
 * 3. The #177 fix to `check-commit-branch.ps1` reached `.claude/hooks/` only.
 *    The Codex copy stayed on the old 18-line version — the one that both
 *    blocked innocent commands and let "checkout main, then commit" through.
 * 4. `R0_7_configDrift` named `.codex` in its own header and never scanned it.
 *
 * None of this was catchable. `R0.5` (U+FFFD) reads `src/` only, and would not
 * have caught defect 1 even there: mangled cp1251 decodes to *valid* letters,
 * not replacement characters. So this ratchet checks the config layers the way
 * the others check the source.
 *
 * Both layers are gitignored, so on a fresh clone they do not exist. Absent
 * layers skip rather than fail — the contract `R0.9` uses for the hook it tests.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const CLAUDE = path.join(ROOT, ".claude");
const CODEX = path.join(ROOT, ".codex");

const RUNNABLE = fs.existsSync(CLAUDE) && fs.existsSync(CODEX);
const whenRunnable = RUNNABLE ? describe : describe.skip;

/**
 * Lead characters of the cp1251 corruption signature, as code points.
 *
 * Written as numbers on purpose. The first version of this check used a regex
 * literal containing the corrupted characters themselves, which made the test's
 * own file encoding part of the assertion — it reported two files that a
 * standalone probe on the same bytes found clean, and the disagreement was in
 * the literal rather than in the data. A detector for encoding damage must not
 * itself be encodable wrong, so nothing here is non-ASCII.
 *
 * When UTF-8 is misread as cp1251, each original character becomes two or three:
 * a lead from this set, followed by a symbol out of Latin-1 punctuation, general
 * punctuation, or the Cyrillic supplement — a combination ordinary prose does
 * not produce.
 */
const MOJIBAKE_LEAD: ReadonlySet<number> = new Set([
  0x0412, 0x0420, 0x0421, 0x0422, // capital VE, ER, ES, TE
  0x0432, 0x0440, 0x0441, 0x0442, // small ve, er, es, te
]);

function isMojibakeTail(cp: number): boolean {
  return (
    (cp >= 0x0080 && cp <= 0x00bf) || // Latin-1 punctuation and symbols
    (cp >= 0x2010 && cp <= 0x20ff) || // general punctuation, currency
    (cp >= 0x0490 && cp <= 0x04ff) // Cyrillic supplement
  );
}

/** True when the text carries the two-character signature of cp1251 damage. */
function hasMojibake(text: string): boolean {
  const cps = [...text].map((c) => c.codePointAt(0) as number);
  for (let i = 0; i < cps.length - 1; i++) {
    if (MOJIBAKE_LEAD.has(cps[i] as number) && isMojibakeTail(cps[i + 1] as number)) return true;
  }
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const TEXT = /\.(md|json|ps1|toml|ya?ml|mjs|js)$/i;

function textFiles(dir: string): string[] {
  return walk(dir).filter((f) => TEXT.test(f));
}

/** Agent names declared in a layer, taken from filenames. */
function agentNames(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => path.basename(f, ext))
    .sort();
}

whenRunnable("R0.10 - paired working stack integrity", () => {
  it("no config file carries cp1251-mangled UTF-8", () => {
    const offenders = [...textFiles(CLAUDE), ...textFiles(CODEX)]
      .filter((f) => hasMojibake(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("no config file carries a U+FFFD replacement character", () => {
    // The other half of the encoding story: bytes that failed to decode at all.
    // R0.5 asserts this for src/; the config layers had no equivalent.
    const offenders = [...textFiles(CLAUDE), ...textFiles(CODEX)]
      .filter((f) => fs.readFileSync(f, "utf8").includes(String.fromCharCode(0xfffd)))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  /**
   * Which regime the pair is in.
   *
   * `MIRRORED` until 2026-09-01: the Codex roster was migrated one-for-one from
   * the Claude one. That was the source of the rot this ratchet was built for —
   * nine jobs described in eighteen files, so a fix could land in one copy and
   * not the other, and did (the #177 hook, the lifted push gate, the cp1251
   * damage on one side only).
   *
   * `DISJOINT` since 2026-09-01, per WORKING_STACK_DESIGN_2026-09-01.md: one
   * job, one owner, one model. Claude keeps authorship and decisions (lead,
   * architect, designer, implementer, tester); Codex keeps execution and
   * adversarial verification (code-mapper, flow-auditor, adversarial-reviewer,
   * auditor). A name appearing in BOTH layers now means someone re-introduced a
   * mirror, which is the defect this regime exists to prevent.
   */
  // Widened deliberately: a plain annotated const narrows to its literal, and
  // TypeScript then rejects the other branch as unreachable — which would make
  // flipping the regime a compile error instead of a one-line edit.
  const ROSTER_REGIME = "DISJOINT" as "MIRRORED" | "DISJOINT";

  it("the roster relationship matches the declared regime", () => {
    const claude = agentNames(path.join(CLAUDE, "agents"), ".md");
    const codex = agentNames(path.join(CODEX, "agents"), ".toml");
    expect(claude.length).toBeGreaterThan(0);
    expect(codex.length).toBeGreaterThan(0);

    if (ROSTER_REGIME === "MIRRORED") {
      // A role on one side only is a hole in the pair: work routed to it stops
      // at the layer that lacks it.
      expect(codex).toEqual(claude);
    } else {
      // One job, one owner. Any shared name is a mirror creeping back.
      const shared = codex.filter((name) => claude.includes(name));
      expect(shared).toEqual([]);
    }
  });

  it("every config file that claims to be JSON parses as JSON", () => {
    const broken: string[] = [];
    for (const file of [...walk(CLAUDE), ...walk(CODEX)].filter((f) => f.endsWith(".json"))) {
      try {
        JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (error) {
        broken.push(`${path.relative(ROOT, file)}: ${(error as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("a hook present in both layers has the same implementation in both", () => {
    // Defect 3: a fix landed in one layer and not the other, so the two models
    // were governed by different rules while appearing to share them.
    const claudeHooks = path.join(CLAUDE, "hooks");
    const codexHooks = path.join(CODEX, "hooks");
    if (!fs.existsSync(claudeHooks) || !fs.existsSync(codexHooks)) return;

    const diverged = fs
      .readdirSync(claudeHooks)
      .filter((f) => f.endsWith(".ps1") && fs.existsSync(path.join(codexHooks, f)))
      .filter(
        (f) =>
          fs.readFileSync(path.join(claudeHooks, f), "utf8") !==
          fs.readFileSync(path.join(codexHooks, f), "utf8")
      );
    expect(diverged).toEqual([]);
  });

  it("the same protective hooks are registered on both sides", () => {
    const settingsPath = path.join(CLAUDE, "settings.json");
    const hooksPath = path.join(CODEX, "hooks.json");
    if (!fs.existsSync(settingsPath) || !fs.existsSync(hooksPath)) return;

    const scripts = (blob: string): string[] =>
      [...new Set([...blob.matchAll(/([a-z0-9-]+)\.ps1/gi)].map((m) => m[1] as string))].sort();

    // Defect 2: the user lifted the push gate for Claude and it stayed down for
    // Codex. Whatever the roster is, it must be one decision, not two.
    expect(scripts(fs.readFileSync(hooksPath, "utf8"))).toEqual(
      scripts(fs.readFileSync(settingsPath, "utf8"))
    );
  });
});
