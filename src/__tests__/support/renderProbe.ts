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
  /**
   * A statement run after the page settles and before anything is measured,
   * with `probe` in scope: whatever it assigns to `probe.<key>` is returned
   * alongside the measurements.
   *
   * This is how a question that is not about a computed style gets asked —
   * which element has focus, where Tab goes next. jsdom does not move focus on
   * Tab at all, so a keyboard claim tested there is a claim about the test.
   */
  readonly evaluate?: string;
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
      "const probe = {};",
      spec.evaluate ? `try { ${spec.evaluate} } catch (e) { probe.error = String(e); }` : "",
      "out.__probe = probe;",
      "for (const el of SPEC) {",
      "  const node = document.getElementById(el.id);",
      "  if (!node) { out[el.id] = { missing: 'true' }; continue; }",
      "  const cs = getComputedStyle(node);",
      "  const rect = node.getBoundingClientRect();",
      "  const rec = {};",
      "  for (const p of el.props) {",
      "    rec[p] = p === 'boxWidth' ? String(Math.round(rect.width * 100) / 100)",
      "      : p === 'boxHeight' ? String(Math.round(rect.height * 100) / 100)",
      "      : p === 'boxTop' ? String(Math.round(rect.top * 100) / 100)",
      "      : p === 'boxBottom' ? String(Math.round(rect.bottom * 100) / 100)",
      "      : p === 'boxLeft' ? String(Math.round(rect.left * 100) / 100)",
      "      : p === 'boxRight' ? String(Math.round(rect.right * 100) / 100)",
      "      : cs.getPropertyValue(p).trim();",
      "  }",
      "  out[el.id] = rec;",
      "}",
      "document.title = 'PROBE' + JSON.stringify(out);",
      "</script></body></html>",
    ].join("\n");

    const file = path.join(dir, "probe.html");
    fs.writeFileSync(file, page, "utf8");

    const args = [
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
    ];

    // #196: under a full parallel run these suites were failing to START, with
    // `spawnSync ... ETIMEDOUT` — the browser could not come up inside the
    // window while the rest of the run competed for the machine. That is a
    // resource failure wearing the costume of a broken acceptance test, and the
    // habit it teaches — ignoring red — is the expensive part.
    //
    // So a launch timeout is retried once, with a longer window, and only then
    // reported. A second timeout is still a failure: this hides contention, not
    // a browser that cannot run at all.
    const dom = withBrowserLock(() => {
      try {
        return execFileSync(chrome, args, {
          encoding: "utf8",
          timeout: 60_000,
          maxBuffer: 32 * 1024 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch (err) {
        if (!isLaunchTimeout(err)) throw err;
        return execFileSync(chrome, args, {
          encoding: "utf8",
          timeout: 180_000,
          maxBuffer: 32 * 1024 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        });
      }
    });

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
/**
 * #196: did the browser fail to START, or did it run and fail?
 *
 * Only the first is retried. `execFileSync` reports a timeout as `ETIMEDOUT`
 * with `signal: SIGTERM`; a page that ran and threw comes back as a non-zero
 * status, and retrying that would just take twice as long to tell the truth.
 */
function isLaunchTimeout(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === "ETIMEDOUT";
}

/** A synchronous pause. `execFileSync` is synchronous; a timer cannot help here. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * #196 — at most two browsers at a time, across Jest workers.
 *
 * Five acceptance suites drive Chrome, Jest runs them in parallel, and each
 * instance wants its own several hundred megabytes. Measured on this machine
 * mid-session: five suites failed to start under the full run and all three
 * of the ones re-run with `--runInBand` passed, with ~1.5GB free and the
 * user's own browser holding a gigabyte of it. So the failure was contention,
 * not code — and a suite that goes red for a reason unrelated to its subject
 * teaches people to ignore red.
 *
 * Lock files in the OS temp dir cap the launches. Workers are separate
 * processes, so this cannot be a variable.
 *
 * TWO slots, not one, and the number was corrected by measurement rather than
 * chosen: each suite launches the browser several times over (A190 alone probes
 * six times), so a strict queue pushed the full run past ten minutes — a cure
 * that costs more than the disease, since a gate nobody can finish is a gate
 * nobody runs. Two keeps the parallelism that matters while never putting five
 * browsers on the machine at once, which is what actually starved them.
 *
 * Two deliberate escape hatches, because a stuck lock must never be worse than
 * the contention it prevents: a lock older than the longest possible launch is
 * treated as abandoned, and a wait that exceeds the deadline runs anyway.
 */
const BROWSER_SLOTS = 2;

function withBrowserLock<T>(run: () => T): T {
  const slots = Array.from({ length: BROWSER_SLOTS }, (_, i) =>
    path.join(os.tmpdir(), `ppp-render-probe-${i}.lock`)
  );
  const deadline = Date.now() + 90_000;
  let held: { fd: number; file: string } | null = null;

  while (held === null && Date.now() < deadline) {
    for (const file of slots) {
      try {
        held = { fd: fs.openSync(file, "wx"), file };
        break;
      } catch {
        try {
          if (Date.now() - fs.statSync(file).mtimeMs > 300_000) {
            fs.rmSync(file, { force: true });
          }
        } catch {
          // Released between our open and our stat. The next pass sees it.
        }
      }
    }
    if (held === null) sleepSync(150);
  }

  try {
    return run();
  } finally {
    if (held !== null) {
      try {
        fs.closeSync(held.fd);
        fs.rmSync(held.file, { force: true });
      } catch {
        /* a leftover lock ages out; failing here would fail a passing test */
      }
    }
  }
}

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
