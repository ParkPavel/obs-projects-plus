/** Real component markup/source CSS in Chrome: bounded header geometry, not Obsidian/device acceptance. */
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { describeWithChrome, renderProbe, svelteStyle, unscope } from "./support/renderProbe";

const DatabaseCallBlock = require("src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte").default;
const css = [
  "ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte", "ui/views/Dashboard/widgets/DatabaseCall/TableControlBar.svelte",
  "ui/views/Dashboard/widgets/DatabaseCall/TableSearch.svelte", "ui/views/Dashboard/widgets/DatabaseCall/BlockFilterBar.svelte",
  "ui/views/Dashboard/widgets/ViewTabBar.svelte", "ui/components/fields/SearchField.svelte",
].map(file => unscope(svelteStyle(file)));
const bounds = ["boxLeft", "boxRight", "boxTop", "boxBottom", "boxHeight"];
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);

describeWithChrome("N06 actual header markup inside a narrow/scaled widget", () => {
  test.each([{ width: 260, scale: 1, opened: false }, { width: 520, scale: 0.55, opened: false }, { width: 260, scale: 0.55, opened: true }])("width$width scale$scale opened$opened", async ({ width, scale, opened }) => {
    const field = { name: "name", type: DataFieldType.String, identifier: true, repeated: false, derived: false, typeConfig: {} };
    const frame = { fields: [field], records: [{ id: "Alpha.md", values: { name: "Alpha" } }] };
    const config = { activeTabId: "t", viewTabs: [{ id: "t", viewType: "table", label: "Long table name", config: {} }], subFilter: { conjunction: "and", conditions: [{ field: "name", operator: "is-not-empty", enabled: true }] } };
    const view = render(DatabaseCallBlock, { props: { frame, fields: [field], api: {}, readonly: true, getRecordColor: () => null, config } }); await flush();
    const host = document.createElement("div"); host.className = "ppp-widget-host"; host.id = "host";
    view.container.before(host); host.append(view.container);
    const head = view.container.querySelector<HTMLElement>(".ppp-dbc-head")!, tools = head.querySelector<HTMLElement>(".ppp-t2-controlbar")!;
    head.id = "head"; tools.id = "tools";
    const search = tools.querySelector<HTMLButtonElement>(".ppp-t2-cb-btn")!; search.id = "search";
    head.querySelector<HTMLElement>(".ppp-view-tab-bar")!.id = "tabs"; head.querySelector<HTMLElement>(".ppp-blockfilter-button")!.id = "filter";
    if (opened) { search.click(); await flush(); tools.querySelector<HTMLInputElement>("input")!.id = "query"; }
    const ids = ["host", "head", "tools", "tabs", "filter", "search", ...(opened ? ["query"] : [])];
    const result = renderProbe({ css: [...css, `:root{--font-ui-smaller:12px;--ppp-touch-target-min:44px;--ppp-border-width:1px} body{margin:0} button,input{box-sizing:border-box} .ppp-widget-host{width:${width}px;transform:scale(${scale});transform-origin:top left}`], html: host.outerHTML, measure: ids.map(id => ({ id, props: bounds })) });
    const number = (id: string, prop: string) => Number(result[id]![prop]);
    for (const id of ids.filter(id => id !== "host")) {
      expect(number(id, "boxLeft")).toBeGreaterThanOrEqual(number("host", "boxLeft") - 1);
      expect(number(id, "boxRight")).toBeLessThanOrEqual(number("host", "boxRight") + 1);
    }
    if (!opened) expect(number("head", "boxHeight")).toBeLessThanOrEqual(Math.max(...["tools", "tabs", "filter"].map(id => number(id, "boxHeight"))) + 2);
    else expect(number("query", "boxRight")).toBeLessThanOrEqual(number("search", "boxLeft") + 1);
    host.remove();
  });
});
