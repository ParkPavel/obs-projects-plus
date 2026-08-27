// #138 — external frames get backlink enrichment, and what that costs.
//
// Only the parent frame used to be enriched (WidgetHost did it per widget), so
// a relation view over an external source was missing derived fields the
// identical view over the parent project had. Enrichment moved to
// externalFrameResolver so every frame reaching a widget has the same shape.
//
// Two consequences are pinned here rather than discovered later: the collision
// guard that stops enrichment destroying a real field, and the fact that `join`
// copies right-frame fields into its output, so enriching right frames widens
// join's output schema.

import { enrichWithBacklinks } from "../relationResolver";
import { executeTransform } from "../transformExecutor";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { TransformPipeline } from "../transformTypes";

const field = (name: string, type: DataFieldType = DataFieldType.String, derived = false) =>
  ({ name, type, repeated: false, identifier: false, derived }) as never;

const frame = (fields: unknown[], records: Array<{ id: string; values: Record<string, unknown> }>) =>
  ({ fields, records }) as unknown as DataFrame;

describe("#138 enrichWithBacklinks — the collision guard", () => {
  it("adds the derived field when the name is free", () => {
    const df = frame(
      [field("name"), field("owner", DataFieldType.Relation)],
      [
        { id: "a.md", values: { name: "A", owner: "[[b]]" } },
        { id: "b.md", values: { name: "B" } },
      ]
    );

    const out = enrichWithBacklinks(df, ["owner"]);

    expect(out.fields.map((f) => f.name)).toContain("owner_backlinks");
  });

  it("refuses to overwrite a real field of the same name", () => {
    // A vault is free to have a frontmatter property called owner_backlinks.
    // The enrichment appends a duplicate field and clobbers the stored value
    // through a spread, so the user's data would simply vanish.
    const df = frame(
      [field("owner", DataFieldType.Relation), field("owner_backlinks")],
      [
        { id: "a.md", values: { owner: "[[b]]", owner_backlinks: "mine" } },
        { id: "b.md", values: { owner_backlinks: "also mine" } },
      ]
    );

    const out = enrichWithBacklinks(df, ["owner"]);

    expect(out.records.find((r) => r.id === "b.md")?.values["owner_backlinks"]).toBe("also mine");
    expect(out.fields.filter((f) => f.name === "owner_backlinks")).toHaveLength(1);
  });

  it("still enriches the relations that do not collide", () => {
    const df = frame(
      [
        field("owner", DataFieldType.Relation),
        field("owner_backlinks"),
        field("client", DataFieldType.Relation),
      ],
      [
        { id: "a.md", values: { owner: "[[b]]", client: "[[b]]", owner_backlinks: "mine" } },
        { id: "b.md", values: {} },
      ]
    );

    const out = enrichWithBacklinks(df, ["owner", "client"]);
    const names = out.fields.map((f) => f.name);

    expect(names).toContain("client_backlinks");
    expect(names.filter((n) => n === "owner_backlinks")).toHaveLength(1);
  });

  it("returns the frame untouched when every relation collides", () => {
    const df = frame(
      [field("owner", DataFieldType.Relation), field("owner_backlinks")],
      [{ id: "a.md", values: {} }]
    );

    expect(enrichWithBacklinks(df, ["owner"])).toBe(df);
  });
});

describe("#138 join output widens when right frames are enriched", () => {
  // Deliberate and recorded: join copies every right-frame field except the key
  // into its output (transformExecutor), so enriching right frames at the
  // resolver changes join's output schema too. Flagged by cross-model review
  // before implementation rather than found afterwards.
  const left = frame(
    [field("name"), field("clientId")],
    [{ id: "l1.md", values: { name: "Project", clientId: "c1" } }]
  );

  const rightEnriched = frame(
    [field("id"), field("title"), field("owner_backlinks", DataFieldType.Relation, true)],
    [{ id: "c1.md", values: { id: "c1", title: "Client", owner_backlinks: ["[[l1]]"] } }]
  );

  const pipeline: TransformPipeline = {
    steps: [
      {
        type: "join",
        rightSourceId: "clients",
        on: { leftKey: "clientId", rightKey: "id" },
        how: "inner",
      },
    ],
  };

  it("carries the enriched field into the joined output", () => {
    const out = executeTransform(left, pipeline, {
      rightFrames: new Map([["clients", rightEnriched]]),
    });

    expect(out.data.fields.map((f) => f.name)).toContain("owner_backlinks");
    expect(out.data.records[0]?.values["owner_backlinks"]).toEqual(["[[l1]]"]);
  });

  it("still joins on the key and keeps the left fields", () => {
    const out = executeTransform(left, pipeline, {
      rightFrames: new Map([["clients", rightEnriched]]),
    });

    expect(out.data.records).toHaveLength(1);
    expect(out.data.records[0]?.values["name"]).toBe("Project");
    expect(out.data.records[0]?.values["title"]).toBe("Client");
  });
});

describe("#138 the resolver is where enrichment happens", () => {
  it("externalFrameResolver enriches, rather than each widget doing it again", () => {
    // App caches the resolver's promise per project id, so enriching here costs
    // once per source instead of once per canvas or once per widget.
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "..", "externalFrameResolver.ts"),
      "utf8"
    ) as string;

    expect(source).toContain("enrichWithBacklinks");
    expect(source).toMatch(/return enrichWithBacklinks\(frame, relationFieldNames\(frame\)\)/);
  });
});
