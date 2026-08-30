/**
 * #144 — the store is updated before the file is written, so a failed write
 * used to leave every view showing a value that is not in the Markdown.
 *
 * Two cases the cross-model review added on 2026-08-27:
 *   - the note is gone: `DataApi.updateRecord` returned without writing and
 *     without throwing, so the optimistic value survived silently;
 *   - the revert itself must not clobber a newer edit that landed while the
 *     write was in flight.
 */
import { get } from "svelte/store";

import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import type { DataApi } from "src/lib/dataApi";
import { dataFrame } from "src/lib/stores/dataframe";
import type { DataSource } from "src/lib/datasources";
import { ViewApi } from "src/lib/viewApi";

const fields: DataField[] = [
  {
    name: "status",
    type: DataFieldType.String,
    repeated: false,
    derived: false,
    identifier: false,
  },
];

const source = { includes: () => true } as unknown as DataSource;

const seed = (values: Record<string, string>): DataRecord => ({
  id: "Clients/Ivan.md",
  values,
});

function stubApi(over: Partial<DataApi>): DataApi {
  return {
    updateRecord: async () => true,
    ...over,
  } as unknown as DataApi;
}

function currentStatus(): unknown {
  return get(dataFrame).records.find((r) => r.id === "Clients/Ivan.md")?.values["status"];
}

beforeEach(() => {
  dataFrame.set({ fields, records: [seed({ status: "old" })] });
});

describe("#144 optimistic record writes are compensated", () => {
  it("restores the previous value when the write throws", async () => {
    const api = new ViewApi(
      source,
      stubApi({
        updateRecord: async () => {
          throw new Error("EACCES");
        },
      })
    );

    await api.updateRecord(seed({ status: "new" }), fields);

    expect(currentStatus()).toBe("old");
  });

  it("restores the previous value when the note no longer exists", async () => {
    // The silent case: no throw, nothing written, `false` returned.
    const api = new ViewApi(source, stubApi({ updateRecord: async () => false }));

    await api.updateRecord(seed({ status: "new" }), fields);

    expect(currentStatus()).toBe("old");
  });

  it("keeps the new value when the write succeeds", async () => {
    const api = new ViewApi(source, stubApi({ updateRecord: async () => true }));

    await api.updateRecord(seed({ status: "new" }), fields);

    expect(currentStatus()).toBe("new");
  });

  it("does not undo an edit that landed while the write was in flight", async () => {
    // A second edit (or an external Markdown change picked up by the watcher)
    // reaches the store first; reverting to `old` would destroy it.
    const api = new ViewApi(
      source,
      stubApi({
        updateRecord: async () => {
          dataFrame.updateRecord(seed({ status: "newer" }));
          throw new Error("EACCES");
        },
      })
    );

    await api.updateRecord(seed({ status: "new" }), fields);

    expect(currentStatus()).toBe("newer");
  });
});

// #163 — the batch path (Board drag-and-drop) had the same hole as the single
// one: store first, write after, no catch. Found by CV-3 during the full
// project re-verification, 2026-08-28.
describe("#163 batch writes are compensated too", () => {
  it("restores the previous values when the batch write throws", async () => {
    const api = new ViewApi(
      source,
      stubApi({
        updateRecords: async () => {
          throw new Error("EACCES");
        },
      })
    );

    const ok = await api.updateRecords([seed({ status: "new" })], fields);

    expect(ok).toBe(false);
    expect(currentStatus()).toBe("old");
  });

  it("keeps the new values when the batch write succeeds", async () => {
    const api = new ViewApi(source, stubApi({ updateRecords: async () => undefined }));

    const ok = await api.updateRecords([seed({ status: "new" })], fields);

    expect(ok).toBe(true);
    expect(currentStatus()).toBe("new");
  });
});
