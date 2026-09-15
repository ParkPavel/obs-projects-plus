/**
 * R0.26 — i18n key coverage (scene 5 live acceptance).
 *
 * What escaped: `t("views.board.freeze-all")` and seven siblings were called
 * against keys that exist in NO locale bundle — every user, English or
 * Russian, saw the literal key string ("views.board.freeze-all") rendered as
 * UI text, because i18next returns the key itself when nothing resolves it
 * and no `defaultValue` was given. Separately, 89 more keys had a real
 * `defaultValue` in the calling code — so English readers never noticed —
 * but no `ru.json` entry, so Russian readers silently fell back to English
 * text mid-sentence. Both defects were invisible to `npm run build` (no type
 * touches a string literal passed to `t`) and to `npm test` (nothing asserted
 * over the *set* of keys the source actually calls). A code reviewer has to
 * cross-reference every `t(...)` call against two JSON files by eye, which is
 * exactly the kind of check that survives a few reviews and then stops.
 *
 * Shape, deliberately borrowed from R0.13/R0.4:
 *   - `extractStaticKeys` is a pure `(sourceText) → FoundKey[]` function,
 *     proven on synthetic input in both directions before it is ever pointed
 *     at the real tree — the same reason R0.13's `importsTokenSource` is
 *     proven on a present/absent pair rather than trusted from first use.
 *   - `resolvesInBundle` is a second pure function, plural-aware, also proven
 *     on synthetic input: a key with no exact entry but an `_one`/`_few`/…
 *     sibling counts as covered, because that is the real shape i18next
 *     resolves at runtime for a `{ count }` call — treating it as missing
 *     would make this ratchet fight the fix (see `views.board.records_one`
 *     etc.) instead of guarding it.
 *   - The tree-wide assertions run last, and a "found N keys" floor keeps an
 *     accidentally-vacuous regex from reporting a silent, all-green pass.
 *
 * What this cannot see, by design, matching the boundary R0.13 states for its
 * own scan: a key assembled from a variable (`t(x.messageKey, …)`), string
 * concatenation (`t("views.dashboard.agg." + value, …)`) or a template
 * literal (a backtick-quoted key with an interpolation, as in the Calendar agenda components' local `t`
 * wrapper) is invisible here on purpose — resolving it would require
 * evaluating the program, not reading its text, and a scan that tried would
 * be the kind of clever that quietly stops working. Those call sites are not
 * unguarded: they either carry their own `defaultValue`/`messageDefault` in
 * the source (readable by eye at the call site) or are out of this ticket's
 * scope entirely.
 */

import * as fs from "fs";
import * as path from "path";
import { collectSourceFiles, SRC_ROOT } from "./support/cssScan";

// ── en.json / ru.json, loaded once ──────────────────────────────

type Bundle = Record<string, unknown>;

function loadBundle(locale: "en" | "ru"): Bundle {
  const file = path.join(SRC_ROOT, "lib", "stores", "translations", `${locale}.json`);
  // ru.json carries a UTF-8 BOM; Node's `fs.readFileSync(..., "utf8")` does not
  // strip it (unlike the bundler's JSON loader), and a leading U+FEFF makes
  // `JSON.parse` throw before this file ever gets to read a real key.
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(text) as { translation: Bundle };
  return parsed.translation;
}

// ── Pure function 1: static key extraction ──────────────────────

export interface FoundKey {
  readonly key: string;
  /** True when the call site (or its enclosing object literal) already supplies English text for a missing key. */
  readonly hasDefault: boolean;
}

/** A key looks like `namespace.leaf` — every real i18n key in this tree is dotted; a bare word is some other function also named `t` (e.g. the Calendar agenda components' local per-namespace wrapper). */
const DOTTED_KEY = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/;

/**
 * `t(` or `xxx.t(` (covers `$i18n.t(`, `deps.t(`, `get(i18n).t(`, the bare
 * `t(` a few controllers destructure) whose first argument is a plain
 * quoted string — single or double quotes only, so a backtick template is
 * never matched. Capture group 3 tells a bare `t("key")` (next char `)`)
 * from `t("key", …)` (next char `,`); the former can never carry a
 * `defaultValue` and short-circuits the balanced-args scan below.
 */
const T_CALL = /\bt\(\s*(["'])([^"']+)\1\s*([,)])/g;

/** `messageKey: "a.b"` — the one non-call shape this ticket asks for. */
const MESSAGE_KEY = /\bmessageKey\s*:\s*(["'])([^"']+)\1/g;

/**
 * The text of a balanced `(...)`/`{...}`/`[...]` run starting at `openIdx`
 * (which must point at one of `( { [`), stopping at the matching close.
 * String contents are skipped opaquely — several real `defaultValue` texts
 * in this tree contain their own parentheses ("Pattern (regex)"), which
 * would desynchronize a scanner that did not treat quotes as opaque.
 */
function balancedSpan(text: string, openIdx: number): string {
  let depth = 0;
  let inString: string | null = null;
  let i = openIdx;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return text.slice(openIdx, i);
}

/** The enclosing `{ … }` object literal that CONTAINS position `at` — used to find `messageDefault` beside a `messageKey` without a full parser. */
function enclosingObjectSpan(text: string, at: number): string {
  const openIdx = text.lastIndexOf("{", at);
  if (openIdx === -1) return "";
  return balancedSpan(text, openIdx);
}

/**
 * Static keys reachable by reading the text alone: `t("a.b")` / `t('a.b')`
 * (through any `*.t(` prefix, so `$i18n.t(` included) and `messageKey: "a.b"`.
 *
 * `hasDefault` for a `t(` call is true when its own argument list contains a
 * `defaultValue:` property (found via the balanced-span scan, not a fixed
 * window, so a multi-line options object is read in full). For `messageKey`
 * it is true when the SAME object literal also declares `messageDefault:` —
 * the one convention this ticket names. `relationSetup.ts`'s `messageKey`
 * sites pair with a `message:` field instead of `messageDefault:`, so they
 * classify as "no default" here and are required in en.json accordingly;
 * that gap turned out to be real and was closed in the same commit as this
 * test, rather than the classifier being special-cased around it.
 */
export function extractStaticKeys(text: string): FoundKey[] {
  const found: FoundKey[] = [];

  for (const m of text.matchAll(T_CALL)) {
    const key = m[2] as string;
    if (!DOTTED_KEY.test(key)) continue;
    if (m[3] === ")") {
      found.push({ key, hasDefault: false });
      continue;
    }
    const openParenIdx = m.index! + m[0].indexOf("(");
    const argsText = balancedSpan(text, openParenIdx);
    found.push({ key, hasDefault: /\bdefaultValue\s*:/.test(argsText) });
  }

  for (const m of text.matchAll(MESSAGE_KEY)) {
    const key = m[2] as string;
    if (!DOTTED_KEY.test(key)) continue;
    const obj = enclosingObjectSpan(text, m.index!);
    found.push({ key, hasDefault: /\bmessageDefault\s*:/.test(obj) });
  }

  return found;
}

// ── Pure function 2: plural-aware bundle resolution ──────────────

const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];

function getAtPath(bundle: unknown, parts: readonly string[]): unknown {
  let cur = bundle;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** A key resolves if its exact path is a string, or the last segment plus one of the plural suffixes is. */
export function resolvesInBundle(bundle: unknown, dottedKey: string): boolean {
  const parts = dottedKey.split(".");
  if (typeof getAtPath(bundle, parts) === "string") return true;
  const lastIdx = parts.length - 1;
  const base = parts[lastIdx] as string;
  return PLURAL_SUFFIXES.some(
    (suffix) => typeof getAtPath(bundle, [...parts.slice(0, lastIdx), `${base}${suffix}`]) === "string"
  );
}

// ── Proofs on synthetic input ─────────────────────────────────────

describe("extractStaticKeys — synthetic proof", () => {
  it("finds a bare and a prefixed static call, with and without options", () => {
    expect(extractStaticKeys('t("a.b")')).toEqual([{ key: "a.b", hasDefault: false }]);
    expect(extractStaticKeys("$i18n.t('views.board.records', { count })")).toEqual([
      { key: "views.board.records", hasDefault: false },
    ]);
  });

  it("marks a call as having a default only when defaultValue is in ITS OWN argument list", () => {
    expect(extractStaticKeys('t("a.b", { defaultValue: "B" })')).toEqual([
      { key: "a.b", hasDefault: true },
    ]);
    // Multi-line options and a defaultValue text containing its own parens —
    // the exact shape of `views.dashboard.pipeline.pattern`'s real call —
    // must not desynchronize the balanced-span scan.
    const multiline = `t("a.b", {\n  defaultValue: "Pattern (regex)",\n  count,\n})`;
    expect(extractStaticKeys(multiline)).toEqual([{ key: "a.b", hasDefault: true }]);
  });

  it("does NOT report a concatenated key", () => {
    expect(extractStaticKeys('t("views.dashboard.agg." + value, { defaultValue: label })')).toEqual([]);
  });

  it("does NOT report a template-literal key", () => {
    expect(extractStaticKeys("t(`views.calendar.agenda.${key}`)")).toEqual([]);
    expect(extractStaticKeys("$i18n.t(`prefix.${dynamic}`)")).toEqual([]);
  });

  it("ignores a bare, non-dotted key from an unrelated local `t` wrapper", () => {
    // Calendar agenda components define `const t = (key) => $i18n.t(`ns.${key}`)`
    // and then call `t('field-placeholder')` — real coverage, reached only
    // through a template literal this scan correctly does not follow.
    expect(extractStaticKeys("t('field-placeholder')")).toEqual([]);
  });

  it("extracts messageKey, defaulted through messageDefault in the same object", () => {
    const src = '{ icon: "x", messageKey: "views.dashboard.widget.chart-not-configured", messageDefault: "Chart is not configured" }';
    expect(extractStaticKeys(src)).toEqual([
      { key: "views.dashboard.widget.chart-not-configured", hasDefault: true },
    ]);
  });

  it("extracts messageKey as defaultless when the object has no messageDefault", () => {
    const src = '{ valid: false, messageKey: "relation-setup.error-name-required", message: "A relation property name is required." }';
    expect(extractStaticKeys(src)).toEqual([
      { key: "relation-setup.error-name-required", hasDefault: false },
    ]);
  });

  it("finds several calls across lines, in source order", () => {
    const src = 'a(t("x.one"));\nb($i18n.t("x.two", { defaultValue: "Two" }));\n';
    expect(extractStaticKeys(src).map((f) => f.key)).toEqual(["x.one", "x.two"]);
  });
});

describe("resolvesInBundle — synthetic proof", () => {
  it("resolves an exact string leaf", () => {
    expect(resolvesInBundle({ a: { b: "x" } }, "a.b")).toBe(true);
  });

  it("does not resolve a missing leaf", () => {
    expect(resolvesInBundle({ a: {} }, "a.b")).toBe(false);
    expect(resolvesInBundle({}, "a.b")).toBe(false);
  });

  it("resolves through a plural sibling when the exact leaf is absent", () => {
    expect(resolvesInBundle({ views: { board: { records_one: "record", records_other: "records" } } }, "views.board.records")).toBe(true);
    expect(resolvesInBundle({ a: { b_few: "x" } }, "a.b")).toBe(true);
  });

  it("does not treat an object (not a string) as resolved", () => {
    expect(resolvesInBundle({ a: { b: {} } }, "a.b")).toBe(false);
  });
});

// ── The real tree ──────────────────────────────────────────────

const SOURCE_FILES = collectSourceFiles(SRC_ROOT, [".ts", ".svelte"]).filter(
  (file) => !/\.(test|spec)\.(ts|svelte)$/.test(file)
);

const ALL_FOUND: { file: string; key: string; hasDefault: boolean }[] = SOURCE_FILES.flatMap((file) =>
  extractStaticKeys(fs.readFileSync(file, "utf8")).map(({ key, hasDefault }) => ({
    file: path.relative(SRC_ROOT, file).split(path.sep).join("/"),
    key,
    hasDefault,
  }))
);

const EN = loadBundle("en");
const RU = loadBundle("ru");

describe("R0.26 i18n key coverage — the real tree", () => {
  it("scanned a non-trivial number of call sites (a vacuous scan must not pass)", () => {
    // A rough manual grep for the same shape at the time this ratchet was
    // written found call sites in over 120 files; these floors sit well
    // under that so they fail loudly only if the regex itself stops
    // matching (a syntax change, a renamed helper), not on ordinary drift.
    expect(SOURCE_FILES.length).toBeGreaterThan(100);
    expect(ALL_FOUND.length).toBeGreaterThan(300);
  });

  it("every statically-called key resolves in ru.json", () => {
    const missing = [...new Set(
      ALL_FOUND.filter(({ key }) => !resolvesInBundle(RU, key)).map(({ file, key }) => `${key} (${file})`)
    )].sort();
    expect(missing).toEqual([]);
  });

  it("every statically-called key with no defaultValue resolves in en.json", () => {
    const missing = [...new Set(
      ALL_FOUND.filter(({ key, hasDefault }) => !hasDefault && !resolvesInBundle(EN, key)).map(({ file, key }) => `${key} (${file})`)
    )].sort();
    expect(missing).toEqual([]);
  });
});
