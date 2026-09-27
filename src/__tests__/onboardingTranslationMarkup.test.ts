/**
 * P1 — onboarding translation bundles must carry only the inline markup
 * `InlineTranslatedText.svelte` understands (`**bold**` and
 * `[label](properties)`), never raw HTML. `{@html}` and
 * `src/lib/helpers/sanitizeHtml.ts` — the mechanism v3.0.7 introduced to
 * make `<strong>`/`<a>` markup in these same strings "safe enough" to
 * hand to `{@html}` — must be entirely gone from the source tree.
 *
 * This fails on the pinned base: the eight leaves below currently ship
 * `<strong>`/`<a>` HTML, `Onboarding.svelte` uses `{@html}`, and
 * `sanitizeHtml.ts` exists.
 */

import fs from "fs";
import path from "path";

import en from "src/lib/stores/translations/en.json";
import ru from "src/lib/stores/translations/ru.json";
import uk from "src/lib/stores/translations/uk.json";
import zhCN from "src/lib/stores/translations/zh-CN.json";

// i18next resources: every key lives under the "translation" namespace.
type Bundle = { onboarding: Record<string, unknown> };
const ns = (json: unknown): Bundle => (json as { translation: Bundle }).translation;

const LOCALES: Array<{ name: string; bundle: Bundle }> = [
  { name: "en", bundle: ns(en) },
  { name: "ru", bundle: ns(ru) },
  { name: "uk", bundle: ns(uk) },
  { name: "zh-CN", bundle: ns(zhCN) },
];

// The eight leaves that used to carry `<strong>`/`<a>` markup for
// {@html} + sanitizeHtml; `front-matter-link` is dropped entirely
// because InlineTranslatedText owns the Properties link's label and URL.
const PLAIN_LEAVES = [
  "file-explorer-step1",
  "file-explorer-step2",
  "command-palette-step1",
  "command-palette-step2",
  "command-palette-step3",
  "projects-view-step1",
  "projects-view-step2",
] as const;

const LINK_LEAF = "description";

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/;

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("onboarding translation bundles carry only InlineTranslatedText markup (P1)", () => {
  for (const { name, bundle } of LOCALES) {
    describe(`locale: ${name}`, () => {
      it("front-matter-link key is removed — the Properties link owns its own label", () => {
        expect(bundle.onboarding["front-matter-link"]).toBeUndefined();
      });

      it("description contains no HTML and exactly one balanced [label](properties) link", () => {
        const value = bundle.onboarding[LINK_LEAF];
        expect(typeof value).toBe("string");
        const text = value as string;

        expect(HTML_TAG_RE.test(text)).toBe(false);
        expect(countOccurrences(text, "(properties)")).toBe(1);
        expect(countOccurrences(text, "[")).toBe(countOccurrences(text, "]"));
      });

      for (const leaf of PLAIN_LEAVES) {
        it(`${leaf} contains no HTML tags and balanced **bold** markers`, () => {
          const value = bundle.onboarding[leaf];
          expect(typeof value).toBe("string");
          const text = value as string;

          expect(HTML_TAG_RE.test(text)).toBe(false);

          const boldMarkerCount = countOccurrences(text, "**");
          expect(boldMarkerCount).toBeGreaterThan(0);
          expect(boldMarkerCount % 2).toBe(0);
        });
      }
    });
  }
});

describe("onboarding no longer uses {@html} or sanitizeHtml.ts (P1)", () => {
  const onboardingDir = path.resolve(__dirname, "../ui/app/onboarding");

  function collectFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(full);
      return entry.isFile() ? [full] : [];
    });
  }

  it("no {@html} directive remains anywhere under src", () => {
    const srcDir = path.resolve(__dirname, "..");
    const offenders: string[] = [];
    for (const file of collectFiles(srcDir)) {
      if (!file.endsWith(".svelte")) continue;
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("{@html")) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("sanitizeHtml.ts is gone", () => {
    const sanitizeHtmlPath = path.resolve(__dirname, "../lib/helpers/sanitizeHtml.ts");
    expect(fs.existsSync(sanitizeHtmlPath)).toBe(false);
  });

  it("Onboarding.svelte does not import sanitizeHtml", () => {
    const onboardingSveltePath = path.join(onboardingDir, "Onboarding.svelte");
    const content = fs.readFileSync(onboardingSveltePath, "utf8");
    expect(content).not.toContain("sanitizeHtml");
  });
});
