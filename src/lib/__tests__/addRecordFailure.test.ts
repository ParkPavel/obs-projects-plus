/**
 * stab-dup (Codex audit) — ViewApi.addRecord hands back the note creation, so
 * a caller that awaits it (the calendar duplicate) sees a failed create
 * instead of reporting a copy that does not exist.
 */
import { ViewApi } from "src/lib/viewApi";
import type { DataApi } from "src/lib/dataApi";
import type { DataSource } from "src/lib/datasources";

describe("ViewApi.addRecord", () => {
  it("rejects when the note cannot be created", async () => {
    const dataApi = { createNote: jest.fn().mockRejectedValue(new Error("vault refused")) } as unknown as DataApi;
    const api = new ViewApi({ includes: () => false } as unknown as DataSource, dataApi);
    await expect(api.addRecord({ id: "x.md", values: {} }, [], "")).rejects.toThrow("vault refused");
  });

  it("resolves once the note is created", async () => {
    const dataApi = { createNote: jest.fn().mockResolvedValue(undefined) } as unknown as DataApi;
    const api = new ViewApi({ includes: () => false } as unknown as DataSource, dataApi);
    await expect(api.addRecord({ id: "x.md", values: {} }, [], "")).resolves.toBeUndefined();
  });
});
