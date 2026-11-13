import "@testing-library/jest-dom";
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";

const DatabaseCallBlock = require("../DatabaseCallBlock.svelte").default;
const DataTableContent = require("../DataTableContent.svelte").default;
const field = { name: "name", type: DataFieldType.String, identifier: true, repeated: false, derived: false, typeConfig: {} };
const frame = { fields: [field], records: ["Alpha", "Beta"].map(name => ({ id: `${name}.md`, values: { name } })) };
const props = { frame, fields: [field], api: {}, readonly: true, getRecordColor: () => null };
const config = { activeTabId: "first", viewTabs: ["first", "second"].map(id => ({ id, viewType: "table", label: id, config: {} })) };
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);

function header(root: HTMLElement) { const result = root.querySelector<HTMLElement>(".ppp-dbc-head .ppp-t2-controlbar"); expect(result).not.toBeNull(); return result!; }
async function search(root: HTMLElement, query: string) {
  const toolbar = header(root); toolbar.querySelector<HTMLButtonElement>(".ppp-t2-cb-btn")!.click(); await flush();
  const input = toolbar.querySelector<HTMLInputElement>("input")!; input.value = query; input.dispatchEvent(new Event("input", { bubbles: true })); await flush(); return input;
}

test("the block header owns one original toolbar whose query filters only its table and survives a frame refresh", async () => {
  const first = render(DatabaseCallBlock, { props: { ...props, config } }), second = render(DatabaseCallBlock, { props: { ...props, config } }); await flush();
  expect(first.container.querySelectorAll(".ppp-t2-controlbar")).toHaveLength(1);
  const input = await search(first.container, "Al"); input.setSelectionRange(1, 2);
  expect(first.container.querySelector(".ppp-dt-content > .ppp-t2-controlbar")).toBeNull();
  expect(first.container.querySelectorAll(".ppp-t2-row")).toHaveLength(1); expect(second.container.querySelectorAll(".ppp-t2-row")).toHaveLength(2);
  first.component.$set({ frame: { ...frame, records: [...frame.records] } }); await flush();
  expect(header(first.container).querySelector("input")).toBe(input); expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([1, 2]); expect(input.value).toBe("Al");
});

test("switching a table tab retires its query and toolbar, and unmount removes its moved controls", async () => {
  const view = render(DatabaseCallBlock, { props: { ...props, config } }); await flush();
  view.component.$on("configChange", (e: CustomEvent<typeof config>) => view.component.$set({ config: e.detail }));
  const input = await search(view.container, "Al"), oldToolbar = header(view.container);
  const tabs = view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'); tabs[1]!.click(); await flush();
  expect(oldToolbar.isConnected).toBe(false); expect(input.isConnected).toBe(false);
  expect(view.container.querySelectorAll(".ppp-t2-controlbar")).toHaveLength(1); expect(header(view.container).querySelector("input")).toBeNull();
  expect(view.container.querySelectorAll(".ppp-t2-row")).toHaveLength(2);
  const toolbar = header(view.container); view.unmount(); await flush(); expect(toolbar.isConnected).toBe(false);
});

test("standalone tables retain their original local toolbar", async () => {
  const view = render(DataTableContent, { props: { ...props, config: undefined } }); await flush(); expect(view.container.querySelector(".ppp-dt-content > .ppp-t2-controlbar")).not.toBeNull();
});

test("controls and their focused original input stay in the block's secondary document", async () => {
  const iframe = document.createElement("iframe"); document.body.appendChild(iframe);
  const doc = iframe.contentDocument!, target = doc.createElement("div"); doc.body.appendChild(target);
  const view = render(DatabaseCallBlock, { target, props: { ...props, config } });
  try { await flush(); const input = await search(target, "Al"); expect(header(target).ownerDocument).toBe(doc); expect(input.ownerDocument).toBe(doc); expect(doc.activeElement).toBe(input); }
  finally { view.unmount(); iframe.remove(); }
});
