import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import { get } from "svelte/store";
import { createRelationCandidates, loadRelationCandidates } from "../relationCandidates";

const field: DataField = { name: "links", type: DataFieldType.Relation, repeated: true, derived: false, identifier: false, typeConfig: { relation: { targetProjectId: "target" } } } as DataField;
const frame: DataFrame = { fields: [field], records: [{ id: "current.md", values: { links: ["[[Outside]]"] } }] };
const target = (...ids: string[]): DataFrame => ({ fields: [], records: ids.map(id => ({ id, values: {} })) });

it("preserves full paths for notes sharing a basename, with exact duplicate paths offered once", async () => {
  const api = { resolveExternalFrame: jest.fn().mockResolvedValue(target("Clients/Note.md", "Archive/Note.md", "Clients/Note.md", "Root.md")) } as unknown as ViewApi;
  expect(await loadRelationCandidates(field, api, frame)).toEqual(["Archive/Note", "Clients/Note", "Root"]);
});
it.each([null, target()])("an explicit empty/missing target does not suggest historical links from the current field", async value => {
  const api = { resolveExternalFrame: jest.fn().mockResolvedValue(value) } as unknown as ViewApi;
  expect(await loadRelationCandidates(field, api, frame)).toEqual([]);
});
it("an unavailable resolver cannot silently replace the target scope", async () => {
  expect(await loadRelationCandidates(field, {} as ViewApi, frame)).toEqual([]);
});
it("reports a rejected target load to the caller instead of hiding it with unrelated candidates", async () => {
  const api = { resolveExternalFrame: jest.fn().mockRejectedValue(new Error("target unavailable")) } as unknown as ViewApi;
  await expect(loadRelationCandidates(field, api, frame)).rejects.toThrow("target unavailable");
});
it("an unconfigured relation can still suggest values of this field in its own frame", async () => {
  expect(await loadRelationCandidates({ ...field, typeConfig: {} }, {} as ViewApi, frame)).toEqual(["Outside"]);
});

it("accepts only a result from the live source, field and frame revision", async () => {
  const source = createRelationCandidates();
  const api = { resolveExternalFrame: async () => target("Folder/Note.md") } as unknown as ViewApi;
  const pending = source.load(field, api, frame);
  expect(source.accepts("Folder/Note", field, api, frame)).toBe(false);
  await pending;
  expect(source.accepts("Folder/Note", field, api, frame)).toBe(true);
  expect(source.accepts("Folder/Note", { ...field, name: "another" }, api, frame)).toBe(false);
  expect(source.accepts("Folder/Note", field, {} as ViewApi, frame)).toBe(false);
  expect(source.accepts("Folder/Note", field, api, { ...frame })).toBe(false);
  source.destroy();
  expect(source.accepts("Folder/Note", field, api, frame)).toBe(false);
});

it("does not publish a pending result or start another load after destruction", async () => {
  let resolve!: (value: DataFrame) => void;
  const api = { resolveExternalFrame: jest.fn(() => new Promise<DataFrame>(done => { resolve = done; })) } as unknown as ViewApi;
  const source = createRelationCandidates();
  const pending = source.load(field, api, frame);
  source.destroy();
  resolve(target("Folder/Note.md"));
  await pending;
  expect(get(source).candidates).toEqual([]);
  await source.load(field, api, frame);
  expect(api.resolveExternalFrame).toHaveBeenCalledTimes(1);
});
