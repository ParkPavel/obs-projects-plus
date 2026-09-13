/**
 * R0.25 — documentation comes in pairs.
 *
 * Every documentation page exists in Russian and in English. The twin of a file
 * is the same path with a suffix naming its language: `README.md` pairs with
 * `README-EN.md`, `CONTRIBUTING.md` with `CONTRIBUTING-RU.md`. The suffix is a
 * claim about the language inside, so the test holds it to it: a `-RU` twin
 * written in English fails here. Comparing the two sides without knowing which
 * is which is what let that pass before.
 *
 * Four pages carry both languages inside one file: the documentation index and
 * the error-code table, because their English text is copied from the code
 * rather than translated by hand, and the demo vault's and templates' README,
 * because a reader meets them inside Obsidian and a second file is a worse
 * answer than two paragraphs on one screen. For those the test asks the
 * opposite question — that the single file really does contain both languages
 * — so that nobody can satisfy the pairing rule by deleting one half of a
 * bilingual page.
 *
 * The set of pages is not a list maintained by hand: the test walks the
 * directories documentation lives in and asks disk and git what belongs there,
 * so a page added in one language and forgotten in the other fails on its own
 * without anyone remembering to add it to a table first.
 *
 * Discovery alone cannot catch a pair that vanishes by being renamed on both
 * sides at once — README.md and README-EN.md becoming GUIDE.md and
 * GUIDE-EN.md still discovers as a valid pair, even though every doc and
 * every reader that reaches "README" by name now finds nothing. A page a
 * reader is sent to by name is an invariant, not an implementation detail, so
 * a floor list below names the eight pairs that exist today and must keep
 * existing under those names. The floor is a lower bound, not the source of
 * truth: it does not need editing when a new pair is added correctly, only
 * when one of today's eight is deliberately renamed or removed.
 */

import { execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..", "..");

/**
 * Pages whose two languages live in one file, and why a second file would be
 * the wrong answer for each: the index and the error-code table copy their
 * English text from the code, and the demo vault's and templates' README are
 * short pages read inside Obsidian rather than a browser.
 */
const BILINGUAL = ["docs/README.md", "docs/ERROR_CODES.md", "demo-vault/README.md", "templates/README.md"];

/** Directories documentation pages live under, walked recursively. */
const DOC_DIRS = ["docs", "demo-vault", "templates", "obsidian-projects-types"];

/**
 * The pairs discovery finds on disk today, named here as a floor rather than
 * a source of truth: consistently renaming both halves of one of these
 * — same suffix, same languages, same reciprocal links — would still
 * discover as a valid pair, so discovery alone cannot notice that the page a
 * reader was sent to by name is gone. A page added correctly does not touch
 * this list; a page in it renamed or removed does, and should say so in the
 * same commit.
 */
const FLOOR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["README.md", "README-EN.md"],
  ["CHANGELOG.md", "CHANGELOG-RU.md"],
  ["CONTRIBUTING.md", "CONTRIBUTING-RU.md"],
  ["CODE_OF_CONDUCT.md", "CODE_OF_CONDUCT-RU.md"],
  ["docs/user-guide.md", "docs/user-guide-EN.md"],
  ["docs/architecture.md", "docs/architecture-EN.md"],
  ["docs/api.md", "docs/api-RU.md"],
  ["obsidian-projects-types/README.md", "obsidian-projects-types/README-RU.md"],
];

/**
 * Directories that are never documentation, wherever they occur. Dot-folders
 * are skipped by shape rather than by name: the vault's configuration folder
 * is whatever the user called it, and naming it here would be a guess.
 */
const SKIPPED_DIR_NAMES = new Set(["node_modules"]);
const isHiddenDir = (name: string) => name.startsWith(".");

const read = (relative: string) => readFileSync(resolve(ROOT, relative), "utf8");

/**
 * A page git would not track is not a documentation page a reader can reach —
 * this is what keeps a deleted `docs/internal/` or a workspace-local root file
 * out of the set without naming either one here.
 */
const isGitIgnored = (relative: string): boolean => {
  try {
    execFileSync("git", ["check-ignore", "-q", relative], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
};

/**
 * Vault content — a demo note, a Templater template — opens with a YAML
 * frontmatter block; a documentation page never does. That is what tells the
 * walk below apart the two without hard-coding a single filename.
 */
const hasFrontmatter = (text: string) => text.trimStart().startsWith("---");

const walk = (dir: string, relativeDir: string, out: string[]): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIR_NAMES.has(entry.name) || isHiddenDir(entry.name)) continue;
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(resolve(dir, entry.name), relativePath, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(relativePath);
    }
  }
};

/**
 * Every documentation page in the tree: root-level pages plus everything
 * under the directories documentation lives in, minus what git ignores and
 * what carries frontmatter (vault content, not documentation).
 */
const discoverDocumentationPages = (): string[] => {
  const found: string[] = [];

  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) found.push(entry.name);
  }
  for (const dir of DOC_DIRS) {
    walk(resolve(ROOT, dir), dir, found);
  }

  return found
    .filter((relative) => !isGitIgnored(relative))
    .filter((relative) => !hasFrontmatter(read(relative)))
    .sort();
};

/**
 * A twin names the language it holds in its own filename; the base carries
 * whatever language is left. Matching on that suffix — not on a table of
 * known basenames — is what lets a newly added pair be found without editing
 * this file.
 */
const TWIN_SUFFIX = /^(.*)-(EN|RU)\.md$/;

interface Pair {
  base: string;
  twin: string;
  twinLanguage: "EN" | "RU";
}

const pairDocumentationPages = (pages: readonly string[]): { pairs: Pair[]; unpaired: string[] } => {
  const candidates = pages.filter((page) => !BILINGUAL.includes(page));
  const claimed = new Set<string>();
  const pairs: Pair[] = [];

  for (const page of candidates) {
    const match = page.match(TWIN_SUFFIX);
    if (!match) continue;
    const [, stem, twinLanguage] = match;
    const base = `${stem}.md`;
    if (candidates.includes(base)) {
      pairs.push({ base, twin: page, twinLanguage: twinLanguage as "EN" | "RU" });
      claimed.add(base);
      claimed.add(page);
    }
  }

  return { pairs, unpaired: candidates.filter((page) => !claimed.has(page)) };
};

const hasCyrillic = (text: string) => /[А-Яа-яЁё]/.test(text);
const hasLatinWords = (text: string) => /\b[A-Za-z]{4,}\b/.test(text);

/**
 * Share of Cyrillic among the letters of a page. Presence alone says nothing:
 * an English page carries the word «Русский» in its language switcher, and a
 * Russian page carries every code identifier verbatim. The share separates
 * prose written in one language from prose written in the other.
 */
const cyrillicShare = (text: string): number => {
  const cyrillic = text.match(/[А-Яа-яЁё]/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;

  return cyrillic + latin === 0 ? 0 : cyrillic / (cyrillic + latin);
};

/**
 * Measured shares today run 0.45–0.93 on the Russian side and 0.001–0.004 on the
 * English one. The lower end is the API reference, most of whose body is a
 * TypeScript sample; the bounds leave that room without leaving room for a page
 * that is simply the other language copied over.
 */
const RUSSIAN_PROSE = 0.3;
const ENGLISH_PROSE = 0.05;

const pages = discoverDocumentationPages();
const { pairs, unpaired } = pairDocumentationPages(pages);

describe("R0.25 — documentation pairs", () => {
  it("accounts for every discovered documentation page", () => {
    // A page that is neither one of the four bilingual pages nor half of a
    // named pair is exactly the regression this suite exists to catch: added
    // in one language, and nothing else on disk names its twin.
    expect(unpaired).toEqual([]);
  });

  it("names the four bilingual pages and no more", () => {
    // The floor cases below are what make an empty walk loud; this one pins
    // the only hand-written list of pages left, so a fifth page cannot be
    // quietly excused from pairing by being added to it.
    expect(BILINGUAL).toHaveLength(4);
  });

  it("discovers each page and each pair once", () => {
    // The count assertion this replaced caught one thing on its way past:
    // a page reached twice — two walked directories overlapping, a pair
    // pushed twice — would run every check below twice and pass. The floor
    // is containment, so it cannot notice a duplicate; this can.
    expect(new Set(pages).size).toBe(pages.length);
    const identities = pairs.map(({ base, twin }) => `${base}|${twin}`);
    expect(new Set(identities).size).toBe(identities.length);
  });

  it.each(FLOOR_PAIRS)("still pairs %s with %s", (base, twin) => {
    // A wrong set of eight pairs — or an empty, truncated walk — cannot
    // satisfy this: each floor pair must be found by name, so a walk that
    // finds nothing, or finds the wrong eight, fails here naming exactly the
    // pair that went missing rather than passing on a matching count.
    expect(pairs).toContainEqual(expect.objectContaining({ base, twin }));
  });

  it.each(pairs.map(({ base, twin, twinLanguage }): [string, string, "EN" | "RU"] => [base, twin, twinLanguage]))(
    "%s carries the opposite language of its twin %s (%s)",
    (base, twin, twinLanguage) => {
      const baseShare = cyrillicShare(read(base));
      const twinShare = cyrillicShare(read(twin));

      // The direction is the point: a `-RU` twin written in English, or a
      // `-EN` twin written in Russian, must fail here rather than pass by
      // being sorted next to the base and treated as "the other one".
      if (twinLanguage === "RU") {
        expect(twinShare).toBeGreaterThan(RUSSIAN_PROSE);
        expect(baseShare).toBeLessThan(ENGLISH_PROSE);
      } else {
        expect(twinShare).toBeLessThan(ENGLISH_PROSE);
        expect(baseShare).toBeGreaterThan(RUSSIAN_PROSE);
      }
    }
  );

  it.each(pairs.map(({ base, twin }): [string, string] => [base, twin]))(
    "%s and %s are both real pages, not stubs",
    (base, twin) => {
      expect(read(base).length).toBeGreaterThan(400);
      expect(read(twin).length).toBeGreaterThan(400);
    }
  );

  it.each(pairs.map(({ base, twin }): [string, string] => [base, twin]))(
    "%s links to %s so a reader can switch",
    (base, twin) => {
      const twinName = twin.split("/").pop();
      const baseName = base.split("/").pop();

      expect(read(base)).toContain(`(${twinName})`);
      expect(read(twin)).toContain(`(${baseName})`);
    }
  );

  it.each(BILINGUAL)("%s exists and carries both languages in one file", (page) => {
    expect(existsSync(resolve(ROOT, page))).toBe(true);

    const text = read(page);
    expect(hasCyrillic(text)).toBe(true);
    expect(hasLatinWords(text)).toBe(true);
  });
});
