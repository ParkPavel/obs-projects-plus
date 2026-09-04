/**
 * A190 — acceptance for #190: the peek panel belongs to the view, not the window.
 *
 * The defect was one declaration. `.ppp-slide-in-panel` was `position: fixed`,
 * so its box was the window's: the plugin's own sticky header painted over it
 * (`z-index: 90` against the panel's `50`, with a blur, so the panel's title
 * showed through as a smear), and in a split pane it drew across the
 * neighbouring leaf and Obsidian's chrome.
 *
 * ## Why this file measures instead of reading the source
 *
 * The fix writes no number anywhere. The panel's top edge is not computed from
 * the header's height — the header and the overlay layer are two rows of one
 * grid, and the layer's top edge simply IS the header's bottom edge. A test
 * that read the CSS could only restate that sentence. So the geometry is
 * rendered, twice, **with two different header heights**: one run would pass
 * just as happily against a hardcoded offset, and the pair is the whole point.
 *
 * The width test is the other non-tautology: `panel.boxWidth ===
 * container.boxWidth` inside a container narrower than the viewport is exactly
 * what the old `max-width: 100vw` failed.
 *
 * ## What it cannot see, said here rather than implied
 *
 * The probe page holds the plugin subtree and nothing else, so no assertion
 * below is evidence that Obsidian's chrome or a second leaf is uncovered. The
 * mechanism is proven — no `position: fixed` survives — but the screenshot is a
 * human's job, and #190's report says so.
 */

import {
  findChrome,
  renderProbe,
  svelteStyle,
  unscope,
  cssFile,
} from "./support/renderProbe";
import { OVERLAY_CLASS, portalToOverlay } from "src/ui/app/overlayPortal";
import { tick } from "svelte";
import * as fs from "fs";
import * as path from "path";

const chrome = findChrome();
const describeIfChrome = chrome ? describe : describe.skip;

if (!chrome) {
  console.warn(
    "A190: no Chrome found (set CHROME_PATH) — #190's acceptance did NOT run."
  );
}

const appCss = unscope(svelteStyle("ui/app/App.svelte"));
const navCss = unscope(
  svelteStyle("ui/components/Navigation/CompactNavBar.svelte")
);
const panelCss = unscope(
  svelteStyle("ui/components/SlideInPanel/SlideInPanel.svelte")
);
const tokens = cssFile("ui/tokens/tokens.css");

/**
 * The DOM as it stands once `portalToOverlay` has run: both of the panel's
 * nodes inside the layer. The action itself is asserted separately, in jsdom.
 */
const markup = (extra = ""): string =>
  [
    "<div class='projects-container' id='container'>",
    "  <nav class='compact-navbar' id='navbar'><span>project</span></nav>",
    "  <div class='projects-main' id='main'>",
    `    ${extra}`,
    "  </div>",
    `  <div class='${OVERLAY_CLASS}' id='layer'>`,
    "    <div class='ppp-slide-in-backdrop ppp-slide-in-backdrop--open' id='backdrop'></div>",
    "    <aside class='ppp-slide-in-panel ppp-slide-in-panel--open' id='panel' style='width: 28rem'>",
    "      <header class='ppp-slide-in-header'><span class='ppp-slide-in-title'>Record</span></header>",
    "    </aside>",
    "  </div>",
    "</div>",
  ].join("\n");

/** A host of a stated size, so "the container" is never "the window". */
const host = (w: number, h: number) =>
  `html,body{width:${w}px;height:${h}px}.projects-container{width:${w}px;height:${h}px}`;

describeIfChrome("A190 — the top edge is inherited, not calculated", () => {
  const run = (navHeight: number) =>
    renderProbe({
      css: [
        "*{box-sizing:border-box}",
        tokens,
        navCss,
        appCss,
        panelCss,
        host(900, 600),
        `.compact-navbar{min-height:${navHeight}px}`,
      ],
      html: markup(),
      measure: [
        { id: "navbar", props: ["boxTop", "boxBottom"] },
        { id: "panel", props: ["boxTop", "boxBottom", "boxWidth"] },
        { id: "backdrop", props: ["boxTop"] },
      ],
      width: 1000,
      height: 700,
    });

  const short = run(40);
  const tall = run(120);

  it("the panel starts where the header ends — at both header heights", () => {
    expect(short["panel"]!["boxTop"]).toBe(short["navbar"]!["boxBottom"]);
    expect(tall["panel"]!["boxTop"]).toBe(tall["navbar"]!["boxBottom"]);
  });

  it("no offset is written down: the edge moves by exactly the header's growth", () => {
    // The refutation of a hardcoded `top`. If a number were in the CSS, the two
    // runs would agree with each other and disagree with the header.
    const grew =
      Number(tall["navbar"]!["boxBottom"]) -
      Number(short["navbar"]!["boxBottom"]);
    const moved =
      Number(tall["panel"]!["boxTop"]) - Number(short["panel"]!["boxTop"]);
    expect(grew).toBe(80);
    expect(moved).toBe(grew);
  });

  it("the backdrop stops where the panel does — it dims the view, not the app", () => {
    expect(short["backdrop"]!["boxTop"]).toBe(short["panel"]!["boxTop"]);
    expect(tall["backdrop"]!["boxTop"]).toBe(tall["panel"]!["boxTop"]);
  });
});

describeIfChrome("A190 — the header stays visible and on top", () => {
  it("a hit test in the middle of the header answers the header, not the panel", () => {
    const r = renderProbe({
      css: [
        "*{box-sizing:border-box}",
        tokens,
        navCss,
        appCss,
        panelCss,
        host(900, 600),
        ".compact-navbar{min-height:40px}",
      ],
      html: markup(),
      evaluate: [
        "const el = document.elementFromPoint(450, 20);",
        "probe.at = el ? (el.id || el.className || '(unnamed)') : '(none)';",
      ].join("\n"),
      measure: [],
      width: 1000,
      height: 700,
    });
    expect(r["__probe"]!["at"]).toBe("navbar");
  });

  it("nothing inside the view paints over the panel, however loud its z-index", () => {
    // `.projects-main` is a stacking context now, so a raw `z-index: 100` on one
    // of its descendants is confined to it. This is the assertion that would
    // fail if the `z-index` on `.projects-main` were ever tidied away.
    const r = renderProbe({
      css: [
        "*{box-sizing:border-box}",
        tokens,
        navCss,
        appCss,
        panelCss,
        host(900, 600),
        ".compact-navbar{min-height:40px}",
        ".loud{position:absolute;inset:0;z-index:100}",
      ],
      html: markup("<div class='loud' id='loud'></div>"),
      evaluate: [
        "const el = document.elementFromPoint(800, 400);",
        "probe.at = el ? (el.id || el.className || '(unnamed)') : '(none)';",
      ].join("\n"),
      measure: [],
      width: 1000,
      height: 700,
    });
    expect(r["__probe"]!["at"]).toBe("panel");
  });
});

describeIfChrome("A190 — the width belongs to the container", () => {
  const measureIn = (w: number) =>
    renderProbe({
      css: [
        "*{box-sizing:border-box}",
        tokens,
        navCss,
        appCss,
        panelCss,
        host(w, 600),
        ".compact-navbar{min-height:40px}",
      ],
      html: markup(),
      measure: [
        { id: "container", props: ["boxWidth"] },
        { id: "panel", props: ["boxWidth"] },
      ],
      // The viewport stays wide on purpose: a container narrower than the
      // window is the only arrangement in which `100%` and `100vw` differ, and
      // telling them apart is what this suite is for.
      width: 1000,
      height: 700,
    });

  it("keeps its 28rem where the container has room", () => {
    const r = measureIn(900);
    expect(Number(r["panel"]!["boxWidth"])).toBe(448);
  });

  it("yields to a narrow container instead of to the window", () => {
    // The one that is red against the old code: `max-width: 100vw` on a
    // window-anchored panel measured 448 inside a 300px container.
    const r = measureIn(300);
    expect(r["panel"]!["boxWidth"]).toBe(r["container"]!["boxWidth"]);
    expect(Number(r["panel"]!["boxWidth"])).toBe(300);
  });
});

describe("A190 — the panel can no longer escape its view", () => {
  it("neither of its two boxes is anchored to the window any more", () => {
    // Text, not measurement: `position: fixed` anywhere in this component would
    // reintroduce the defect regardless of what any layout happens to show.
    expect(panelCss).not.toMatch(/position:\s*fixed/);
  });

  it("the component actually ASKS to be moved — both of its boxes", () => {
    // Found by audit, and it is the hole the geometry tests cannot see: the
    // browser markup below is written as it stands AFTER the portal has run, so
    // deleting `use:portalToOverlay` from the component would leave every
    // measurement green while the live panel stayed inside `.projects-main` and
    // scrolled with it. The panel and its backdrop are separate root nodes and
    // both must travel; one alone leaves a scrim anchored to the old parent.
    const panel = fs.readFileSync(
      path.join(__dirname, "..", "ui", "components", "SlideInPanel", "SlideInPanel.svelte"),
      "utf8"
    );
    // Counted as an attribute on its own line, so the sentence about it in the
    // comment above the `<aside>` is not mistaken for a third use.
    const uses = panel
      .split("\n")
      .filter((line) => line.trim().startsWith("use:portalToOverlay"));
    expect(uses).toHaveLength(2);
    expect(panel).toContain('from "src/ui/app/overlayPortal"');
  });

  it("and asks before it asks for the focus trap", () => {
    // Order is free insurance rather than a live requirement: the panel mounts
    // once per view and travels while closed, so no focus is inside it today.
    // If anyone later wraps it in `{#if open}` the move would happen with the
    // trap active, and moving a node with focus inside resets focus in Chrome.
    const panel = fs.readFileSync(
      path.join(__dirname, "..", "ui", "components", "SlideInPanel", "SlideInPanel.svelte"),
      "utf8"
    );
    expect(panel.indexOf("use:portalToOverlay")).toBeLessThan(panel.indexOf("use:focusTrap"));
  });

  it("the layer is declared before the settings popover, which nothing else can catch", () => {
    // Both sit on `--ppp-z-overlay`, so DOM order decides. Move the layer after
    // the popover and the settings menu slides under an open panel — and the
    // popover renders conditionally, so no probe page would ever build it.
    const app = fs.readFileSync(
      path.join(__dirname, "..", "ui", "app", "App.svelte"),
      "utf8"
    );
    const layer = app.indexOf(`class="${OVERLAY_CLASS}"`);
    const popover = app.indexOf("{#if settingsMenuOpen}");
    expect(layer).toBeGreaterThan(-1);
    expect(popover).toBeGreaterThan(layer);
  });

  it("the layer's class is one string, written the same way in both places", () => {
    // Cheaper than fighting Svelte's scoped styles for a shared constant, and
    // this is the assertion that keeps the literal and the constant together.
    const app = fs.readFileSync(
      path.join(__dirname, "..", "ui", "app", "App.svelte"),
      "utf8"
    );
    expect(app).toContain(`class="${OVERLAY_CLASS}"`);
    expect(appCss).toContain(`.${OVERLAY_CLASS}`);
  });

  it("the layer clips rather than scrolls — the closed panel is parked outside it", () => {
    // `overflow: hidden` would make the layer a scroll container and the panel
    // at `translateX(100%)` scrollable overflow. Named because the neighbouring
    // `.projects-container` says `hidden` and invites an "alignment".
    expect(appCss).toMatch(/\.ppp-app-overlay\s*\{[^}]*overflow:\s*clip/);
  });
});

/**
 * The fallback branch, in jsdom.
 *
 * A silent fallback that never runs is indistinguishable from one that is not
 * there, so these assert the fallback itself rather than its equivalence to the
 * real path. The third is the one that matters: it is the only check here that
 * a `document.querySelector` would fail.
 */
describe("A190 — portalToOverlay when there is no layer, and when there are two", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("a node with no container ancestor is left exactly where it is", () => {
    const orphan = document.createElement("div");
    document.body.appendChild(orphan);
    const handle = portalToOverlay(orphan);
    expect(orphan.parentElement).toBe(document.body);
    handle.destroy();
  });

  it("destroy() twice is not an error", () => {
    const container = document.createElement("div");
    container.className = "projects-container";
    const layer = document.createElement("div");
    layer.className = OVERLAY_CLASS;
    const node = document.createElement("div");
    container.append(layer, node);
    document.body.appendChild(container);

    const handle = portalToOverlay(node);
    expect(node.parentElement).toBe(layer);
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });

  it("in a split pane the node lands in ITS OWN leaf's layer", async () => {
    const leaves = ["a", "b"].map((id) => {
      const container = document.createElement("div");
      container.className = "projects-container";
      const layer = document.createElement("div");
      layer.className = OVERLAY_CLASS;
      layer.id = `layer-${id}`;
      const main = document.createElement("div");
      main.className = "projects-main";
      const node = document.createElement("div");
      node.id = `panel-${id}`;
      main.appendChild(node);
      container.append(main, layer);
      document.body.appendChild(container);
      return { layer, node };
    });

    const second = leaves[1]!;
    portalToOverlay(second.node);
    await tick();

    expect(second.node.parentElement).toBe(second.layer);
    expect(leaves[0]!.layer.children).toHaveLength(0);
  });
});
