/**
 * Codex review of 316d058: frames other projects read of a project carry its
 * rollups now, but the App cache was keyed on project ids and names only —
 * changing a rollup from sum to avg left every reader on the old value. The
 * key covers what shapes a frame: the field configuration and the source.
 */

import { projectsCacheKey } from "../externalFrameInvalidation";

const project = (fieldConfig: unknown, path = "Clients") =>
  ({ id: "p", name: "Clients", fieldConfig, dataSource: { kind: "folder", config: { path, recursive: false } } }) as never;

test("a changed rollup function changes the key", () => {
  const sum = projectsCacheKey([project({ paid: { rollup: { function: "sum" } } })]);
  const avg = projectsCacheKey([project({ paid: { rollup: { function: "avg" } } })]);
  expect(avg).not.toBe(sum);
});

test("a changed source changes the key", () => {
  expect(projectsCacheKey([project({}, "A")])).not.toBe(projectsCacheKey([project({}, "B")]));
});

test("the same projects give the same key", () => {
  expect(projectsCacheKey([project({ x: 1 })])).toBe(projectsCacheKey([project({ x: 1 })]));
});
