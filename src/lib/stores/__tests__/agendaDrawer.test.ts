import { describe, expect, it } from "@jest/globals";
import { get } from "svelte/store";

import { close, isOpen, isOpenNow, toggle } from "../agendaDrawer";

describe("agendaDrawer", () => {
  it("is closed by default", () => {
    expect(get(isOpen("fresh"))).toBe(false);
    expect(isOpenNow("fresh")).toBe(false);
  });

  it("toggle opens, then closes, and notifies subscribers", () => {
    const seen: boolean[] = [];
    const unsubscribe = isOpen("a").subscribe((v) => seen.push(v));
    expect(toggle("a")).toBe(true);
    expect(toggle("a")).toBe(false);
    unsubscribe();
    expect(seen).toEqual([false, true, false]);
  });

  it("keeps views independent", () => {
    toggle("b");
    expect(get(isOpen("b"))).toBe(true);
    expect(get(isOpen("c"))).toBe(false);
    close("b");
  });

  it("close shuts an open drawer and ignores a closed one", () => {
    toggle("d");
    close("d");
    expect(isOpenNow("d")).toBe(false);
    close("d");
    expect(isOpenNow("d")).toBe(false);
  });

  it("ignores a missing key", () => {
    expect(toggle(undefined)).toBe(false);
    expect(get(isOpen(undefined))).toBe(false);
  });
});
