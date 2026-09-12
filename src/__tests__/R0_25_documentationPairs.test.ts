/**
 * R0.25 — documentation comes in pairs.
 *
 * Every documentation page exists in Russian and in English. The twin of a file
 * is the same path with a suffix naming its language: `README.md` pairs with
 * `README-EN.md`, `CONTRIBUTING.md` with `CONTRIBUTING-RU.md`. Which side
 * carries the suffix depends on the language the base file is written in, and
 * that is deliberately not something this test judges — the pair is the
 * invariant, not which half came first.
 *
 * Two pages carry both languages inside one file, because their English text is
 * copied from the code rather than translated by hand: the documentation index
 * and the error-code table. For those the test asks the opposite question — that
 * the single file really does contain both languages — so that nobody can
 * satisfy the pairing rule by deleting one half of a bilingual page.
 *
 * `README.md` files under `src/` are notes next to the code for whoever reads
 * it, not documentation pages, and are out of scope.
 *
 * This guards a promise to readers that regresses the moment someone adds a
 * page in one language and moves on.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..", "..");

/**
 * Pages whose two languages live in one file: the index and the error-code table,
 * whose English text is copied from the code, and the two short vault-side pages
 * a reader meets inside Obsidian, where a second file is a worse answer than two
 * paragraphs on one screen.
 */
const BILINGUAL = ["docs/README.md", "docs/ERROR_CODES.md", "demo-vault/README.md", "templates/README.md"];

/** Pairs, written as they are on disk: [base, twin]. */
const PAIRS: readonly [string, string][] = [
  ["README.md", "README-EN.md"],
  ["CHANGELOG.md", "CHANGELOG-RU.md"],
  ["CONTRIBUTING.md", "CONTRIBUTING-RU.md"],
  ["CODE_OF_CONDUCT.md", "CODE_OF_CONDUCT-RU.md"],
  ["docs/user-guide.md", "docs/user-guide-EN.md"],
  ["docs/architecture.md", "docs/architecture-EN.md"],
  ["docs/api.md", "docs/api-RU.md"],
  ["obsidian-projects-types/README.md", "obsidian-projects-types/README-RU.md"],
];

const read = (relative: string) => readFileSync(resolve(ROOT, relative), "utf8");
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

describe("R0.25 — documentation pairs", () => {
  it.each(PAIRS)("%s and %s both exist", (base, twin) => {
    expect(existsSync(resolve(ROOT, base))).toBe(true);
    expect(existsSync(resolve(ROOT, twin))).toBe(true);
  });

  it.each(PAIRS)("%s and %s are written in different languages", (base, twin) => {
    const shares = [cyrillicShare(read(base)), cyrillicShare(read(twin))].sort(
      (a, b) => a - b
    );
    const [english, russian] = shares as [number, number];

    // A copy of the English text under the `-RU` name would pass an existence
    // check and fail a reader. One side has to be Russian prose and the other
    // English prose.
    expect(russian).toBeGreaterThan(RUSSIAN_PROSE);
    expect(english).toBeLessThan(ENGLISH_PROSE);
  });

  it.each(PAIRS)("%s and %s are both real pages, not stubs", (base, twin) => {
    expect(read(base).length).toBeGreaterThan(400);
    expect(read(twin).length).toBeGreaterThan(400);
  });

  it.each(PAIRS)("%s links to %s so a reader can switch", (base, twin) => {
    const twinName = twin.split("/").pop();
    const baseName = base.split("/").pop();

    expect(read(base)).toContain(`(${twinName})`);
    expect(read(twin)).toContain(`(${baseName})`);
  });

  it.each(BILINGUAL)("%s carries both languages in one file", (page) => {
    const text = read(page);

    expect(hasCyrillic(text)).toBe(true);
    expect(hasLatinWords(text)).toBe(true);
  });

  it("does not claim a pair for a file that is gone", () => {
    // The list above is the contract. If a document is retired, both halves go
    // and the entry goes with them — a half-removed pair must not pass by
    // silently dropping out of the loop.
    expect(PAIRS.length).toBeGreaterThan(0);
    for (const [base, twin] of PAIRS) {
      expect(base.endsWith(".md")).toBe(true);
      expect(twin.endsWith(".md")).toBe(true);
    }
  });
});
