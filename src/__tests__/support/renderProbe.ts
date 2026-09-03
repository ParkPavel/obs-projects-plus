/**
 * Render acceptance — a headless browser as an ordinary test dependency.
 *
 * ## Why this exists
 *
 * Three tickets in a row (#165, #166, #180) reached the same wall: the claim
 * was about pixels and every gate we had was blind to it. jsdom implements no
 * container queries, lays out no SVG and computes no cascade; the REST pipeline
 * returns commands and file contents, never a computed style. So each ticket
 * shipped with an acceptance item that only a human at a screen could close,
 * and those items accumulated.
 *
 * The probes written for #165 and #166 already answered the questions — in
 * headless Chrome, by hand, once. The adversarial review of #166 step 2 then
 * found the flaw in doing it that way: **the probe was a reconstruction.** It
 * had the shape of the component and not its rules, so it could agree with a
 * belief instead of with the product. It also lied uniformly once, when its own
 * flex row shrank every cell, and a probe that lies in the same direction
 * everywhere is the easiest kind to believe.
 *
 * This module fixes both faults at once. It builds the page **from the source
 * files themselves** — `tokens.css` verbatim, a component's `<style>` block
 * verbatim — and it runs as a test, so the acceptance is re-checked on every
 * run instead of being remembered from a session in September.
 *
 * ## What it is not
 *
 * It is a cascade and layout oracle, not Obsidian. It cannot see the host's
 * own stylesheet, a theme, or a user snippet, and it says so where a test
 * depends on that. A green run here means the RULES compose as claimed; it does
 * not mean the screen is beautiful. That judgement stays with a person, and
 * this file exists so that it is the only thing left for one.
 */

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const SRC_ROOT = path.resolve(__dirname, "..", "..");

/** Where Chrome lives on this machine. `null` when there is none to run. */
export function findChrome(): string | null {
  const candidates = [
    process.env["CHROME_PATH"],
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* unreadable candidate is simply not it */
    }
  }
  return null;
}

/** The contents of every `<style>` block in a `.svelte` file, concatenated. */
export function svelteStyle(relPath: string): string {
  const text = fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
  const blocks = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? "");
  if (blocks.length === 0) {
    throw new Error(`${relPath} has no <style> block — the probe would test nothing`);
  }
  return blocks.join("\n");
}

/** A stylesheet from `src/`, verbatim. */
export function cssFile(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

/**
 * Svelte scopes component CSS by appending a generated class to every selector.
 * The probe renders plain markup, so the scoping is stripped rather than
 * reproduced: `:global(...)` unwraps, and a `.svelte-xxxxxx` suffix would never
 * match anything here. Both are the compiler's business, not the cascade's, and
 * this is the one place the probe departs from the source text — stated here
 * because an unstated departure is how a reconstruction starts.
 */
export function unscope(css: string): string {
  return css.replace(/:global\(([^)]*)\)/g, "$1").replace(/\.svelte-[a-z0-9]+/g, "");
}

export interface ProbeElement {
  /** Key in the returned record. */
  readonly id: string;
  /** Property names to read off `getComputedStyle`. */
  readonly props: readonly string[];
}

export interface ProbeSpec {
  /** Stylesheets, in cascade order. */
  readonly css: readonly string[];
  /** Body markup. Elements to measure carry an `id`. */
  readonly html: string;
  readonly measure: readonly ProbeElement[];
  /** Viewport, so a viewport-derived fallback is deterministic. */
  readonly width?: number;
  readonly height?: number;
}

export type ProbeResult = Record<string, Record<string, string>>;

/**
 * Render `spec` in headless Chrome and return the computed values asked for.
 *
 * Throws rather than returning a default when the browser is missing or the
 * page fails: a probe that silently returns nothing would turn every assertion
 * that follows into a claim about an empty object.
 */
export function renderProbe(spec: ProbeSpec): ProbeResult {
  const chrome = findChrome();
  if (!chrome) throw new Error("no Chrome found; set CHROME_PATH");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ppp-probe-"));
  try {
    const page = [
      "<!doctype html><html><head><meta charset='utf-8'>",
      "<style>html,body{margin:0;padding:0}</style>",
      ...spec.css.map((c) => `<style>${c}</style>`),
      "</head><body>",
      spec.html,
      "<script>",
      `const SPEC = ${JSON.stringify(spec.measure)};`,
      "const out = {};",
      "for (const el of SPEC) {",
      "  const node = document.getElementById(el.id);",
      "  if (!node) { out[el.id] = { missing: 'true' }; continue; }",
      "  const cs = getComputedStyle(node);",
      "  const rect = node.getBoundingClientRect();",
      "  const rec = {};",
      "  for (const p of el.props) {",
      "    rec[p] = p === 'boxWidth' ? String(Math.round(rect.width * 100) / 100)",
      "      : p === 'boxHeight' ? String(Math.round(rect.height * 100) / 100)",
      "      : cs.getPropertyValue(p).trim();",
      "  }",
      "  out[el.id] = rec;",
      "}",
      "document.title = 'PROBE' + JSON.stringify(out);",
      "</script></body></html>",
    ].join("\n");

    const file = path.join(dir, "probe.html");
    fs.writeFileSync(file, page, "utf8");

    const dom = execFileSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--disable-extensions",
        `--window-size=${spec.width ?? 1400},${spec.height ?? 900}`,
        "--virtual-time-budget=2000",
        `--user-data-dir=${path.join(dir, "profile")}`,
        "--dump-dom",
        `file:///${file.replace(/\\/g, "/")}`,
      ],
      { encoding: "utf8", timeout: 60_000, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
    );

    const m = /<title>PROBE([\s\S]*?)<\/title>/.exec(dom);
    if (!m || !m[1]) {
      throw new Error("the probe page did not report — its script did not run");
    }
    return JSON.parse(decodeEntities(m[1])) as ProbeResult;
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* a leftover temp dir is not worth failing a test over */
    }
  }
}

/** `--dump-dom` escapes the title; the probe's payload is JSON, so undo it. */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** `"18.4px"` → `18.4`. Throws on anything that is not a px length. */
export function px(value: string): number {
  const m = /^(-?[\d.]+)px$/.exec(value.trim());
  if (!m || !m[1]) throw new Error(`not a px length: ${JSON.stringify(value)}`);
  return Number(m[1]);
}
