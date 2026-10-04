/**
 * cards-g3 — the one reading of a saved gallery config.
 *
 * Every renderer and the settings tab read a gallery config through
 * `normalizeGalleryConfig`; these pin what absent, legacy and invalid values
 * mean, so an old config renders exactly as it did before the options existed.
 */

import {
  GALLERY_ASPECT_RATIOS,
  GALLERY_DEFAULTS,
  GALLERY_LAYOUTS,
  GALLERY_SIZE_PRESETS,
  aspectRatioCss,
  cardFieldsInOrder,
  moveIncludedField,
  normalizeGalleryConfig,
  sizePresetOf,
} from "../galleryOptions";

describe("chrome-filters — card fields in the saved order", () => {
  const fields = [{ name: "a" }, { name: "b" }, { name: "c" }];

  it("follows includeFields, not the frame", () => {
    expect(cardFieldsInOrder(fields, ["c", "a"]).map((f) => f.name)).toEqual(["c", "a"]);
  });

  it("skips a name the frame lacks and shows a repeated name once", () => {
    expect(cardFieldsInOrder(fields, ["x", "b", "b"]).map((f) => f.name)).toEqual(["b"]);
    expect(cardFieldsInOrder(fields, [])).toEqual([]);
  });

  it("moves one place among shown names, keeping stale names in place", () => {
    expect(moveIncludedField(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
    expect(moveIncludedField(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    const shown = (n: string) => n !== "x";
    expect(moveIncludedField(["a", "x", "b"], "b", -1, shown)).toEqual(["b", "x", "a"]);
  });

  it("is a no-op at either end or for an unknown name (deduplicated)", () => {
    expect(moveIncludedField(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveIncludedField(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveIncludedField(["a", "a", "b"], "z", 1)).toEqual(["a", "b"]);
  });
});

const DEFAULTS = {
  coverField: undefined,
  iconField: undefined,
  fitStyle: "cover",
  cardWidth: 300,
  includeFields: [],
  layout: "grid",
  coverAspectRatio: "16/10",
  showFieldLabels: true,
};

describe("normalizeGalleryConfig — absent config", () => {
  it("undefined, null and {} all read as the pre-cards-g3 gallery", () => {
    expect(normalizeGalleryConfig(undefined)).toEqual(DEFAULTS);
    expect(normalizeGalleryConfig(null)).toEqual(DEFAULTS);
    expect(normalizeGalleryConfig({})).toEqual(DEFAULTS);
  });

  it("a legacy config keeps every value it carries and gains the defaults", () => {
    const legacy = { coverField: "cover", iconField: "icon", fitStyle: "contain", cardWidth: 240, includeFields: ["status"] };
    expect(normalizeGalleryConfig(legacy)).toEqual({ ...DEFAULTS, ...legacy });
  });

  it("the default card width is the medium preset", () => {
    expect(GALLERY_DEFAULTS.cardWidth).toBe(GALLERY_SIZE_PRESETS.m);
  });
});

describe("normalizeGalleryConfig — fit style", () => {
  it("keeps cover and contain, the two values the settings ever wrote", () => {
    expect(normalizeGalleryConfig({ fitStyle: "cover" }).fitStyle).toBe("cover");
    expect(normalizeGalleryConfig({ fitStyle: "contain" }).fitStyle).toBe("contain");
  });

  it("keeps legacy fill, a valid object-fit", () => {
    expect(normalizeGalleryConfig({ fitStyle: "fill" }).fitStyle).toBe("fill");
  });

  it("reads anything else as cover", () => {
    for (const fitStyle of ["", "none", "scale-down", "Cover", "stretch"]) {
      expect(normalizeGalleryConfig({ fitStyle }).fitStyle).toBe("cover");
    }
    expect(normalizeGalleryConfig({ fitStyle: 3 } as unknown as Record<string, unknown>).fitStyle).toBe("cover");
  });
});

describe("normalizeGalleryConfig — card width", () => {
  it("keeps a finite positive width, whole or not", () => {
    expect(normalizeGalleryConfig({ cardWidth: 180 }).cardWidth).toBe(180);
    expect(normalizeGalleryConfig({ cardWidth: 412.5 }).cardWidth).toBe(412.5);
  });

  it("reads a numeric string through the coercion module", () => {
    expect(normalizeGalleryConfig({ cardWidth: "250" }).cardWidth).toBe(250);
  });

  it("replaces zero, negative, non-finite and non-numeric widths with the default", () => {
    for (const cardWidth of [0, -50, Number.NaN, Number.POSITIVE_INFINITY, "", "12abc", null, true, {}]) {
      expect(normalizeGalleryConfig({ cardWidth }).cardWidth).toBe(300);
    }
  });
});

describe("normalizeGalleryConfig — layout", () => {
  it("keeps grid, masonry and list", () => {
    for (const layout of GALLERY_LAYOUTS) {
      expect(normalizeGalleryConfig({ layout }).layout).toBe(layout);
    }
    expect([...GALLERY_LAYOUTS]).toEqual(["grid", "masonry", "list"]);
  });

  it("reads an unknown or non-string layout as grid", () => {
    for (const layout of ["table", "Grid", "", 1, null]) {
      expect(normalizeGalleryConfig({ layout }).layout).toBe("grid");
    }
  });
});

describe("normalizeGalleryConfig — cover aspect ratio", () => {
  it("keeps every token of the closed set, none included", () => {
    expect([...GALLERY_ASPECT_RATIOS]).toEqual(["16/10", "4/3", "1/1", "3/4", "2/3", "none"]);
    for (const coverAspectRatio of GALLERY_ASPECT_RATIOS) {
      expect(normalizeGalleryConfig({ coverAspectRatio }).coverAspectRatio).toBe(coverAspectRatio);
    }
  });

  it("reads an unknown token as 16/10", () => {
    for (const coverAspectRatio of ["16 / 10", "16:9", "21/9", "auto", 1.6, ""]) {
      expect(normalizeGalleryConfig({ coverAspectRatio }).coverAspectRatio).toBe("16/10");
    }
  });

  it("writes a token as a CSS aspect-ratio, and none as no ratio", () => {
    expect(aspectRatioCss("16/10")).toBe("16 / 10");
    expect(aspectRatioCss("3/4")).toBe("3 / 4");
    expect(aspectRatioCss("none")).toBeNull();
  });
});

describe("normalizeGalleryConfig — labels and fields", () => {
  it("shows field labels unless the config says false", () => {
    expect(normalizeGalleryConfig({ showFieldLabels: false }).showFieldLabels).toBe(false);
    expect(normalizeGalleryConfig({ showFieldLabels: true }).showFieldLabels).toBe(true);
    expect(normalizeGalleryConfig({ showFieldLabels: "false" }).showFieldLabels).toBe(true);
  });

  it("keeps only the string entries of includeFields, in order", () => {
    expect(normalizeGalleryConfig({ includeFields: ["b", 3, "a", null] }).includeFields).toEqual(["b", "a"]);
    expect(normalizeGalleryConfig({ includeFields: "status" }).includeFields).toEqual([]);
  });

  it("reads an empty cover or icon field as none", () => {
    expect(normalizeGalleryConfig({ coverField: "", iconField: "" })).toMatchObject({ coverField: undefined, iconField: undefined });
  });
});

describe("sizePresetOf", () => {
  it("names the preset a width equals, and null for a custom width", () => {
    expect(sizePresetOf(GALLERY_SIZE_PRESETS.s)).toBe("s");
    expect(sizePresetOf(GALLERY_SIZE_PRESETS.m)).toBe("m");
    expect(sizePresetOf(GALLERY_SIZE_PRESETS.l)).toBe("l");
    expect(sizePresetOf(250)).toBeNull();
  });
});
