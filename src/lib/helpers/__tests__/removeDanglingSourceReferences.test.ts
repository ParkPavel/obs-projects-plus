// src/lib/helpers/__tests__/removeDanglingSourceReferences.test.ts
// Unit tests for cascade cleanup of JoinStep / scatter-correlation references
// after a sibling project is deleted (Pillar 5).

import { removeDanglingSourceReferences } from "../removeDanglingSourceReferences";

function makeProject(id: string, widgets: any[]): any {
  return {
    id,
    name: `project-${id}`,
    views: [
      { id: `v-${id}`, name: "main", type: "database", config: { widgets } },
    ],
  };
}

describe("removeDanglingSourceReferences", () => {
  it("returns projects unchanged when removedId is empty", () => {
    const projects = [makeProject("a", [])];
    const result = removeDanglingSourceReferences(projects, "");
    expect(result).toEqual(projects);
  });

  it("returns projects unchanged when nothing references removedId", () => {
    const projects = [
      makeProject("a", [
        {
          id: "w1",
          type: "chart",
          transform: { steps: [{ type: "filter", conditions: [] }] },
          config: { correlation: { rightSourceId: "other", on: { leftKey: "k", rightKey: "k" } } },
        },
      ]),
    ];
    const result = removeDanglingSourceReferences(projects, "deleted");
    // Immutable: different reference but structurally equal.
    expect(result).toEqual(projects);
  });

  it("strips JoinStep referencing the removed project", () => {
    const widgets = [
      {
        id: "w1",
        type: "table",
        transform: {
          steps: [
            { type: "filter", conditions: [] },
            { type: "join", rightSourceId: "deleted", on: { leftKey: "k", rightKey: "k" }, how: "inner" },
            { type: "sort", by: [] },
          ],
        },
        config: {},
      },
    ];
    const projects = [makeProject("a", widgets)];
    const result = removeDanglingSourceReferences(projects, "deleted");
    const steps = result[0]!.views[0]!.config!["widgets"][0].transform.steps;
    expect(steps).toHaveLength(2);
    expect(steps.map((s: any) => s.type)).toEqual(["filter", "sort"]);
  });

  it("strips scatter correlation referencing the removed project", () => {
    const widgets = [
      {
        id: "w1",
        type: "chart",
        transform: { steps: [] },
        config: {
          chartType: "scatter",
          correlation: { rightSourceId: "deleted", on: { leftKey: "k", rightKey: "k" } },
          other: "preserved",
        },
      },
    ];
    const projects = [makeProject("a", widgets)];
    const result = removeDanglingSourceReferences(projects, "deleted");
    const resultConfig = result[0]!.views[0]!.config!["widgets"][0].config;
    expect(resultConfig.correlation).toBeUndefined();
    expect(resultConfig.chartType).toBe("scatter");
    expect(resultConfig.other).toBe("preserved");
  });

  it("keeps correlation pointing at a different project intact", () => {
    const widgets = [
      {
        id: "w1",
        type: "chart",
        transform: { steps: [] },
        config: {
          chartType: "scatter",
          correlation: { rightSourceId: "still-here", on: { leftKey: "k", rightKey: "k" } },
        },
      },
    ];
    const projects = [makeProject("a", widgets)];
    const result = removeDanglingSourceReferences(projects, "deleted");
    const resultConfig = result[0]!.views[0]!.config!["widgets"][0].config;
    expect(resultConfig.correlation.rightSourceId).toBe("still-here");
  });

  it("handles multiple projects and multiple views", () => {
    const projects = [
      {
        id: "a",
        name: "a",
        views: [
          {
            id: "va1",
            name: "v1",
            type: "database",
            config: {
              widgets: [
                {
                  id: "w1",
                  type: "chart",
                  config: { correlation: { rightSourceId: "deleted", on: { leftKey: "k", rightKey: "k" } } },
                },
              ],
            },
          },
          {
            id: "va2",
            name: "v2",
            type: "database",
            config: { widgets: [{ id: "w2", type: "table", transform: { steps: [] }, config: {} }] },
          },
        ],
      },
      {
        id: "b",
        name: "b",
        views: [
          {
            id: "vb1",
            name: "v1",
            type: "database",
            config: {
              widgets: [
                {
                  id: "w3",
                  type: "table",
                  transform: {
                    steps: [
                      { type: "join", rightSourceId: "deleted", on: { leftKey: "k", rightKey: "k" }, how: "inner" },
                    ],
                  },
                  config: {},
                },
              ],
            },
          },
        ],
      },
    ];
    const result = removeDanglingSourceReferences(projects as any, "deleted");
    expect((result[0]!.views[0]!.config as any).widgets[0].config.correlation).toBeUndefined();
    expect((result[1]!.views[0]!.config as any).widgets[0].transform.steps).toHaveLength(0);
  });

  it("tolerates widgets without transform or config", () => {
    const widgets = [{ id: "w1", type: "heading" }];
    const projects = [makeProject("a", widgets)];
    const result = removeDanglingSourceReferences(projects, "deleted");
    expect(result[0]!.views[0]!.config!["widgets"][0]).toEqual({ id: "w1", type: "heading" });
  });
});
