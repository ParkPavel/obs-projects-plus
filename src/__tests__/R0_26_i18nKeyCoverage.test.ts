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
 *   - `resolvesInBundle` is a second pure function, also proven on synthetic
 *     input. It answers what i18next would answer for THIS call: an exact
 *     leaf always resolves; plural forms count only when the call passes a
 *     `count`, and then every form that count can select must exist (the one
 *     `Intl.PluralRules` picks for a literal; all integer categories of the
 *     locale — ru one/few/many, en one/other — for an expression). One
 *     Russian `_one` beside a `{ count }` call used to pass here while 2 and 5
 *     still showed English; review round 1 found it.
 *   - Registry objects that pair a path with its English text are read as
 *     well as calls: `messageKey`/`messageDefault`, `labelKey`/`defaultLabel`,
 *     `causeKey`/`cause`, and `key`/`caption` (the error-code registry; `key`
 *     alone is too generic, so it counts only beside `caption`). The gallery
 *     size presets and all 32 error causes leaked English through exactly
 *     these shapes while a call-only scan stayed green.
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
  /** True when the call site (or the registry object holding the key) supplies English text for a missing key. */
  readonly hasDefault: boolean;
  /**
   * What the call passes as `count`: nothing, a literal number, or any other
   * expression. It decides which plural forms i18next can select, and so what
   * "resolves" means for this call.
   */
  readonly count: number | "dynamic" | undefined;
}

/** A key looks like `namespace.leaf` — every real i18n key in this tree is dotted; a bare word is some other function also named `t` (e.g. the Calendar agenda components' local per-namespace wrapper). */
const DOTTED_KEY = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/;

/**
 * `t(` or `xxx.t(` (covers `$i18n.t(`, `deps.t(`, `get(i18n).t(`, the bare
 * `t(` a few controllers destructure) whose first argument is a plain
 * quoted string — single or double quotes only, so a backtick template is
 * never matched. Capture group 3 tells a bare `t("key")` (next char `)`)
 * from `t("key", …)` (next char `,`).
 */
const T_CALL = /\bt\(\s*(["'])([^"']+)\1\s*([,)])/g;

/**
 * Registry objects that pair a translation path with the English text shown
 * when it is missing. `key` appears in unrelated objects too, so it counts
 * only beside its `caption` — the error-code registry's shape.
 */
const KEY_PAIRS: ReadonlyArray<{ keyProp: string; defaultProp: string; requireDefault: boolean }> = [
  { keyProp: "messageKey", defaultProp: "messageDefault", requireDefault: false },
  { keyProp: "labelKey", defaultProp: "defaultLabel", requireDefault: false },
  { keyProp: "causeKey", defaultProp: "cause", requireDefault: false },
  { keyProp: "key", defaultProp: "caption", requireDefault: true },
];

const LEADING_COMMENTS = /^(?:\s*(?:\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/))*/;

/** Characters after which a `/` can only begin an expression, so it opens a regex literal rather than dividing. */
const REGEX_PRECEDERS = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);

function startsRegex(text: string, slashIdx: number): boolean {
  const next = text[slashIdx + 1];
  if (next === "/" || next === "*") return false;
  let j = slashIdx - 1;
  while (j >= 0 && /\s/.test(text[j] as string)) j--;
  return j < 0 || REGEX_PRECEDERS.has(text[j] as string);
}

/** Index of the last character of the regex literal opening at `slashIdx` (its closing `/` or final flag). */
function regexEnd(text: string, slashIdx: number): number {
  let inClass = false;
  for (let i = slashIdx + 1; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") { i++; continue; }
    if (c === "\n") return i - 1;
    if (inClass) { if (c === "]") inClass = false; continue; }
    if (c === "[") { inClass = true; continue; }
    if (c === "/") {
      while (/[a-z]/i.test(text[i + 1] ?? "")) i++;
      return i;
    }
  }
  return text.length;
}

/**
 * The top-level comma-separated segments of the bracketed run starting at
 * `openIdx` (which must point at one of `( { [`). Strings, template literals,
 * comments and regex literals are opaque: real `defaultValue` texts contain
 * parentheses ("Pattern (regex)"), a regex such as `/["}]/` would otherwise
 * open a string or close the object, and neither a comment nor a nested call
 * that mentions `defaultValue` may count for the outer call.
 *
 * A `/` starts a regex literal when the previous significant character can
 * only be followed by an expression (an operator, an opening bracket, a comma
 * or nothing); after an identifier, a number or a closing bracket it is
 * division. That is the heuristic tokenizers use without a full parse.
 */
function topLevelSegments(text: string, openIdx: number): string[] {
  const segments: string[] = [];
  let depth = 0;
  let inString: string | null = null;
  let start = openIdx + 1;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close === -1 ? text.length : close + 1;
      continue;
    }
    if (c === "/" && startsRegex(text, i)) {
      i = regexEnd(text, i);
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") {
      depth--;
      if (depth === 0) { segments.push(text.slice(start, i)); break; }
    } else if (c === "," && depth === 1) {
      segments.push(text.slice(start, i));
      start = i + 1;
    }
  }
  return segments.map((s) => s.replace(LEADING_COMMENTS, "").trim()).filter((s) => s.length > 0);
}

/** The top-level properties of the object literal starting at `openIdx`: `name: value`, a quoted name, or shorthand `name`. */
function objectProps(text: string, openIdx: number): Map<string, string> {
  const props = new Map<string, string>();
  for (const segment of topLevelSegments(text, openIdx)) {
    const m = /^(["']?)([A-Za-z_$][\w$]*)\1\s*(?::\s*([\s\S]*))?$/.exec(segment);
    if (m) props.set(m[2] as string, (m[3] ?? (m[2] as string)).trim());
  }
  return props;
}

function countOf(props: Map<string, string>): number | "dynamic" | undefined {
  const value = props.get("count");
  if (value === undefined) return undefined;
  return /^\d+$/.test(value) ? Number(value) : "dynamic";
}

/**
 * Static keys reachable by reading the text alone.
 *
 * For a `t(` call the SECOND argument decides: a string literal is a
 * positional default (`t(key, "Text")`, the table helpers' signature); an
 * object literal has a default only if `defaultValue` is one of its own
 * top-level properties, and its `count` property is read the same way.
 * Anything else (an options variable) is classified as no default and no
 * count — the conservative reading, which requires the key in en.json.
 *
 * For registry objects (`KEY_PAIRS`) the default is the paired property in
 * the same object literal. `relationSetup.ts`'s `messageKey` sites pair with
 * `message:` rather than `messageDefault:`, so they classify as "no default"
 * and are required in en.json — that gap was real and was closed alongside
 * this test rather than special-cased around.
 */
export function extractStaticKeys(text: string): FoundKey[] {
  const found: FoundKey[] = [];

  for (const m of text.matchAll(T_CALL)) {
    const key = m[2] as string;
    if (!DOTTED_KEY.test(key)) continue;
    const second = m[3] === ")" ? undefined : topLevelSegments(text, m.index! + m[0].indexOf("("))[1];
    if (second !== undefined && /^["'`]/.test(second)) {
      found.push({ key, hasDefault: true, count: undefined });
    } else if (second !== undefined && second.startsWith("{")) {
      const props = objectProps(second, 0);
      found.push({ key, hasDefault: props.has("defaultValue"), count: countOf(props) });
    } else {
      found.push({ key, hasDefault: false, count: undefined });
    }
  }

  for (const { keyProp, defaultProp, requireDefault } of KEY_PAIRS) {
    for (const m of text.matchAll(new RegExp(`\\b${keyProp}\\s*:\\s*(["'])([^"']+)\\1`, "g"))) {
      const key = m[2] as string;
      if (!DOTTED_KEY.test(key)) continue;
      const openIdx = text.lastIndexOf("{", m.index!);
      const hasDefault = openIdx !== -1 && objectProps(text, openIdx).has(defaultProp);
      if (requireDefault && !hasDefault) continue;
      found.push({ key, hasDefault, count: undefined });
    }
  }

  return found;
}

// ── Pure function 2: plural-aware bundle resolution ──────────────

type Locale = "en" | "ru";

/** The CLDR categories an integer count can select — what a `{ count }` call needs when the number is not known statically. */
const INTEGER_PLURAL_CATEGORIES: Record<Locale, readonly string[]> = {
  en: ["one", "other"],
  ru: ["one", "few", "many"],
};

function getAtPath(bundle: unknown, parts: readonly string[]): unknown {
  let cur = bundle;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Whether i18next can resolve `dottedKey` for this call in `locale`.
 *
 * An exact string leaf always resolves (i18next falls back to the bare key
 * when a plural form is missing). Without one, plural forms count only when
 * the call passes a count, and then every form that count can select must
 * exist: the one `Intl.PluralRules` picks for a literal, or all integer
 * categories of the locale for an expression.
 */
export function resolvesInBundle(
  bundle: unknown,
  dottedKey: string,
  locale: Locale,
  count: number | "dynamic" | undefined
): boolean {
  const parts = dottedKey.split(".");
  if (typeof getAtPath(bundle, parts) === "string") return true;
  if (count === undefined) return false;
  const head = parts.slice(0, -1);
  const base = parts[parts.length - 1] as string;
  const needed = typeof count === "number" ? [new Intl.PluralRules(locale).select(count)] : INTEGER_PLURAL_CATEGORIES[locale];
  return needed.every((category) => typeof getAtPath(bundle, [...head, `${base}_${category}`]) === "string");
}

// ── Proofs on synthetic input ─────────────────────────────────────

describe("extractStaticKeys — synthetic proof", () => {
  it("finds a bare and a prefixed static call, with and without options", () => {
    expect(extractStaticKeys('t("a.b")')).toEqual([{ key: "a.b", hasDefault: false }]);
    expect(extractStaticKeys("$i18n.t('views.board.records', { count })")).toEqual([
      { key: "views.board.records", hasDefault: false, count: "dynamic" },
    ]);
  });

  it("marks a call as having a default only when defaultValue is in ITS OWN argument list", () => {
    expect(extractStaticKeys('t("a.b", { defaultValue: "B" })')).toEqual([
      { key: "a.b", hasDefault: true },
    ]);
    // Multi-line options and a defaultValue text containing its own parens —
    // the exact shape of `views.dashboard.pipeline.pattern`'s real call —
    // must not desynchronize the scan.
    const multiline = `t("a.b", {\n  defaultValue: "Pattern (regex)",\n  count,\n})`;
    expect(extractStaticKeys(multiline)).toEqual([{ key: "a.b", hasDefault: true, count: "dynamic" }]);
  });

  it("does not credit the outer call with a defaultValue from a nested call or a comment", () => {
    expect(extractStaticKeys('t("a.b", { label: t("c.d", { defaultValue: "D" }) })')).toEqual([
      { key: "a.b", hasDefault: false },
      { key: "c.d", hasDefault: true },
    ]);
    expect(extractStaticKeys('t("a.b", { /* defaultValue: "x" */ count: n })')).toEqual([
      { key: "a.b", hasDefault: false, count: "dynamic" },
    ]);
  });

  it("keeps a regex literal with quotes or brackets opaque, and still reads division as division", () => {
    expect(extractStaticKeys('t("a.b", { matcher: /["}]/g, defaultValue: "B", count: n })')).toEqual([
      { key: "a.b", hasDefault: true, count: "dynamic" },
    ]);
    expect(extractStaticKeys('t("a.b", { width: total / 2, defaultValue: "B" })')).toEqual([
      { key: "a.b", hasDefault: true },
    ]);
    // After a closing bracket a slash divides too — review round 3 found `}`
    // wrongly listed as a regex predecessor, which swallowed the rest.
    expect(extractStaticKeys('t("a.b", { width: {} / 2, defaultValue: "B" })')).toEqual([
      { key: "a.b", hasDefault: true },
    ]);
    expect(extractStaticKeys('t("a.b", { width: (n) / 2, ratio: xs[0] / 2, defaultValue: "B" })')).toEqual([
      { key: "a.b", hasDefault: true },
    ]);
    expect(extractStaticKeys('{ key: "a.b", width: {} / 2, caption: "B" }')).toEqual([
      { key: "a.b", hasDefault: true },
    ]);
  });

  it("treats a positional string as a default and reads a literal count", () => {
    expect(extractStaticKeys('t("a.b", "Default")')).toEqual([{ key: "a.b", hasDefault: true }]);
    expect(extractStaticKeys('t("a.b", { count: 1 })')).toEqual([{ key: "a.b", hasDefault: false, count: 1 }]);
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

  it("reads the other registry pairs, and a generic key only beside its caption", () => {
    expect(extractStaticKeys('{ labelKey: "views.gallery.settings.card-size.small", defaultLabel: "S", width: 180 }')).toEqual([
      { key: "views.gallery.settings.card-size.small", hasDefault: true },
    ]);
    const entry = '{ code: "PPP-101", key: "errors.settingsWriteFailed", caption: "Not saved", causeKey: "errors.causes.settings-write-failed", cause: "Why" }';
    expect(extractStaticKeys(entry).map((f) => f.key).sort()).toEqual([
      "errors.causes.settings-write-failed",
      "errors.settingsWriteFailed",
    ]);
    expect(extractStaticKeys('{ key: "sort.by-name", direction: "asc" }')).toEqual([]);
  });

  it("finds several calls across lines, in source order", () => {
    const src = 'a(t("x.one"));\nb($i18n.t("x.two", { defaultValue: "Two" }));\n';
    expect(extractStaticKeys(src).map((f) => f.key)).toEqual(["x.one", "x.two"]);
  });
});

describe("resolvesInBundle — synthetic proof", () => {
  it("resolves an exact string leaf, with or without a count", () => {
    expect(resolvesInBundle({ a: { b: "x" } }, "a.b", "ru", undefined)).toBe(true);
    expect(resolvesInBundle({ a: { b: "x" } }, "a.b", "ru", "dynamic")).toBe(true);
  });

  it("does not resolve a missing leaf", () => {
    expect(resolvesInBundle({ a: {} }, "a.b", "en", undefined)).toBe(false);
    expect(resolvesInBundle({}, "a.b", "en", undefined)).toBe(false);
  });

  it("ignores plural forms when the call passes no count", () => {
    expect(resolvesInBundle({ a: { b_one: "x", b_few: "y", b_many: "z" } }, "a.b", "ru", undefined)).toBe(false);
  });

  it("requires every form an unknown count can select in that locale", () => {
    const en = { views: { board: { records_one: "record", records_other: "records" } } };
    expect(resolvesInBundle(en, "views.board.records", "en", "dynamic")).toBe(true);
    expect(resolvesInBundle({ a: { b_one: "x" } }, "a.b", "ru", "dynamic")).toBe(false);
    expect(resolvesInBundle({ a: { b_one: "x", b_few: "y", b_many: "z" } }, "a.b", "ru", "dynamic")).toBe(true);
  });

  it("requires exactly the form a literal count selects", () => {
    expect(resolvesInBundle({ a: { b_one: "x" } }, "a.b", "ru", 1)).toBe(true);
    expect(resolvesInBundle({ a: { b_one: "x" } }, "a.b", "ru", 2)).toBe(false);
    expect(resolvesInBundle({ a: { b_few: "y" } }, "a.b", "ru", 2)).toBe(true);
  });

  it("does not treat an object (not a string) as resolved", () => {
    expect(resolvesInBundle({ a: { b: {} } }, "a.b", "en", undefined)).toBe(false);
  });
});

// ── The real tree ──────────────────────────────────────────────

const SOURCE_FILES = collectSourceFiles(SRC_ROOT, [".ts", ".svelte"]).filter(
  (file) => !/\.(test|spec)\.(ts|svelte)$/.test(file)
);

const ALL_FOUND: (FoundKey & { file: string })[] = SOURCE_FILES.flatMap((file) =>
  extractStaticKeys(fs.readFileSync(file, "utf8")).map((found) => ({
    ...found,
    file: path.relative(SRC_ROOT, file).split(path.sep).join("/"),
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

  it("every statically-called key resolves in ru.json for the count it passes", () => {
    const missing = [...new Set(
      ALL_FOUND.filter(({ key, count }) => !resolvesInBundle(RU, key, "ru", count)).map(({ file, key }) => `${key} (${file})`)
    )].sort();
    expect(missing).toEqual([]);
  });

  it("every statically-called key with no defaultValue resolves in en.json", () => {
    const missing = [...new Set(
      ALL_FOUND.filter(({ key, hasDefault, count }) => !hasDefault && !resolvesInBundle(EN, key, "en", count)).map(({ file, key }) => `${key} (${file})`)
    )].sort();
    expect(missing).toEqual([]);
  });
});
