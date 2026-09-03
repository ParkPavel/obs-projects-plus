/**
 * A182 — acceptance for #182, and the measurement that refuted its diagnosis.
 *
 * The ticket said the mobile bottom sheet comes out "the width of the widget",
 * because `.ppp-widget-host` declares `container-type: inline-size` and that
 * makes it the containing block for the sheet's `position: fixed` backdrop.
 * Two independent passes said so — the `lead` working #166 step 3 and the
 * adversarial review — and #112's own code comment says the same thing about
 * the desktop popup.
 *
 * **It is not true, and this file is how that was settled.** In Chrome, only
 * `transform` and `contain: paint` make an element a containing block for a
 * fixed descendant. `overflow: hidden` does not, `container-type: inline-size`
 * does not, and neither does `container-type: size`. The sheet is the screen's
 * width either way, and it is not clipped by the widget either — it is
 * hit-testable far outside it.
 *
 * So the portal the ticket proposed was reverted rather than shipped: a change
 * that fixes nothing, justified by a mechanism that does not exist, is the
 * exact shape this project keeps catching in review. What remained of #182 was
 * smaller and real: a 22rem minimum inside a 320px phone.
 *
 * The first three tests exist to keep that refutation from being re-forgotten.
 * They are the reason the fourth is only one line.
 */

import { findChrome, renderProbe, svelteStyle, unscope } from "./support/renderProbe";

const chrome = findChrome();
const describeIfChrome = chrome ? describe : describe.skip;

if (!chrome) {
  console.warn("A182: no Chrome found (set CHROME_PATH) — #182's acceptance did NOT run.");
}

describeIfChrome("A182 — what actually contains a fixed descendant", () => {
  it("neither overflow nor a container query does; transform and paint containment do", () => {
    const kinds = ["plain", "ovh", "ctype", "ctypeSize", "tf", "cpaint"] as const;
    const r = renderProbe({
      css: [
        ".plain{width:300px}",
        ".ovh{width:300px;overflow:hidden}",
        ".ctype{width:300px;container-type:inline-size}",
        ".ctypeSize{width:300px;height:200px;container-type:size}",
        ".tf{width:300px;transform:translateZ(0)}",
        ".cpaint{width:300px;contain:paint}",
        ".b{position:fixed;inset:0}",
      ],
      html: kinds.map((c) => `<div class='${c}'><div class='b' id='in-${c}'></div></div>`).join(""),
      measure: kinds.map((c) => ({ id: `in-${c}`, props: ["boxWidth"] })),
      width: 900,
      height: 700,
    });
    const w = (k: string) => Number(r[`in-${k}`]!["boxWidth"]);
    // The viewport minus its scrollbar — "the screen", whatever the exact number.
    const screen = w("plain");
    expect(screen).toBeGreaterThan(800);
    expect(w("ovh")).toBe(screen);
    expect(w("ctype")).toBe(screen);
    expect(w("ctypeSize")).toBe(screen);
    // And the two that really do contain it:
    expect(w("tf")).toBe(300);
    expect(w("cpaint")).toBe(300);
  });

  it("the real widget shell does not contain the real backdrop either", () => {
    // Not a reconstruction: both rules come from their own components.
    const popup = unscope(svelteStyle("ui/components/FloatingPopup/FloatingPopup.svelte"));
    const shell = unscope(svelteStyle("ui/views/Dashboard/widgets/WidgetShell.svelte"));
    const r = renderProbe({
      css: [popup, shell, ".ppp-widget-host{width:300px;height:100px}"],
      html: "<div class='ppp-widget-host'><div class='ppp-popup-backdrop' id='sheet'></div></div>",
      measure: [{ id: "sheet", props: ["boxWidth"] }],
      width: 900,
      height: 700,
    });
    expect(Number(r["sheet"]!["boxWidth"])).toBeGreaterThan(800);
  });

  it("nor is it clipped by the widget — it answers a hit test far outside it", () => {
    const popup = unscope(svelteStyle("ui/components/FloatingPopup/FloatingPopup.svelte"));
    const shell = unscope(svelteStyle("ui/views/Dashboard/widgets/WidgetShell.svelte"));
    const r = renderProbe({
      css: [popup, shell, ".ppp-widget-host{width:300px;height:100px}"],
      html: "<div class='ppp-widget-host'><div class='ppp-popup-backdrop' id='sheet'></div></div>",
      evaluate: [
        "const el = document.elementFromPoint(700, 400);",
        "probe.at = el ? (el.id || '(unnamed)') : '(none)';",
      ].join("\n"),
      measure: [],
      width: 900,
      height: 700,
    });
    expect(r["__probe"]!["at"]).toBe("sheet");
  });
});

describeIfChrome("A182 — what was real: the minimum on a narrow screen", () => {
  const bar = unscope(svelteStyle("ui/views/Dashboard/widgets/DatabaseCall/BlockFilterBar.svelte"));

  it("keeps its 22rem where there is room", () => {
    const r = renderProbe({
      css: ["*{box-sizing:border-box}", bar, ".host{width:600px}"],
      html: "<div class='host'><div class='ppp-blockfilter-popover' id='wide'></div></div>",
      measure: [{ id: "wide", props: ["boxWidth"] }],
    });
    expect(Number(r["wide"]!["boxWidth"])).toBeGreaterThanOrEqual(352);
  });

  it("yields on a 320px phone instead of pushing content off the edge", () => {
    // `box-sizing: border-box` models the host: Obsidian sets it globally, and
    // without it the popover's own padding would make even a correct minimum
    // measure wider than its parent. Stated because it is the one place this
    // probe assumes something about the app rather than reading it.
    const r = renderProbe({
      css: ["*{box-sizing:border-box}", bar, ".host{width:320px}"],
      html: "<div class='host'><div class='ppp-blockfilter-popover' id='narrow'></div></div>",
      measure: [{ id: "narrow", props: ["boxWidth"] }],
      width: 320,
      height: 700,
    });
    expect(Number(r["narrow"]!["boxWidth"])).toBeLessThanOrEqual(320);
  });
});
