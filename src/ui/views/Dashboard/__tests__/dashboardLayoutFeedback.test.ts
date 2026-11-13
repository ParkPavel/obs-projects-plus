import { tick } from "svelte";
import { reorderWidgets } from "../dashboardReorder";
import { createWidgetReveal } from "../dashboardReveal";
type WidgetDefinition = import("../types").WidgetDefinition;

jest.mock("src/lib/helpers/animation", () => ({ getScrollBehavior: () => "auto" }));
const widget = (id: string, locked = false): WidgetDefinition => ({ id, type: "stats", title: id, config: {}, layout: { x: 0, y: 0, w: 12, h: 4, locked } });

it("pins each locked index without mutating either input", () => {
  const a = widget("a"), b = widget("b", true), c = widget("c"), d = widget("d", true);
  const previous = Object.freeze([a, b, c, d]);
  const proposal = [d, c, b, a];
  expect(reorderWidgets(previous, proposal)).toEqual([c, b, a, d]);
  expect(previous).toEqual([a, b, c, d]); expect(proposal).toEqual([d, c, b, a]);
});

it("rejects duplicate, missing and foreign IDs, but accepts the consider-stage shadow", () => {
  const a = widget("a"), b = widget("b", true), c = widget("c");
  const previous = [a, b, c];
  for (const proposal of [[a, b], [a, a, b], [a, b, widget("foreign")], [c, a, widget("shadow")]]) {
    expect(reorderWidgets(previous, proposal)).toEqual(previous);
  }
  expect(reorderWidgets(previous, [widget("shadow"), b, a], "shadow").map(w => w.id)).toEqual(["shadow", "b", "a"]);
  expect(reorderWidgets([b], [b])).toEqual([b]);
});

it("reveals only the latest requested creation, scoped to its own root", async () => {
  const root = document.createElement("div"); document.body.append(root);
  const foreign = document.createElement("div"); foreign.dataset["widgetId"] = "b"; document.body.append(foreign);
  const nodes = ["a", "b"].map(id => {
    const node = document.createElement("div"); node.dataset["widgetId"] = id; node.tabIndex = 0;
    node.scrollIntoView = jest.fn(); root.append(node); return node;
  });
  const reveal = createWidgetReveal(() => root);
  reveal("a"); reveal("b"); await tick();
  expect(document.activeElement).toBe(nodes[1]);
  expect(nodes[0]!.scrollIntoView).not.toHaveBeenCalled();
  expect(nodes[1]!.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest", behavior: "auto" });
  root.remove(); foreign.remove();
  reveal("a"); await tick(); expect(nodes[0]!.scrollIntoView).not.toHaveBeenCalled();
});
