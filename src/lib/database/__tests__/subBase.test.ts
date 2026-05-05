import {
  EMPTY_FILTER,
  createSubBase,
  findSubBase,
  renameSubBase,
  validateSubBase,
  type SubBaseDefinition,
} from "../subBase";

describe("createSubBase", () => {
  it("uses sane defaults", () => {
    const sb = createSubBase("a1", "Budgets");
    expect(sb).toEqual({
      id: "a1",
      name: "Budgets",
      filter: EMPTY_FILTER,
      inheritColumns: true,
    });
  });

  it("respects overrides without injecting undefined keys", () => {
    const sb = createSubBase("a1", "Budgets", {
      filter: { conjunction: "or", conditions: [] },
      inheritColumns: false,
      columnIds: ["title", "amount"],
    });
    expect(sb.inheritColumns).toBe(false);
    expect(sb.columnIds).toEqual(["title", "amount"]);
    expect(sb.filter.conjunction).toBe("or");
    expect("sort" in sb).toBe(false);
  });
});

describe("validateSubBase", () => {
  it("accepts a well-formed sub-base", () => {
    const ok: SubBaseDefinition = createSubBase("x", "X");
    expect(validateSubBase(ok)).toBe(ok);
  });

  it.each([
    [null, "must be an object"],
    [{}, "id must be a non-empty string"],
    [{ id: "" }, "id must be a non-empty string"],
    [{ id: "a", name: 1 }, "name must be a string"],
    [{ id: "a", name: "x" }, "filter must be a FilterDefinition"],
    [{ id: "a", name: "x", filter: {} }, "conditions must be an array"],
    [
      { id: "a", name: "x", filter: { conditions: [] } },
      "inheritColumns must be a boolean",
    ],
  ])("rejects %p", (input, msg) => {
    expect(() => validateSubBase(input)).toThrow(new RegExp(msg));
  });
});

describe("renameSubBase", () => {
  const base = createSubBase("a", "Budgets");

  it("trims and replaces the name", () => {
    expect(renameSubBase(base, "  Tasks  ").name).toBe("Tasks");
  });

  it("keeps the id stable", () => {
    expect(renameSubBase(base, "Tasks").id).toBe("a");
  });

  it("rejects empty / whitespace-only", () => {
    expect(() => renameSubBase(base, "")).toThrow();
    expect(() => renameSubBase(base, "   ")).toThrow();
  });
});

describe("findSubBase", () => {
  const bases = [createSubBase("a", "A"), createSubBase("b", "B")];

  it("returns the matching sub-base", () => {
    expect(findSubBase(bases, "b")?.name).toBe("B");
  });

  it("returns null when missing (not undefined)", () => {
    expect(findSubBase(bases, "ghost")).toBeNull();
  });
});
