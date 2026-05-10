// NPLAN-A1 — applyAutoFields unit tests

import { applyAutoFields } from "./applyAutoFields";
import type { GetFileStat } from "./applyAutoFields";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataFrame } from "src/lib/dataframe/dataframe";

const CTIME = new Date("2026-01-15T08:00:00Z");
const MTIME = new Date("2026-04-01T12:30:00Z");

const STAT = {
  ctime: CTIME.getTime(),
  mtime: MTIME.getTime(),
};

const getStat: GetFileStat = (id) => (id.endsWith(".md") ? STAT : null);

function makeFrame(overrides?: Partial<DataFrame>): DataFrame {
  return {
    fields: [
      {
        name: "name",
        type: DataFieldType.String,
        repeated: false,
        identifier: true,
        derived: false,
      },
    ],
    records: [
      { id: "notes/alpha.md", values: { name: "Alpha" } },
      { id: "notes/beta.md", values: { name: "Beta" } },
    ],
    ...overrides,
  };
}

describe("applyAutoFields (NPLAN-A1)", () => {
  test("returns same reference when no AutoTime fields present", () => {
    const frame = makeFrame();
    expect(applyAutoFields(frame, getStat)).toBe(frame);
  });

  test("fills created_time from ctime when autoTime='created'", () => {
    const frame = makeFrame({
      fields: [
        ...makeFrame().fields,
        {
          name: "pp_created_time",
          type: DataFieldType.AutoTime,
          repeated: false,
          identifier: false,
          derived: true,
          typeConfig: { autoTime: "created" },
        },
      ],
    });
    const result = applyAutoFields(frame, getStat);
    expect(result.records[0]?.values["pp_created_time"]).toEqual(CTIME);
    expect(result.records[1]?.values["pp_created_time"]).toEqual(CTIME);
  });

  test("fills last_edited_time from mtime when autoTime='modified'", () => {
    const frame = makeFrame({
      fields: [
        ...makeFrame().fields,
        {
          name: "pp_last_edited_time",
          type: DataFieldType.AutoTime,
          repeated: false,
          identifier: false,
          derived: true,
          typeConfig: { autoTime: "modified" },
        },
      ],
    });
    const result = applyAutoFields(frame, getStat);
    expect(result.records[0]?.values["pp_last_edited_time"]).toEqual(MTIME);
  });

  test("defaults to mtime when autoTime key is absent", () => {
    const frame = makeFrame({
      fields: [
        ...makeFrame().fields,
        {
          name: "pp_last_edited_time",
          type: DataFieldType.AutoTime,
          repeated: false,
          identifier: false,
          derived: true,
        },
      ],
    });
    const result = applyAutoFields(frame, getStat);
    expect(result.records[0]?.values["pp_last_edited_time"]).toEqual(MTIME);
  });

  test("datasource-filled value wins (existing value not overwritten)", () => {
    const existing = new Date("2025-12-01T00:00:00Z");
    const frame = makeFrame({
      fields: [
        ...makeFrame().fields,
        {
          name: "pp_created_time",
          type: DataFieldType.AutoTime,
          repeated: false,
          identifier: false,
          derived: true,
          typeConfig: { autoTime: "created" },
        },
      ],
      records: [
        {
          id: "notes/alpha.md",
          values: { name: "Alpha", pp_created_time: existing },
        },
      ],
    });
    const result = applyAutoFields(frame, getStat);
    expect(result.records[0]?.values["pp_created_time"]).toEqual(existing);
    expect(result).toBe(frame);
  });

  test("skips records with no matching file stat (returns null)", () => {
    const frame = makeFrame({
      fields: [
        ...makeFrame().fields,
        {
          name: "pp_created_time",
          type: DataFieldType.AutoTime,
          repeated: false,
          identifier: false,
          derived: true,
          typeConfig: { autoTime: "created" },
        },
      ],
      records: [{ id: "virtual://task-1", values: { name: "Virtual" } }],
    });
    const result = applyAutoFields(frame, getStat);
    expect(result.records[0]?.values["pp_created_time"]).toBeUndefined();
    expect(result).toBe(frame);
  });

  test("skips stat with ctime=0 (file system does not expose stat)", () => {
    const frame = makeFrame({
      fields: [
        ...makeFrame().fields,
        {
          name: "pp_created_time",
          type: DataFieldType.AutoTime,
          repeated: false,
          identifier: false,
          derived: true,
          typeConfig: { autoTime: "created" },
        },
      ],
    });
    const zeroStat: GetFileStat = () => ({ ctime: 0, mtime: 0 });
    const result = applyAutoFields(frame, zeroStat);
    expect(result.records[0]?.values["pp_created_time"]).toBeUndefined();
    expect(result).toBe(frame);
  });

  test("pure — original frame untouched after fill", () => {
    const frame = makeFrame({
      fields: [
        ...makeFrame().fields,
        {
          name: "pp_created_time",
          type: DataFieldType.AutoTime,
          repeated: false,
          identifier: false,
          derived: true,
          typeConfig: { autoTime: "created" },
        },
      ],
    });
    const orig0values = { ...frame.records[0]!.values };
    applyAutoFields(frame, getStat);
    expect(frame.records[0]!.values).toEqual(orig0values);
  });
});
