/**
 * R0.15 — numeric coercion happens in exactly one module (#180a, spec §6 I-2).
 *
 * `src/lib/engine/numeric.ts` is the project's only definition of "this value
 * is a number". Five implementations coexisted before #180a and disagreed with
 * each other on `"12abc"`, `""`, `"0x10"` and `NaN`; each was individually
 * green, which is exactly why no gate saw it. This ratchet guards against the
 * RECURRENCE PATTERN — someone writing a fresh `Number(v)` or `parseFloat(v)`
 * where the rule already has an answer.
 *
 * A site that legitimately does its own parse declares itself:
 *
 *     // coercion-exempt: Class B - lexing an HH:MM token …
 *     const hours = parseInt(parts[0], 10);
 *
 * The marker covers the line it precedes and the contiguous run of coercion
 * lines after it, so three hex channels in a row are one decision and not three
 * copies of one comment. A marker with an empty reason does not count: the
 * reason is the whole point, because "why is this one different" is the
 * question the next reader will have.
 *
 * ## Where this ratchet is BLIND — stated up front, not discovered later
 *
 * It is a text scan, and the spec says so (§6). It cannot see:
 *
 *   - a coercion built by string concatenation, or one that arrives already
 *     coerced from another module;
 *   - `value - 0` written any way the regex does not spell — `value - (0)`,
 *     `value -= 0`, a unary `+` split across a line break;
 *   - anything in `.svelte` MARKUP. Only the `<script>` block is scanned,
 *     because a `//` marker cannot be written inside a template expression;
 *     `ChartConfig.svelte`'s `on:input={… parseInt(…) …}` handlers are real
 *     and invisible here. They read a form control rather than record data,
 *     which is why that is a tolerable hole and not an urgent one.
 *   - whether a routed call is CORRECT. Routing `toNumber` somewhere it should
 *     not be is invisible to a scan.
 *
 * The proof that the rule itself holds is the contract test
 * (`lib/engine/__tests__/numericContract.test.ts`), not this file. This is a
 * tripwire; that is the specification.
 *
 * Built on the R0.4 / R0.13 / R0.14 shape: the scan is a pure `(text) → hits`
 * function, proven on synthetic input in BOTH states, so it is shown to fail
 * rather than assumed to.
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");

/** The roots this rule governs. */
const SCANNED_ROOTS = ["lib", "ui"] as const;

/**
 * The one module allowed to answer the question, relative to `src`.
 * `styles.css`-style build output does not exist here; this is the only
 * allowance, and it is a single file rather than a directory on purpose.
 */
const COERCION_HOME = "lib/engine/numeric.ts";

/** A marker line, and the reason must be non-empty. */
const MARKER = /\/\/\s*coercion-exempt:\s*\S/;

/**
 * The coercion spellings this scan can see. Each is a way the project has
 * actually written "turn this into a number".
 */
const PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "parseFloat(", re: /parseFloat\s*\(/ },
  { name: "parseInt(", re: /parseInt\s*\(/ },
  // `Number(` as a call, never `Number.isFinite` / `Number.isNaN` /
  // `Number.isInteger` / `Number.MAX_SAFE_INTEGER`, and never the tail of an
  // identifier like `toNumber(` or `argNumber(`.
  { name: "Number(", re: /(?<![.\w$])Number\s*\(/ },
  // Unary plus on an identifier, in the positions a coercion is written in.
  // Deliberately NOT anchored at start-of-line: a wrapped arithmetic
  // expression continues onto a line beginning with `+ pmt * …`, which is a
  // binary operator and not a coercion (two such lines exist in
  // `extendedEvaluator.ts`, and they are why this is spelled out).
  { name: "unary +", re: /(?:[=(,[:?]|=>|\breturn)\s*\+\s*[A-Za-z_$]/ },
  { name: "* 1", re: /\*\s*1\s*(?![\d.])/ },
  { name: "- 0", re: /-\s*0\s*(?![\d.])/ },
];

/**
 * The line with comments removed, so the scan reads code and not prose. The
 * marker is read from the ORIGINAL line before this runs — otherwise the
 * exemption would delete itself.
 *
 * `inBlock` carries `/* … *\/` state between lines. String literals are not
 * parsed: a `"Number("` inside a string would be a false positive, and there
 * is none in the tree today.
 */
export function stripComments(
  line: string,
  inBlock: boolean
): { code: string; inBlock: boolean } {
  let out = "";
  let i = 0;
  let block = inBlock;
  while (i < line.length) {
    if (block) {
      const end = line.indexOf("*/", i);
      if (end === -1) return { code: out, inBlock: true };
      i = end + 2;
      block = false;
      continue;
    }
    if (line.startsWith("//", i)) return { code: out, inBlock: false };
    if (line.startsWith("/*", i)) {
      block = true;
      i += 2;
      continue;
    }
    out += line[i];
    i++;
  }
  return { code: out, inBlock: block };
}

export interface CoercionHit {
  readonly line: number;
  readonly pattern: string;
  readonly text: string;
}

/**
 * Unmarked coercion sites in `text`.
 *
 * A `// coercion-exempt: <reason>` marker exempts the line it sits on and every
 * following line that is itself a coercion, stopping at the first line that is
 * not one. `scriptOnly` restricts the scan to `<script>…</script>`, which is
 * how `.svelte` files are read.
 */
export function findUnmarkedCoercions(
  text: string,
  scriptOnly = false
): CoercionHit[] {
  const lines = text.split(/\r?\n/);
  const hits: CoercionHit[] = [];
  let inBlock = false;
  let inScript = !scriptOnly;
  let exemptRun = false;

  lines.forEach((raw, idx) => {
    if (scriptOnly) {
      if (/<script[\s>]/.test(raw)) inScript = true;
      else if (/<\/script>/.test(raw)) inScript = false;
    }

    const marked = MARKER.test(raw);
    const { code, inBlock: next } = stripComments(raw, inBlock);
    inBlock = next;

    if (marked) {
      exemptRun = true;
      return;
    }
    if (!inScript) return;

    // A comment-only line is transparent: a marker whose reason runs to several
    // `//` lines still covers the code beneath it. A line with actual code that
    // is not a coercion ends the run, and so does a blank line.
    if (code.trim() === "" && raw.trim() !== "") return;

    const pattern = PATTERNS.find((p) => p.re.test(code));
    if (!pattern) {
      exemptRun = false;
      return;
    }
    if (exemptRun) return;
    hits.push({ line: idx + 1, pattern: pattern.name, text: raw.trim() });
  });

  return hits;
}

/** Every `.ts` / `.svelte` under `dir`, excluding test and mock trees. */
function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectFiles(full, out);
      continue;
    }
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts")) {
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".svelte")) {
      out.push(path.relative(SRC, full).replace(/\\/g, "/"));
    }
  }
  return out;
}

describe("R0.15 — the scan itself (synthetic, proves BOTH states)", () => {
  it("REPORTS an unmarked coercion", () => {
    const hits = findUnmarkedCoercions("const n = Number(v);");
    expect(hits.map((h) => h.pattern)).toEqual(["Number("]);
  });

  it("accepts a marker with a reason on the preceding line", () => {
    const text = [
      "// coercion-exempt: Class B - lexing a token",
      "const n = parseInt(tok, 10);",
    ].join("\n");
    expect(findUnmarkedCoercions(text)).toEqual([]);
  });

  it("REJECTS a marker with an empty reason", () => {
    const text = ["// coercion-exempt:", "const n = Number(v);"].join("\n");
    expect(findUnmarkedCoercions(text).map((h) => h.line)).toEqual([2]);
  });

  it("one marker covers a contiguous run and stops at the first non-coercion", () => {
    const text = [
      "// coercion-exempt: Class C - hex channels",
      "r = parseInt(hex.slice(0, 2), 16);",
      "g = parseInt(hex.slice(2, 4), 16);",
      "const other = 1;",
      "b = parseInt(hex.slice(4, 6), 16);",
    ].join("\n");
    expect(findUnmarkedCoercions(text).map((h) => h.line)).toEqual([5]);
  });

  it("does not mistake Number.isFinite or an identifier ending in Number", () => {
    const text = [
      "if (Number.isFinite(n) && !Number.isNaN(n)) return Number.MAX_SAFE_INTEGER;",
      "const a = toNumber(v), b = argNumber(v), c = toNumbers(vs);",
    ].join("\n");
    expect(findUnmarkedCoercions(text)).toEqual([]);
  });

  it("sees the spellings a reviewer would miss", () => {
    const text = [
      "const a = +raw;",
      "const b = raw * 1;",
      "const c = raw - 0;",
    ].join("\n");
    expect(findUnmarkedCoercions(text).map((h) => h.pattern)).toEqual([
      "unary +",
      "* 1",
      "- 0",
    ]);
  });

  it("does not flag ordinary arithmetic that merely contains + - *", () => {
    const text = [
      "const s = a + b;",
      "const t = a - b;",
      "const u = width * 1.5;",
      "const v = arr.slice(0, -1);",
      'case "+": return left + right;',
      // A wrapped expression continuing onto the next line — binary, not unary.
      "const dy = nper * pv * Math.pow(1 + rate, nper - 1)",
      "  + pmt * type * ((pvif - 1) / rate);",
    ].join("\n");
    expect(findUnmarkedCoercions(text)).toEqual([]);
  });

  it("a marker whose reason runs to several comment lines still covers the code", () => {
    const text = [
      "// coercion-exempt: Class B - the scanner above already consumed exactly",
      "// the digit run that makes up this token, so the whole-string question",
      "// has been answered by the scan itself.",
      "tokens.push({ type: 'NUMBER', value: parseFloat(value) });",
    ].join("\n");
    expect(findUnmarkedCoercions(text)).toEqual([]);
  });

  it("a blank line ends the run, so a marker cannot drift down a file", () => {
    const text = [
      "// coercion-exempt: Class C - hex channel",
      "r = parseInt(hex, 16);",
      "",
      "const n = Number(userValue);",
    ].join("\n");
    expect(findUnmarkedCoercions(text).map((h) => h.line)).toEqual([4]);
  });

  it("reads code and not prose — a comment naming Number( is not a call", () => {
    const text = [
      "// #180a: was Number(v) with a parseFloat( fallback.",
      "/* Number(v) and parseInt(v) are described here, not called. */",
      "const n = toNumber(v);",
    ].join("\n");
    expect(findUnmarkedCoercions(text)).toEqual([]);
  });

  it("scriptOnly ignores markup, which is the stated blind spot", () => {
    const text = [
      "<script lang=\"ts\">",
      "  const n = Number(v);",
      "</script>",
      "<input on:input={(e) => emit(parseInt(e.currentTarget.value))} />",
    ].join("\n");
    expect(findUnmarkedCoercions(text, true).map((h) => h.line)).toEqual([2]);
  });
});

describe("R0.15 — the tree", () => {
  const files = SCANNED_ROOTS.flatMap((root) =>
    collectFiles(path.join(SRC, root))
  );

  it("scans a non-trivial number of files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("coerces numbers in exactly one module", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file === COERCION_HOME) continue;
      const text = fs.readFileSync(path.join(SRC, file), "utf8");
      for (const hit of findUnmarkedCoercions(text, file.endsWith(".svelte"))) {
        offenders.push(`${file}:${hit.line}  [${hit.pattern}]  ${hit.text}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the one module that may coerce actually does", () => {
    const text = fs.readFileSync(path.join(SRC, COERCION_HOME), "utf8");
    expect(findUnmarkedCoercions(text).length).toBeGreaterThan(0);
  });
});
