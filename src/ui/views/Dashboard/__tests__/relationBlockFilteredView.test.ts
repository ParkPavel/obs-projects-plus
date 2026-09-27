/**
 * Live batch check 2026-09-26: on the studio's «Клиенты» dashboard — a view
 * filtered to type = client — the accepted relation-block suggestion added a
 * block reading this project through `client`. It read the dashboard's frame,
 * which the view had already narrowed to clients, and clients carry no
 * `client` field: picking Helix Labs left the block empty. On a filtered view
 * the block reads its own project whole (as a source), so the records the
 * view hides are there to link to.
 */

import { computeSuggestions } from "../smartSuggest";
import { widgetForSuggestion } from "../suggestionWidgets";
import { narrowsFrame } from "../dashboardFilters";

const projects = [
  { id: "studio", name: "Демо-проект", fieldConfig: { client: { relation: { targetProjectId: "studio" } } } },
];

function suggestedBlock(hostViewFiltered: boolean) {
  const s = computeSuggestions([], [], [], { hostProjectId: "studio", projects, hostViewFiltered })
    .find((x) => x.kind === "relation-block")!;
  return widgetForSuggestion(s, "w-master").initial!;
}

test("on a filtered view the linked block reads this project whole", () => {
  const block = suggestedBlock(true);
  expect(block.sourceConfig?.projectId).toBe("studio");
  expect((block.config as { linkedSelection: { relationField: string } }).linkedSelection.relationField).toBe("client");
});

test("on an unfiltered view it reads the dashboard's frame and stays writable", () => {
  expect(suggestedBlock(false).sourceConfig).toBeUndefined();
});

test("a view filter narrows the frame only through an enabled condition", () => {
  expect(narrowsFrame(undefined)).toBe(false);
  expect(narrowsFrame({ conditions: [] })).toBe(false);
  expect(narrowsFrame({ conditions: [{ enabled: false }] })).toBe(false);
  expect(narrowsFrame({ conditions: [{ enabled: true }] })).toBe(true);
  expect(narrowsFrame({ conditions: [], groups: [{ conditions: [{}] }] })).toBe(true);
});
