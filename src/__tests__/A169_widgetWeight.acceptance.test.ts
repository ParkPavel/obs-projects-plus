/**
 * A169 — acceptance for the visual half of #169, in a browser.
 *
 * The ticket's remaining sentence was "primary action heavier than the cog; the
 * view filter in a permanently visible bar". Both halves are claims about what
 * renders, and jsdom lays out nothing and implements no container queries, so a
 * test there would assert that the test wrote some CSS.
 *
 * Two of the checks below are deliberately NOT browser checks, and each says so
 * where it stands. Reading them as rendered evidence is the exact failure
 * CLAUDE.md names three times: a conclusion stronger than the thing measured.
 */

import { findChrome, renderProbe, svelteStyle, unscope, SRC_ROOT } from "./support/renderProbe";
import * as fs from "fs";
import * as path from "path";

import { restoreDataTableConfig } from "src/ui/views/Dashboard/widgets/legacyMigration";

const chrome = findChrome();
const describeIfChrome = chrome ? describe : describe.skip;

if (!chrome) {
  console.warn("A169 weight: no Chrome found (set CHROME_PATH) — the visual acceptance did NOT run.");
}

const source = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

/**
 * The host variables a theme supplies.
 *
 * Without them `background: var(--interactive-accent)` is an invalid
 * declaration that computes to `transparent` — which is exactly the value the
 * fill test is trying to tell apart from the cog's, so the test would pass by
 * accident on a page where nothing was painted at all.
 */
const THEME = [
  ":root{",
  "--interactive-accent:#5b3cc4;--interactive-accent-hover:#6d4ce0;--text-on-accent:#ffffff;",
  "--radius-s:4px;--radius-m:8px;--font-ui-smaller:12px;--font-ui-small:13px;",
  "--text-faint:#888888;--text-muted:#aaaaaa;--text-normal:#222222;",
  "--background-primary:#ffffff;--background-secondary:#f4f4f4;",
  "--background-modifier-border:#dddddd;--background-modifier-hover:#eeeeee;",
  "}",
].join("");

const primaryStyle = unscope(svelteStyle("ui/views/Dashboard/widgets/WidgetPrimaryAction.svelte"));
const actionsStyle = unscope(svelteStyle("ui/views/Dashboard/widgets/WidgetHeaderActions.svelte"));
const shellStyle = unscope(svelteStyle("ui/views/Dashboard/widgets/WidgetShell.svelte"));

/** A widget header carrying the primary button beside the existing cluster. */
const HEADER = [
  "<div class='ppp-widget-host' id='host'>",
  "  <div class='ppp-widget-header'>",
  "    <span class='ppp-widget-title'>Clients</span>",
  "    <button class='ppp-widget-primary-btn' id='primary'>",
  "      <span class='ppp-widget-primary-label' id='primary-label'>Add record</span>",
  "    </button>",
  "    <button class='ppp-widget-settings-btn' id='cog'>c</button>",
  "    <button class='ppp-widget-menu-btn' id='menu'>m</button>",
  "    <button class='ppp-widget-remove-btn' id='remove'>x</button>",
  "  </div>",
  "</div>",
].join("\n");

const header = (widthPx: number) =>
  renderProbe({
    css: [THEME, shellStyle, actionsStyle, primaryStyle, `.ppp-widget-host{width:${widthPx}px}`],
    html: HEADER,
    measure: [
      { id: "primary", props: ["visibility", "opacity", "background-color"] },
      { id: "primary-label", props: ["display"] },
      { id: "cog", props: ["visibility", "background-color"] },
      { id: "menu", props: ["visibility"] },
      { id: "remove", props: ["visibility"] },
    ],
  });

describeIfChrome("A169 — the block's own action outweighs its settings", () => {
  it("is visible at rest, while the settings cluster beside it is not", () => {
    // "A primary action you must hover to discover is not primary" — the whole
    // point, and the one thing that separates it from its four neighbours.
    const r = header(800);
    expect(r["primary"]!["visibility"]).toBe("visible");
    expect(r["primary"]!["opacity"]).toBe("1");
    expect(r["cog"]!["visibility"]).toBe("hidden");
    expect(r["remove"]!["visibility"]).toBe("hidden");
  });

  it("carries a fill where the icon buttons carry none", () => {
    // Weight through paint, not through size: the header's min-height is
    // already declared once in WidgetShell and must not gain a second source.
    const r = header(800);
    expect(r["cog"]!["background-color"]).toBe("rgba(0, 0, 0, 0)");
    expect(r["primary"]!["background-color"]).not.toBe("rgba(0, 0, 0, 0)");
    expect(r["primary"]!["background-color"]).toBe("rgb(91, 60, 196)");
  });

  it("leaves the keyboard entry point exactly where #169 put it", () => {
    // Regression guard on the half of this ticket that already merged: the
    // always-visible menu button is the keyboard path to every widget action,
    // and this spec was not allowed to re-break it.
    expect(header(800)["menu"]!["visibility"]).toBe("visible");
  });

  it("drops its label when the WIDGET is narrow, not when the window is", () => {
    // Two renders, identical markup, one viewport. The only thing that differs
    // is the width of `.ppp-widget-host`, so a pass can only come from the
    // `@container` rule. WidgetShell's style must be loaded for this to mean
    // anything — it is what declares `container-name: widget` — and if it were
    // missing the query would never match and the test would silently be about
    // nothing at all.
    expect(shellStyle).toContain("container-name: widget");
    expect(header(800)["primary-label"]!["display"]).not.toBe("none");
    expect(header(280)["primary-label"]!["display"]).toBe("none");
  });

  it("keeps its fill when it collapses to an icon", () => {
    // Collapsing must cost the label and nothing else; a narrow widget that
    // also loses the weight would take the ticket back to where it started.
    const narrow = header(280);
    expect(narrow["primary"]!["visibility"]).toBe("visible");
    expect(narrow["primary"]!["background-color"]).toBe("rgb(91, 60, 196)");
  });
});

describeIfChrome("A169 — the filter bar yields to a narrow widget, in its units", () => {
  const barStyle = unscope(svelteStyle("ui/views/Dashboard/widgets/DatabaseCall/TableControlBar.svelte"));

  const bar = (widthPx: number) =>
    renderProbe({
      css: [THEME, shellStyle, barStyle, `.ppp-widget-host{width:${widthPx}px}`],
      html: [
        "<div class='ppp-widget-host'>",
        "  <div class='ppp-t2-controlbar'>",
        "    <span class='ppp-t2-cb-pill'>",
        "      <span class='ppp-t2-cb-pill-label' id='label'>Status is Active</span>",
        "    </span>",
        "    <input class='ppp-t2-cb-search' id='search' />",
        "  </div>",
        "</div>",
      ].join("\n"),
      measure: [
        { id: "label", props: ["max-width"] },
        { id: "search", props: ["max-width"] },
      ],
    });

  it("caps the pill label by a share of the WIDGET once the widget is narrow", () => {
    // The wide case is the shipped `8rem`, root-anchored: 128px at the probe's
    // 16px root, and identical whatever the widget's width. The narrow case is
    // 40% of the widget's inline size, so it MOVES with the widget — which is
    // the whole difference the matryoshka principle is about, and it cannot be
    // produced by a viewport query since both renders share one viewport.
    expect(bar(800)["label"]!["max-width"]).toBe("128px");
    expect(bar(280)["label"]!["max-width"]).toBe("112px");
    expect(bar(200)["label"]!["max-width"]).toBe("80px");
  });

  it("keeps the label readable rather than hiding it", () => {
    // The design spec asked for icon-only below the threshold. It is not built
    // that way on purpose: a pill with no text says only that SOME filter is
    // on, and the user cannot tell which. This asserts the decision, so a later
    // reader finds the reason instead of the spec's unimplemented sentence.
    const narrow = bar(200)["label"]!["max-width"];
    expect(narrow).not.toBe("0px");
    expect(barStyle).not.toContain("display: none");
  });

  it("lets the search field give up its own root-anchored cap", () => {
    expect(bar(800)["search"]!["max-width"]).toBe("224px");
    expect(bar(280)["search"]!["max-width"]).not.toBe("224px");
  });
});

describe("A169 — structure, asserted in source because it is a structural claim", () => {
  it("the primary button is not a member of the hover-only cluster", () => {
    // The design spec's "its own element, never inside the hover-only group"
    // is kept by the file layout rather than by a rule: WidgetHeaderActions
    // never names this class, so a later edit cannot fold it into the group
    // by adding one selector to a list.
    expect(actionsStyle).not.toContain("ppp-widget-primary");
    expect(source("ui/views/Dashboard/widgets/WidgetHeaderActions.svelte")).not.toContain(
      "primaryAction"
    );
  });

  it("the hover cluster still reveals on hover — SOURCE-LEVEL, not rendered", () => {
    // Stated plainly: this is a check that a rule exists, not that a browser
    // applied it. `renderProbe` drives the page through `evaluate`, and a
    // synthetic event does not produce `:hover` — only real input does. The
    // at-rest half above IS measured; this half is the honest half of a claim
    // the harness cannot make.
    expect(actionsStyle).toContain(".ppp-widget-host:hover .ppp-widget-settings-btn");
    expect(actionsStyle).toContain("visibility: visible");
  });
});

describe("A169 — the filter bar half was already shipped, and this is why", () => {
  /**
   * The ticket and the design spec both read `data-table` as the twin that
   * never got the bar. It is not: `data-table` renders THROUGH
   * `DatabaseCallBlock`, and that block mounts `BlockFilterBar` in the branch
   * it reaches whenever it has at least one view tab. Adding a second bar
   * would have given the block two filter surfaces, which is the parallel
   * implementation this project keeps catching.
   *
   * Proven from two independent directions, because either alone is a story.
   */
  it("a data-table is always handed exactly one table tab", () => {
    const built = restoreDataTableConfig({}, {});
    const tabs = built["viewTabs"] as Array<{ viewType: string }>;
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.viewType).toBe("table");
    // …so the block's only gate on the bar, `tabs.length === 0`, is never met.
    expect(tabs.length === 0).toBe(false);
  });

  it("and the bar is mounted past that gate, unconditionally", () => {
    const block = source("ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte");
    const gate = block.indexOf("{:else if tabs.length === 0}");
    const bar = block.indexOf("<BlockFilterBar");
    expect(gate).toBeGreaterThan(-1);
    // The mount stands AFTER the empty-tabs branch, i.e. in the `{:else}` every
    // data-table lands in. Position is the whole claim, so it is the assertion.
    expect(bar).toBeGreaterThan(gate);
    // And nothing narrows it further once that branch is entered: between the
    // `{:else}` itself and the bar there is no further condition, so reaching
    // the branch is reaching the bar. (Slicing from the gate instead would span
    // the empty-state body, which has an `{#if !readonly}` of its own.)
    const branch = block.indexOf("{:else}", gate);
    expect(branch).toBeLessThan(bar);
    expect(block.slice(branch, bar)).not.toContain("{#if");
  });
});

describe("A169 — the collapsed-widget wiring, SOURCE-LEVEL by admission", () => {
  // What a collapsed click actually DOES is exercised for real, on a mounted
  // component, in `DatabaseCall/__tests__/tableNewRowSignal.test.ts` — the
  // adversarial review of #169 was right that searching source text for
  // statement order is a claim about how code is written, not about a click.
  // What survives here is only the half that lives in a file no unit test
  // mounts, and it says so in its own name.
  it("the host expands before it raises the signal", () => {
    // A collapsed widget still renders its header, so the button is there while
    // the content that owns the action is not mounted at all. The order matters
    // and it is one line, so it is asserted where it can be read.
    const host = source("ui/views/Dashboard/widgets/WidgetHost.svelte");
    const expand = host.indexOf("if (collapsed) patchWidget({ collapsed: false })");
    const raise = host.indexOf("primaryActionSignal += 1");
    expect(expand).toBeGreaterThan(-1);
    expect(raise).toBeGreaterThan(expand);
  });

  it("and the signal is spent, so expanding later cannot replay it", () => {
    // Both receivers compare against a counter that starts at zero, which is
    // what lets a value that arrived at mount time count as a press. That only
    // stays correct because the host clears the signal on every collapse
    // toggle — without this line, collapsing and reopening a widget would pop
    // the new-row input by itself.
    expect(source("ui/views/Dashboard/widgets/WidgetHost.svelte")).toContain(
      "primaryActionSignal = 0; patchWidget({ collapsed: !collapsed })"
    );
    expect(source("ui/views/Dashboard/widgets/DatabaseCall/TableNewRow.svelte")).toContain(
      "let seenOpenSignal = 0;"
    );
  });
});
