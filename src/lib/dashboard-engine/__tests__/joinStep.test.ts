// JoinStep executor tests — Pillar 5 (cross-type correlation).
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import type {
  JoinStep,
  TransformContext,
  TransformPipeline,
} from "src/lib/dashboard-engine/transformTypes";

function mkFrame(
  fields: Array<[string, DataFieldType]>,
  rows: Array<Record<string, unknown>>
): DataFrame {
  return {
    fields: fields.map(([name, type]) => ({
      name,
      type,
      repeated: false,
      identifier: name === "id",
      derived: false,
    })),
    records: rows.map((r, i) => ({
      id: String(r["id"] ?? `row-${i}`),
      values: r as Record<string, never>,
    })) as unknown as DataFrame["records"],
  };
}

function runJoin(
  left: DataFrame,
  right: DataFrame,
  step: JoinStep
) {
  const pipeline: TransformPipeline = { steps: [step] };
  const context: TransformContext = {
    rightFrames: new Map([[step.rightSourceId, right]]),
  };
  return executeTransform(left, pipeline, context);
}

describe("executeJoin", () => {
  const workouts = mkFrame(
    [
      ["id", DataFieldType.String],
      ["date", DataFieldType.Date],
      ["weight", DataFieldType.Number],
    ],
    [
      { id: "w1", date: new Date(2026, 3, 1), weight: 80 },
      { id: "w2", date: new Date(2026, 3, 2), weight: 82 },
      { id: "w3", date: new Date(2026, 3, 3), weight: 85 }, // no match on right
    ]
  );

  const nutrition = mkFrame(
    [
      ["id", DataFieldType.String],
      ["date", DataFieldType.Date],
      ["calories", DataFieldType.Number],
    ],
    [
      { id: "n1", date: new Date(2026, 3, 1), calories: 2200 },
      { id: "n2", date: new Date(2026, 3, 2), calories: 2400 },
      { id: "n3", date: new Date(2026, 3, 2), calories: 2100 }, // duplicate right on 04-02
    ]
  );

  it("inner join drops left rows without matches", () => {
    const step: JoinStep = {
      type: "join",
      rightSourceId: "nutrition",
      on: { leftKey: "date", rightKey: "date" },
      how: "inner",
    };
    const { data, meta } = runJoin(workouts, nutrition, step);

    // w3 has no match → dropped. w2 has two matches → cartesian 2 rows.
    expect(data.records).toHaveLength(3);
    expect(data.records.map((r) => r.values["weight"])).toEqual([80, 82, 82]);
    expect(data.records.map((r) => r.values["calories"])).toEqual([2200, 2400, 2100]);
    expect(meta.warnings).toEqual([]);
  });

  it("left join keeps unmatched left rows with null right fields", () => {
    const step: JoinStep = {
      type: "join",
      rightSourceId: "nutrition",
      on: { leftKey: "date", rightKey: "date" },
      how: "left",
    };
    const { data } = runJoin(workouts, nutrition, step);

    // 1 (w1) + 2 (w2 cartesian) + 1 (w3 null) = 4 rows.
    expect(data.records).toHaveLength(4);
    const w3 = data.records.find((r) => r.values["weight"] === 85);
    expect(w3).toBeDefined();
    expect(w3?.values["calories"]).toBeNull();
  });

  it("aggregation reduces multiple right matches into one merged row", () => {
    const step: JoinStep = {
      type: "join",
      rightSourceId: "nutrition",
      on: { leftKey: "date", rightKey: "date" },
      how: "inner",
      aggregation: "AVG",
    };
    const { data } = runJoin(workouts, nutrition, step);

    // w2 collapses 2400 + 2100 → 2250 (AVG).
    expect(data.records).toHaveLength(2);
    const w2 = data.records.find((r) => r.values["weight"] === 82);
    expect(w2?.values["calories"]).toBe(2250);
  });

  it("suffixes colliding right field names", () => {
    const leftNotes = mkFrame(
      [["id", DataFieldType.String], ["date", DataFieldType.Date], ["note", DataFieldType.String]],
      [{ id: "l1", date: new Date(2026, 3, 1), note: "left-note" }]
    );
    const rightNotes = mkFrame(
      [["id", DataFieldType.String], ["date", DataFieldType.Date], ["note", DataFieldType.String]],
      [{ id: "r1", date: new Date(2026, 3, 1), note: "right-note" }]
    );
    const step: JoinStep = {
      type: "join",
      rightSourceId: "right",
      on: { leftKey: "date", rightKey: "date" },
      how: "inner",
    };
    const { data } = runJoin(leftNotes, rightNotes, step);
    expect(data.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["note", "note__r"])
    );
    expect(data.records[0]?.values["note"]).toBe("left-note");
    expect(data.records[0]?.values["note__r"]).toBe("right-note");
  });

  it("emits warning and passes-through when right frame is not resolved", () => {
    const step: JoinStep = {
      type: "join",
      rightSourceId: "missing",
      on: { leftKey: "date", rightKey: "date" },
      how: "inner",
    };
    const pipeline: TransformPipeline = { steps: [step] };
    const { data, meta } = executeTransform(workouts, pipeline, { rightFrames: new Map() });
    expect(data.records).toHaveLength(workouts.records.length);
    expect(meta.warnings.some((w) => w.includes("not resolved"))).toBe(true);
  });

  it("emits warning when leftKey is missing", () => {
    const step: JoinStep = {
      type: "join",
      rightSourceId: "nutrition",
      on: { leftKey: "nope", rightKey: "date" },
      how: "inner",
    };
    const { data, meta } = runJoin(workouts, nutrition, step);
    expect(data).toEqual(workouts);
    expect(meta.warnings.some((w) => w.includes("leftKey 'nope'"))).toBe(true);
  });

  it("normalises date keys to day granularity", () => {
    const workoutsWithTime = mkFrame(
      [["id", DataFieldType.String], ["date", DataFieldType.Date], ["weight", DataFieldType.Number]],
      [
        { id: "w1", date: new Date(2026, 3, 1, 8, 30), weight: 80 },
        { id: "w2", date: new Date(2026, 3, 1, 20, 0), weight: 81 },
      ]
    );
    const nutritionDay = mkFrame(
      [["id", DataFieldType.String], ["date", DataFieldType.Date], ["calories", DataFieldType.Number]],
      [{ id: "n1", date: new Date(2026, 3, 1, 0, 0), calories: 2000 }]
    );
    const step: JoinStep = {
      type: "join",
      rightSourceId: "nutrition",
      on: { leftKey: "date", rightKey: "date" },
      how: "inner",
    };
    const { data } = runJoin(workoutsWithTime, nutritionDay, step);
    expect(data.records).toHaveLength(2);
    expect(data.records.every((r) => r.values["calories"] === 2000)).toBe(true);
  });
});
