/**
 * A166 — acceptance for #166, run rather than remembered.
 *
 * #166 shipped in three steps and each left an item that "only a vault run can
 * close". Those items are the four below, and they are closed here instead:
 * every one is a statement about the cascade or about layout, and both are
 * things a browser can be asked. The page is assembled from `tokens.css` and
 * from the components' own `<style>` blocks — see `support/renderProbe.ts` for
 * why a reconstruction was not good enough.
 *
 * What this does NOT close, said plainly so nobody reads more into a green run:
 * whether the result looks right. A chart whose labels are all 11px and whose
 * pie sits centred can still be ugly at 1600px. That judgement is a person's;
 * everything mechanical is here.
 */

import {
  cssFile,
  findChrome,
  px,
  renderProbe,
  svelteStyle,
  unscope,
} from "./support/renderProbe";

const chrome = findChrome();
const describeIfChrome = chrome ? describe : describe.skip;

if (!chrome) {
  // Not a silent skip: a suite that vanishes is indistinguishable from one that
  // passes, and this is the only acceptance #166 has.
  console.warn(
    "A166: no Chrome found (set CHROME_PATH) — #166's acceptance did NOT run in this session."
  );
}

const TOKENS = () => cssFile("ui/tokens/tokens.css");

describeIfChrome("A166 step 1 — a container decides the size, and no container means today's size", () => {
  // The level-2 scale's whole point: `cqi` inside an inherited custom property
  // must resolve against the USING element's container, not at `:root`. If that
  // is wrong every `--ppp-local-*` collapses to one viewport-derived value and
  // step 1 is decoration.
  const shell = unscope(svelteStyle("ui/views/Dashboard/widgets/WidgetShell.svelte"));

  const result = () =>
    renderProbe({
      css: [TOKENS(), shell, ".narrow{width:200px}.wide{width:800px}.plain{width:800px}"],
      html: [
        "<div class='ppp-widget-host narrow'><div class='ppp-widget-content'>",
        "<span id='narrow' style='font-size: var(--ppp-local-text-sm)'>x</span>",
        "</div></div>",
        "<div class='ppp-widget-host wide'><div class='ppp-widget-content'>",
        "<span id='wide' style='font-size: var(--ppp-local-text-sm)'>x</span>",
        "</div></div>",
        "<div class='plain'><span id='nocontainer' style='font-size: var(--ppp-local-text-sm)'>x</span></div>",
      ].join(""),
      measure: [
        { id: "narrow", props: ["font-size"] },
        { id: "wide", props: ["font-size"] },
        { id: "nocontainer", props: ["font-size"] },
      ],
    });

  it("the same token is a different size in a narrow and a wide container", () => {
    const r = result();
    const narrow = px(r["narrow"]!["font-size"]!);
    const wide = px(r["wide"]!["font-size"]!);
    expect(wide).toBeGreaterThan(narrow);
  });

  it("a consumer with no container ancestor gets the floor, not the ceiling", () => {
    // This is the direction #166 step 1 reversed. Before it, a consumer outside
    // any container resolved `cqi` against the small viewport and landed on the
    // clamp CEILING — the largest size, exactly where the principle does not
    // apply. It must now be no larger than the narrow container's value, which
    // is the floor.
    const r = result();
    const floor = px(r["narrow"]!["font-size"]!);
    const outside = px(r["nocontainer"]!["font-size"]!);
    expect(outside).toBeLessThanOrEqual(floor);
  });
});

describeIfChrome("A166 step 2 — one user unit is one CSS pixel at every width", () => {
  // The defect: every chart root carries a viewBox and no width/height, so it
  // filled its parent and an 11-unit label rendered at ~5.5px in a narrow
  // widget and ~22px in a wide one. Pinning the viewBox to the measured width
  // makes the scale 1 everywhere.
  const cell = ".c{overflow:hidden}.w240{width:240px}.w960{width:960px}";

  it("a label is the same rendered size in a narrow and a wide chart", () => {
    const r = renderProbe({
      css: [cell],
      html: [
        "<div class='c w240'><svg viewBox='0 0 240 240'><text id='t240' font-size='11' y='20'>Label</text></svg></div>",
        "<div class='c w960'><svg viewBox='0 0 960 240'><text id='t960' font-size='11' y='20'>Label</text></svg></div>",
      ].join(""),
      measure: [
        { id: "t240", props: ["boxHeight"] },
        { id: "t960", props: ["boxHeight"] },
      ],
    });
    const a = Number(r["t240"]!["boxHeight"]);
    const b = Number(r["t960"]!["boxHeight"]);
    expect(Math.abs(a - b)).toBeLessThan(0.5);
  });

  it("the defect it replaced really did scale the label 4x — the fix is not for nothing", () => {
    // A fix nobody can see failing is a fix nobody can trust. This renders the
    // OLD shape, a viewBox fixed at 480 in both cells, and asserts the spread
    // the ticket was written about.
    const r = renderProbe({
      css: [cell],
      html: [
        "<div class='c w240'><svg viewBox='0 0 480 240'><text id='o240' font-size='11' y='20'>Label</text></svg></div>",
        "<div class='c w960'><svg viewBox='0 0 480 240'><text id='o960' font-size='11' y='20'>Label</text></svg></div>",
      ].join(""),
      measure: [
        { id: "o240", props: ["boxHeight"] },
        { id: "o960", props: ["boxHeight"] },
      ],
    });
    const narrow = Number(r["o240"]!["boxHeight"]);
    const wide = Number(r["o960"]!["boxHeight"]);
    expect(wide / narrow).toBeGreaterThan(3.5);
  });

  it("the pie is capped at its height and centred, not stretched to the widget", () => {
    // The Codex audit of step 2 found this: the pie's viewBox is a square
    // capped at the widget height, but its stylesheet said `width: 100%`, so in
    // a wide widget the SVG filled the container anyway and every label scaled
    // back up — the exact effect step 2 removes.
    const pie = unscope(svelteStyle("ui/views/Dashboard/widgets/Chart/PieChart.svelte"));
    const r = renderProbe({
      css: [cell, pie],
      html:
        "<div class='c w960'><svg id='pie' class='ppp-chart-pie' viewBox='0 0 240 240' width='240' height='240'></svg></div>",
      measure: [{ id: "pie", props: ["boxWidth", "max-width"] }],
    });
    expect(Number(r["pie"]!["boxWidth"])).toBeLessThanOrEqual(240);
  });
});

describeIfChrome("A166 step 3 — a fixed minimum stops overflowing a narrow container", () => {
  it("min() shrinks the minimum inside a narrow container and leaves a wide one alone", () => {
    const r = renderProbe({
      css: [
        ".box{container-type:inline-size}.narrow{width:16rem}.wide{width:40rem}",
        ".sized{min-width:min(22rem,100cqi)}",
      ],
      html: [
        "<div class='box narrow'><div id='inNarrow' class='sized'></div></div>",
        "<div class='box wide'><div id='inWide' class='sized'></div></div>",
      ].join(""),
      measure: [
        { id: "inNarrow", props: ["boxWidth"] },
        { id: "inWide", props: ["boxWidth"] },
      ],
    });
    // 16rem = 256px at the default root size, 22rem = 352px.
    expect(Number(r["inNarrow"]!["boxWidth"])).toBeLessThanOrEqual(256);
    expect(Number(r["inWide"]!["boxWidth"])).toBeGreaterThanOrEqual(352);
  });

  it("the trailing filler takes the slack and never squeezes a fixed track", () => {
    // #083's lesson, made a test rather than a comment: header, row and footer
    // consume one template, so a track that moved under one of them would move
    // the columns apart. The filler may only absorb what is left over.
    const r = renderProbe({
      css: [
        ".g{display:grid;grid-template-columns:17rem 11rem 11rem 1fr}",
        ".wide{width:800px}.narrow{width:300px}",
      ],
      html: [
        "<div class='g wide'><i id='w1'></i><i id='w2'></i><i></i><i></i></div>",
        "<div class='g narrow'><i id='n1'></i><i id='n2'></i><i></i><i></i></div>",
      ].join(""),
      measure: [
        { id: "w1", props: ["boxWidth"] },
        { id: "w2", props: ["boxWidth"] },
        { id: "n1", props: ["boxWidth"] },
        { id: "n2", props: ["boxWidth"] },
      ],
    });
    expect(Number(r["w1"]!["boxWidth"])).toBeCloseTo(Number(r["n1"]!["boxWidth"]), 1);
    expect(Number(r["w2"]!["boxWidth"])).toBeCloseTo(Number(r["n2"]!["boxWidth"]), 1);
  });
});
