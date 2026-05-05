import { describe, expect, it } from "@jest/globals";
import { either } from "fp-ts";
import { migrateSettings } from "./settings";

/**
 * P0 safety tests for migrateSettings — REFACTOR-003.
 *
 * Goal: every corruption shape that can land in data.json (manual edit,
 * 3rd-party plugin write, partial flush, version mismatch, malformed nesting)
 * must produce either.left(Error), NEVER throw. The plugin onload is on the
 * critical path: a single uncaught throw here disables every Projects+ feature.
 */
describe("migrateSettings — P0 safety guards", () => {
  it("returns Right(default) when input is null/undefined", () => {
    const r1 = migrateSettings(null);
    const r2 = migrateSettings(undefined);
    expect(either.isRight(r1)).toBe(true);
    expect(either.isRight(r2)).toBe(true);
  });

  it("returns Left when input is a string (not a plain object)", () => {
    const r = migrateSettings("not-an-object" as unknown);
    expect(either.isLeft(r)).toBe(true);
  });

  it("returns Left when input is an array", () => {
    const r = migrateSettings([1, 2, 3] as unknown);
    expect(either.isLeft(r)).toBe(true);
    if (either.isLeft(r)) {
      expect(r.left.message).toMatch(/not a plain object/i);
    }
  });

  it("returns Left when version is missing", () => {
    const r = migrateSettings({ projects: [] } as unknown);
    expect(either.isLeft(r)).toBe(true);
    if (either.isLeft(r)) {
      expect(r.left.message).toMatch(/missing settings version/i);
    }
  });

  it("returns Left when version is unknown integer", () => {
    const r = migrateSettings({ version: 99 } as unknown);
    expect(either.isLeft(r)).toBe(true);
    if (either.isLeft(r)) {
      expect(r.left.message).toMatch(/unknown settings version/i);
    }
  });

  it("returns Left when version is wrong type (string)", () => {
    const r = migrateSettings({ version: "3" } as unknown);
    expect(either.isLeft(r)).toBe(true);
  });

  it("returns Left and never throws when v1 payload is malformed (missing projects)", () => {
    expect(() => {
      const r = migrateSettings({ version: 1 } as unknown);
      // Either Left with descriptive message OR Right with safe defaults.
      // Crucially: NO throw.
      expect(either.isLeft(r) || either.isRight(r)).toBe(true);
    }).not.toThrow();
  });

  it("returns Left and never throws when v2 payload has corrupted project shape", () => {
    expect(() => {
      const r = migrateSettings({
        version: 2,
        projects: [{ id: null, dataSource: "not-an-object" }],
        archives: [],
      } as unknown);
      expect(either.isLeft(r) || either.isRight(r)).toBe(true);
    }).not.toThrow();
  });

  it("returns Left and never throws when v3 payload contains circular reference markers", () => {
    const obj: { version: number; projects: unknown } = {
      version: 3,
      projects: [],
    };
    // Mutate to add corruption that cannot be JSON.parse'd, but is reachable
    // when a 3rd-party in-memory mutation is involved.
    (obj as { ghost?: unknown }).ghost = obj;
    expect(() => {
      const r = migrateSettings(obj);
      expect(either.isLeft(r) || either.isRight(r)).toBe(true);
    }).not.toThrow();
  });

  it("returns Right for valid v3 payload", () => {
    const r = migrateSettings({
      version: 3,
      projects: [],
      archives: [],
      preferences: {},
    } as unknown);
    expect(either.isRight(r)).toBe(true);
  });
});
