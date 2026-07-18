// #092: pipeline empty-output recovery round-trip.
//
// Proves the data contract behind DatabaseCallBlock's recovery node:
//   1. a non-empty pipeline can consume input rows yet emit zero,
//      while meta.inputRowCount still reports the rows it saw;
//   2. the `pipelineHidAll` predicate (mirrored from the component) is
//      true in exactly that dead-end and false otherwise;
//   3. clearing the pipeline (steps: []) restores every row.

import { executeTransform } from "./transformExecutor";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { TransformPipeline } from "./transformTypes";

function makeFrame(): DataFrame {
  return {
    fields: [
      { name: "id", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
      { name: "status", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "1", values: { id: "1", status: "done" } },
      { id: "2", values: { id: "2", status: "done" } },
      { id: "3", values: { id: "3", status: "done" } },
    ],
  };
}

// Mirror of DatabaseCallBlock's $: pipelineHidAll predicate.
function pipelineHidAll(args: {
  stepCount: number;
  inputRowCount: number;
  outputRowCount: number;
  isFilterEmpty: boolean;
}): boolean {
  return (
    args.stepCount > 0 &&
    args.inputRowCount > 0 &&
    args.outputRowCount === 0 &&
    !args.isFilterEmpty
  );
}

const emptyingPipeline: TransformPipeline = {
  steps: [
    {
      type: "filter",
      conditions: {
        conjunction: "and",
        conditions: [{ field: "status", operator: "is", value: "archived", enabled: true }],
      },
    },
  ],
};

describe("#092 pipeline empty-output recovery", () => {
  it("reports inputRowCount even when the pipeline emits zero rows", () => {
    const frame = makeFrame();
    const result = executeTransform(frame, emptyingPipeline);

    expect(result.data.records).toHaveLength(0);
    expect(result.meta.inputRowCount).toBe(3);
    expect(result.meta.outputRowCount).toBe(0);
  });

  it("flags pipelineHidAll only for the pipeline dead-end", () => {
    const frame = makeFrame();
    const result = executeTransform(frame, emptyingPipeline);

    expect(
      pipelineHidAll({
        stepCount: emptyingPipeline.steps.length,
        inputRowCount: result.meta.inputRowCount,
        outputRowCount: result.data.records.length,
        isFilterEmpty: false,
      })
    ).toBe(true);

    // No steps → not a pipeline dead-end.
    expect(
      pipelineHidAll({ stepCount: 0, inputRowCount: 3, outputRowCount: 0, isFilterEmpty: false })
    ).toBe(false);

    // Empty source (inputRowCount 0) → not a pipeline dead-end.
    expect(
      pipelineHidAll({ stepCount: 1, inputRowCount: 0, outputRowCount: 0, isFilterEmpty: false })
    ).toBe(false);

    // Narrowed by a block filter, not the pipeline → defer to the filter state.
    expect(
      pipelineHidAll({ stepCount: 1, inputRowCount: 3, outputRowCount: 0, isFilterEmpty: true })
    ).toBe(false);
  });

  it("suppresses the dead-end when a linked source zeroes the host pipeline counters", () => {
    // #092: with a database-call linked source the host pipeline never touched the
    // displayed frame, so WidgetHost forwards zeroed counters. The predicate must
    // then read false even though the external source is empty and steps exist.
    expect(
      pipelineHidAll({ stepCount: 0, inputRowCount: 0, outputRowCount: 0, isFilterEmpty: false })
    ).toBe(false);
  });

  it("restores every row once the pipeline is cleared", () => {
    const frame = makeFrame();
    const cleared = executeTransform(frame, { steps: [] });

    expect(cleared.data.records).toHaveLength(3);
    expect(cleared.data.records.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(
      pipelineHidAll({
        stepCount: 0,
        inputRowCount: cleared.meta.inputRowCount,
        outputRowCount: cleared.data.records.length,
        isFilterEmpty: false,
      })
    ).toBe(false);
  });
});
