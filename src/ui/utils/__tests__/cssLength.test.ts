/**
 * cssLength — measured CSS pixels written back as root-relative lengths (R0.3b).
 *
 * The helper replaces every script-built px length, so two properties carry
 * the whole conversion: the root is read from the document the caller names
 * (a popout window has its own), and the result is exact — no rounding, so a
 * drag coordinate written back resolves to the pixel it was measured at.
 */
import { FALLBACK_ROOT_FONT_SIZE, remAt, rootFontPx, toRem } from "../cssLength";

/** A document whose root reports `fontSize`, as far as the helper reads one. */
function docWithRootFont(fontSize: string): Document {
  const documentElement = {};
  return {
    documentElement,
    defaultView: {
      getComputedStyle: (el: unknown) => {
        expect(el).toBe(documentElement);
        return { fontSize };
      },
    },
  } as unknown as Document;
}

describe("rootFontPx", () => {
  it("reads the root font size of the document it is given", () => {
    expect(rootFontPx(docWithRootFont("20px"))).toBe(20);
    expect(rootFontPx(docWithRootFont("15.5px"))).toBe(15.5);
  });

  it("falls back to 16 when the root reports nothing usable", () => {
    expect(FALLBACK_ROOT_FONT_SIZE).toBe(16);
    expect(rootFontPx(docWithRootFont(""))).toBe(16);
    expect(rootFontPx(docWithRootFont("medium"))).toBe(16);
    expect(rootFontPx(docWithRootFont("0px"))).toBe(16);
    expect(rootFontPx(docWithRootFont("-4px"))).toBe(16);
  });

  it("falls back to 16 for a document with no window", () => {
    const detached = { documentElement: {}, defaultView: null } as unknown as Document;
    expect(rootFontPx(detached)).toBe(16);
  });

  it("defaults to the global document, and gives a finite positive size there", () => {
    const size = rootFontPx();
    expect(Number.isFinite(size)).toBe(true);
    expect(size).toBeGreaterThan(0);
  });
});

describe("remAt", () => {
  it("divides by the root size without rounding", () => {
    expect(remAt(16, 16)).toBe("1rem");
    expect(remAt(1, 16)).toBe("0.0625rem");
    expect(remAt(123.456, 16)).toBe(`${123.456 / 16}rem`);
    expect(remAt(10, 3)).toBe(`${10 / 3}rem`);
  });

  it("keeps zero and negative offsets", () => {
    expect(remAt(0, 16)).toBe("0rem");
    expect(remAt(-24, 16)).toBe("-1.5rem");
  });

  it("round-trips: the rem written resolves to the pixel measured", () => {
    for (const root of [16, 20, 15]) {
      for (const measured of [0.5, 7, 133.33, 1024.75]) {
        const rem = parseFloat(remAt(measured, root));
        expect(rem * root).toBeCloseTo(measured, 10);
      }
    }
  });

  it("never writes a pixel unit", () => {
    expect(remAt(42, 16)).not.toMatch(/px/);
  });
});

describe("toRem", () => {
  it("converts against the named document's root", () => {
    expect(toRem(40, docWithRootFont("20px"))).toBe("2rem");
    expect(toRem(40, docWithRootFont(""))).toBe("2.5rem");
  });

  it("defaults to the global document", () => {
    expect(toRem(32)).toBe(remAt(32, rootFontPx(document)));
  });
});
