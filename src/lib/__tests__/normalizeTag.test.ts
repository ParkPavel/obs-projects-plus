import { normalizeTag, stripTagHash } from "../helpers";

describe("normalizeTag", () => {
  it("adds # to plain tag", () => {
    expect(normalizeTag("daily")).toBe("#daily");
  });

  it("keeps single # as-is", () => {
    expect(normalizeTag("#daily")).toBe("#daily");
  });

  it("strips double ##", () => {
    expect(normalizeTag("##daily")).toBe("#daily");
  });

  it("strips triple ###", () => {
    expect(normalizeTag("###daily")).toBe("#daily");
  });

  it("trims whitespace", () => {
    expect(normalizeTag("  #daily  ")).toBe("#daily");
  });

  it("trims whitespace and adds #", () => {
    expect(normalizeTag("  daily  ")).toBe("#daily");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeTag("")).toBe("");
  });

  it("returns empty string for only #", () => {
    expect(normalizeTag("#")).toBe("");
  });

  it("returns empty string for only ##", () => {
    expect(normalizeTag("##")).toBe("");
  });

  it("handles tag with slash (hierarchy)", () => {
    expect(normalizeTag("#project/sub")).toBe("#project/sub");
  });

  it("handles tag with slash without #", () => {
    expect(normalizeTag("project/sub")).toBe("#project/sub");
  });

  it("handles unicode tags", () => {
    expect(normalizeTag("проект")).toBe("#проект");
  });

  it("handles unicode tags with #", () => {
    expect(normalizeTag("#проект")).toBe("#проект");
  });
});

describe("stripTagHash", () => {
  it("strips single #", () => {
    expect(stripTagHash("#daily")).toBe("daily");
  });

  it("strips double ##", () => {
    expect(stripTagHash("##daily")).toBe("daily");
  });

  it("returns plain tag as-is", () => {
    expect(stripTagHash("daily")).toBe("daily");
  });

  it("trims whitespace", () => {
    expect(stripTagHash("  #daily  ")).toBe("daily");
  });

  it("returns empty for # only", () => {
    expect(stripTagHash("#")).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(stripTagHash("")).toBe("");
  });

  it("handles hierarchy tags", () => {
    expect(stripTagHash("#project/sub")).toBe("project/sub");
  });
});
