// NPLAN-A2 — dataFieldTypeOptions registry tests

import {
  dataFieldTypeOptions,
  SELECTABLE_DATA_FIELD_TYPE_COUNT,
} from "../dataFieldTypeOptions";
import { DataFieldType } from "src/lib/dataframe/dataframe";

const t = (key: string) => key;

describe("dataFieldTypeOptions", () => {
  const opts = dataFieldTypeOptions(t);

  test("contains UniqueId", () => {
    expect(opts.map((o) => o.value)).toContain(DataFieldType.UniqueId);
  });

  test("does not contain Unknown", () => {
    expect(opts.map((o) => o.value)).not.toContain(DataFieldType.Unknown);
  });

  test("count matches SELECTABLE_DATA_FIELD_TYPE_COUNT", () => {
    expect(opts.length).toBe(SELECTABLE_DATA_FIELD_TYPE_COUNT);
  });

  test("all entries have non-empty label and value", () => {
    for (const opt of opts) {
      expect(opt.label).toBeTruthy();
      expect(opt.value).toBeTruthy();
    }
  });

  test("no duplicate values", () => {
    const values = opts.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
