/**
 * A169 — acceptance for #169, in a browser, because jsdom does not move focus.
 *
 * The ticket's finding is that two surfaces declare `role="dialog"` and
 * `aria-modal="true"` and then let Tab walk straight out of them, and that four
 * invisible buttons per widget stay in the tab order. Both are claims about
 * what a keyboard does, and **jsdom does not implement Tab traversal at all** —
 * a test there would assert that the test pressed a key, not that focus moved.
 *
 * So the trap is exercised in Chrome, against its own source: `focusTrap.ts` is
 * compiled with the test and driven over real markup, and the header actions'
 * own `<style>` block decides whether a hidden button is reachable.
 */

import { execFileSync } from "child_process";
import * as path from "path";

import { findChrome, renderProbe, svelteStyle, unscope, SRC_ROOT } from "./support/renderProbe";
import { focusableWithin } from "src/lib/a11y/focusTrap";

const chrome = findChrome();
const describeIfChrome = chrome ? describe : describe.skip;

if (!chrome) {
  console.warn("A169: no Chrome found (set CHROME_PATH) — the keyboard acceptance did NOT run.");
}

/**
 * `focusTrap.ts` compiled to something a page can run.
 *
 * Compiled rather than re-typed: a re-typed trap would test a copy, which is
 * the failure mode every probe in this repo has been faulted for at least once.
 */
let trapCache: string | null = null;
function trapSource(): string {
  if (trapCache !== null) return trapCache;
  // esbuild's own API refuses to run here: jsdom replaces `TextEncoder` with a
  // version whose output is not a `Uint8Array`, and esbuild checks that
  // invariant before doing anything. So it runs in a clean Node process
  // instead — `npx` is avoided because on Windows it needs a shell and
  // `execFileSync` cannot give it one.
  const out = execFileSync(
    process.execPath,
    [
      path.join(SRC_ROOT, "..", "node_modules", "esbuild", "bin", "esbuild"),
      path.join(SRC_ROOT, "lib/a11y/focusTrap.ts"),
      "--bundle",
      "--format=iife",
      "--global-name=PPPTrap",
      "--log-level=error",
    ],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024 }
  );
  trapCache = out;
  return trapCache;
}

describeIfChrome("A169 — a surface that calls itself modal keeps the keyboard", () => {
  const PANEL = [
    "<button id='outside-before'>before</button>",
    "<aside id='panel' role='dialog' aria-modal='true'>",
    "  <button id='first'>first</button>",
    "  <input id='middle' />",
    "  <button id='last'>last</button>",
    "</aside>",
    "<button id='outside-after'>after</button>",
  ].join("\n");

  const withTrap = (script: string) =>
    renderProbe({
      css: [],
      html: `${PANEL}<script>${trapSource()}</script>`,
      evaluate: [
        "const panel = document.getElementById('panel');",
        "document.getElementById('outside-before').focus();",
        "const handle = PPPTrap.focusTrap(panel, { active: true });",
        script,
        "probe.active = document.activeElement ? document.activeElement.id : '(none)';",
      ].join("\n"),
      measure: [],
    });

  const tab = (shift = false) =>
    [
      "const ev = new KeyboardEvent('keydown', " +
        `{ key: 'Tab', shiftKey: ${shift}, bubbles: true, cancelable: true });`,
      "document.activeElement.dispatchEvent(ev);",
      // A synthetic Tab does not move focus by itself — the browser's own
      // default action is not run for an untrusted event. So the trap's job
      // here is precisely the interesting half: when it calls preventDefault
      // and redirects, focus moves; when it does not, focus stays put and the
      // real browser would have carried it out of the dialog.
    ].join("\n");

  it("moves focus into the panel when it opens", () => {
    const r = withTrap("");
    expect(r["__probe"]!["active"]).toBe("first");
  });

  it("Tab at the last element wraps to the first instead of leaving", () => {
    const r = withTrap(["document.getElementById('last').focus();", tab()].join("\n"));
    expect(r["__probe"]!["active"]).toBe("first");
  });

  it("Shift+Tab at the first element wraps to the last instead of leaving", () => {
    const r = withTrap(["document.getElementById('first').focus();", tab(true)].join("\n"));
    expect(r["__probe"]!["active"]).toBe("last");
  });

  it("gives focus back to whatever had it when the panel closes", () => {
    const r = withTrap("handle.update({ active: false });");
    expect(r["__probe"]!["active"]).toBe("outside-before");
  });

  it("does not steal focus back when the caller has moved it on purpose", () => {
    // Closing a panel by activating something else must not yank the user
    // backwards. The trap checks where focus actually is rather than assuming.
    const r = withTrap(
      ["document.getElementById('outside-after').focus();", "handle.update({ active: false });"].join("\n")
    );
    expect(r["__probe"]!["active"]).toBe("outside-after");
  });

  it("focuses the container itself when the panel has nothing focusable", () => {
    const r = renderProbe({
      css: [],
      html: `<button id='before'>b</button><aside id='empty' role='dialog'><p>text</p></aside><script>${trapSource()}</script>`,
      evaluate: [
        "document.getElementById('before').focus();",
        "PPPTrap.focusTrap(document.getElementById('empty'), { active: true });",
        "probe.active = document.activeElement ? document.activeElement.id : '(none)';",
        "probe.tabindex = document.getElementById('empty').getAttribute('tabindex') || '(none)';",
      ].join("\n"),
      measure: [],
    });
    expect(r["__probe"]!["active"]).toBe("empty");
    expect(r["__probe"]!["tabindex"]).toBe("-1");
  });
});

describeIfChrome("A169 — an invisible action is not a tab stop", () => {
  const actions = unscope(svelteStyle("ui/views/Dashboard/widgets/WidgetHeaderActions.svelte"));

  it("a widget's hover-only buttons are unreachable until the widget is focused", () => {
    const r = renderProbe({
      css: [actions, ".ppp-widget-host{width:400px}"],
      html: [
        "<div class='ppp-widget-host' id='host'>",
        "  <button class='ppp-widget-settings-btn' id='cog'>c</button>",
        "  <button class='ppp-widget-remove-btn' id='rm'>x</button>",
        "</div>",
      ].join("\n"),
      measure: [
        { id: "cog", props: ["visibility", "opacity"] },
        { id: "rm", props: ["visibility"] },
      ],
    });
    // `opacity: 0` alone leaves an element focusable; `visibility: hidden` does
    // not. That is the whole fix, and this is the assertion that says so.
    expect(r["cog"]!["visibility"]).toBe("hidden");
    expect(r["rm"]!["visibility"]).toBe("hidden");
  });

  it("a hidden action cannot take focus, and the always-visible menu button can", () => {
    // The keyboard path is not these four buttons — it is the menu button,
    // which the component's own comment calls the one discoverable entry.
    //
    // A first attempt at this fix also revealed them on `:focus-within`, so
    // they would stay keyboard-reachable. That cannot work, and the reason is
    // worth keeping: a `visibility: hidden` element is not focusable, so focus
    // can never get inside to trigger the rule. This asserts the arrangement
    // that does work rather than the one that reads well.
    const r = renderProbe({
      css: [actions, ".ppp-widget-host{width:400px}"],
      html: [
        "<div class='ppp-widget-host' id='host'>",
        "  <button class='ppp-widget-menu-btn' id='menu'>m</button>",
        "  <button class='ppp-widget-settings-btn' id='cog'>c</button>",
        "</div>",
      ].join("\n"),
      evaluate: [
        "document.getElementById('cog').focus();",
        "probe.afterCog = document.activeElement ? document.activeElement.id : '(body)';",
        "document.getElementById('menu').focus();",
        "probe.afterMenu = document.activeElement ? document.activeElement.id : '(body)';",
      ].join("\n"),
      measure: [{ id: "menu", props: ["visibility"] }],
    });
    expect(r["__probe"]!["afterCog"]).not.toBe("cog");
    expect(r["__probe"]!["afterMenu"]).toBe("menu");
    expect(r["menu"]!["visibility"]).toBe("visible");
  });
});

describe("A169 — the focusable scan itself (no browser needed)", () => {
  // The trap's own predicate, exercised in jsdom where that IS enough: it is a
  // question about attributes and computed style, not about traversal.
  it("skips an inert subtree and a disabled control", () => {
    document.body.innerHTML = [
      "<div id='root'>",
      "  <button id='a'>a</button>",
      "  <button id='b' disabled>b</button>",
      "  <div inert><button id='c'>c</button></div>",
      "  <a id='d' href='#x'>d</a>",
      "  <span id='e' tabindex='-1'>e</span>",
      "</div>",
    ].join("");
    const ids = focusableWithin(document.getElementById("root") as HTMLElement).map((el) => el.id);
    expect(ids).toEqual(["a", "d"]);
  });
});
