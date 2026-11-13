import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
const { DataFieldType } = require("src/lib/dataframe/dataframe");
import RelationPickerPopover from "../RelationPickerPopover.svelte";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? "" }) };
});
const field = (targetProjectId: string, repeated = true): DataField => ({ name: "links", type: DataFieldType.Relation, repeated, derived: false, identifier: false, typeConfig: { relation: { targetProjectId } } } as DataField);
const frame: DataFrame = { fields: [], records: [] };
const target = (...ids: string[]): DataFrame => ({ fields: [], records: ids.map(id => ({ id, values: {} })) });
const settle = async () => { await tick(); await tick(); await tick(); };

it("retains the original aliased container when Done changes nothing", async () => {
  const value = ["[[A/Note|Alias]]", "[[B/Note]]"];
  const view = render(RelationPickerPopover, { props: { field: field("target"), value, frame, api: { resolveExternalFrame: async () => target("A/Note.md", "B/Note.md") } as never } });
  const commit = jest.fn(); view.component.$on("commit", event => commit(event.detail));
  try {
    await settle();
    document.querySelector<HTMLButtonElement>(".ppp-rel-picker-done")!.click();
    expect(commit).toHaveBeenCalledWith(value);
    expect(commit.mock.calls[0]![0]).toBe(value);
  } finally { view.unmount(); }
});

it("discarded target loads cannot replace a new source's candidates", async () => {
  let oldResolve!: (frame: DataFrame) => void;
  const old = new Promise<DataFrame>(resolve => { oldResolve = resolve; });
  const resolver = jest.fn((id: string) => id === "old" ? old : Promise.resolve(target("New/Record.md")));
  const view = render(RelationPickerPopover, { props: { field: field("old"), value: [], frame, api: { resolveExternalFrame: resolver } as never } });
  try {
    await settle(); view.component.$set({ field: field("new") }); await settle();
    expect(resolver).toHaveBeenCalledWith("new");
    expect(document.querySelector(".ppp-rel-picker-list")).toHaveTextContent("New/Record");
    oldResolve(target("Old/Record.md")); await settle();
    expect(document.querySelector(".ppp-rel-picker-list")).not.toHaveTextContent("Old/Record");
  } finally { view.unmount(); }
});

it("lets the user explicitly remove an unresolved old link without choosing an ambiguous namesake", async () => {
  const view = render(RelationPickerPopover, { props: { field: field("target"), value: ["[[Note|Alias]]"], frame, api: { resolveExternalFrame: async () => target("A/Note.md", "B/Note.md") } as never } });
  const commit = jest.fn(); view.component.$on("commit", event => commit(event.detail));
  try {
    await settle();
    expect(document.querySelectorAll('.ppp-rel-picker-item[aria-selected="true"]')).toHaveLength(0);
    document.querySelector<HTMLButtonElement>('[data-relation-selected="Note"] button')!.click();
    await settle();
    document.querySelector<HTMLButtonElement>(".ppp-rel-picker-done")!.click();
    expect(commit).toHaveBeenCalledWith([]);
  } finally { view.unmount(); }
});

it("adding a canonical target keeps the alias of an existing uniquely resolved link", async () => {
  const view = render(RelationPickerPopover, { props: { field: field("target"), value: ["[[Note|Alias]]"], frame, api: { resolveExternalFrame: async () => target("A/Note.md", "B/Other.md") } as never } });
  const commit = jest.fn(); view.component.$on("commit", event => commit(event.detail));
  try {
    await settle();
    expect(document.querySelector('.ppp-rel-picker-item[title="A/Note"]')).toHaveAttribute("aria-selected", "true");
    document.querySelector<HTMLButtonElement>('.ppp-rel-picker-item[title="B/Other"]')!.click();
    await settle();
    document.querySelector<HTMLButtonElement>(".ppp-rel-picker-done")!.click();
    expect(commit).toHaveBeenCalledWith(["[[Note|Alias]]", "[[B/Other]]"]);
  } finally { view.unmount(); }
});

it("choosing the current single relation preserves its original alias and spelling", async () => {
  const value = "[[Note|Alias]]";
  const view = render(RelationPickerPopover, { props: { field: field("target", false), value, frame, api: { resolveExternalFrame: async () => target("A/Note.md") } as never } });
  const commit = jest.fn(); view.component.$on("commit", event => commit(event.detail));
  try {
    await settle();
    document.querySelector<HTMLButtonElement>('.ppp-rel-picker-item[title="A/Note"]')!.click();
    expect(commit).toHaveBeenCalledWith(value);
  } finally { view.unmount(); }
});

it("shows a failed load and retries the same target without offering unrelated historical links", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const resolver = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(target("A/Note.md"));
  const ownFrame: DataFrame = { fields: [], records: [{ id: "current.md", values: { links: "[[Outside]]" } }] };
  const view = render(RelationPickerPopover, { props: { field: field("target"), value: [], frame: ownFrame, api: { resolveExternalFrame: resolver } as never } });
  try {
    await settle();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.querySelectorAll(".ppp-rel-picker-item")).toHaveLength(0);
    document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle();
    expect(resolver.mock.calls).toEqual([["target"], ["target"]]);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.querySelector(".ppp-rel-picker-list")).toHaveTextContent("A/Note");
    expect(document.querySelector(".ppp-rel-picker-list")).not.toHaveTextContent("Outside");
  } finally { view.unmount(); error.mockRestore(); }
});
