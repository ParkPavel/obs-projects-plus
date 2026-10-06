/**
 * stab-forms, steps 4-5 — the small helpers the migrated sites share:
 * `namesToOptions` (field names and function codes become options once each) and
 * `comboOwnsEscape` (a host that closes on Escape in the capture phase leaves an
 * open suggestion list to the field, whose first Escape only closes the list).
 */

import { comboOwnsEscape, namesToOptions } from "../comboOptions";

describe("namesToOptions", () => {
  it("makes the name both id and label, in order", () => {
    expect(namesToOptions(["a", "b"])).toEqual([
      { id: "a", label: "a" },
      { id: "b", label: "b" },
    ]);
  });

  it("offers a repeated name once", () => {
    expect(namesToOptions(["a", "b", "a"]).map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("is empty for no names", () => {
    expect(namesToOptions([])).toEqual([]);
  });
});

describe("comboOwnsEscape", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function box(expanded: string | null): HTMLInputElement {
    const input = document.createElement("input");
    input.setAttribute("role", "combobox");
    if (expanded !== null) input.setAttribute("aria-expanded", expanded);
    document.body.appendChild(input);
    return input;
  }

  it("is true for a combobox whose list is open", () => {
    expect(comboOwnsEscape(box("true"))).toBe(true);
  });

  it("is false for a closed combobox, so the host may close", () => {
    expect(comboOwnsEscape(box("false"))).toBe(false);
    expect(comboOwnsEscape(box(null))).toBe(false);
  });

  it("is false for an ordinary input, a non-element target and nothing", () => {
    const plain = document.createElement("input");
    document.body.appendChild(plain);
    expect(comboOwnsEscape(plain)).toBe(false);
    expect(comboOwnsEscape(document)).toBe(false);
    expect(comboOwnsEscape(null)).toBe(false);
  });

  it("finds an open combobox the target sits inside", () => {
    const wrap = document.createElement("div");
    wrap.setAttribute("role", "combobox");
    wrap.setAttribute("aria-expanded", "true");
    const inner = document.createElement("span");
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    expect(comboOwnsEscape(inner)).toBe(true);
  });
});
