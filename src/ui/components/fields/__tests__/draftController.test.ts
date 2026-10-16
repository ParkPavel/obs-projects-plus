/**
 * stab-forms — the draft controller is the one text-entry lifecycle, so its
 * rules are pinned here without a DOM: seed on focus, keep the draft when the
 * prop refreshes during focus, commit once per interaction, Escape restores the
 * baseline, and an IME composition owns Enter and Escape until it ends.
 */

import { createDraftController, isImeKey } from "../draftController";
import { filterOptions, optionDomId, stepActive } from "../comboOptions";

describe("draftController — seed", () => {
  test("focus adopts the current text as baseline, draft and committed", () => {
    const c = createDraftController("a");
    c.input("scratch");
    c.focus("b");
    expect(c.getState()).toEqual({ baseline: "b", draft: "b", committed: "b", focused: true, composing: false });
  });

  test("a prop change while blurred is adopted and reported", () => {
    const c = createDraftController("a");
    expect(c.refresh("b")).toBe(true);
    expect(c.getState().draft).toBe("b");
    expect(c.refresh("b")).toBe(false);
  });
});

describe("draftController — prop refresh while focused", () => {
  test("the draft is kept, and the edit wins on blur", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.input("ax");
    expect(c.refresh("zz")).toBe(false);
    expect(c.getState().draft).toBe("ax");
    expect(c.blur()).toEqual({ value: "ax", reason: "blur" });
    expect(c.getState().draft).toBe("ax");
  });

  test("an untouched field shows the parent's value after blur, and that is not a commit", () => {
    const c = createDraftController("a");
    c.focus("a");
    expect(c.refresh("z")).toBe(false);
    expect(c.getState().draft).toBe("a");
    expect(c.blur()).toBeNull();
    expect(c.getState()).toMatchObject({ draft: "z", baseline: "z", committed: "z" });
  });

  test("a value committed during focus is not replaced by a stale parent value on blur", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.input("b");
    c.commit("enter");
    c.refresh("a2");
    c.blur();
    expect(c.getState().draft).toBe("b");
  });
});

describe("draftController — commit once", () => {
  test("Enter then blur commits once", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.input("b");
    expect(c.commit("enter")).toEqual({ value: "b", reason: "enter" });
    expect(c.blur()).toBeNull();
  });

  test("a select commits even when the text is unchanged, once, and the blur after it adds nothing", () => {
    const c = createDraftController("a");
    c.focus("a");
    expect(c.commit("select", { value: "a" })).toEqual({ value: "a", reason: "select" });
    expect(c.commit("select", { value: "a" })).toBeNull();
    expect(c.blur()).toBeNull();
  });

  test("an edit re-arms the commit", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.input("b");
    c.commit("enter");
    c.input("c");
    expect(c.blur()).toEqual({ value: "c", reason: "blur" });
  });

  test("arm() lets a second pick in the same focus commit", () => {
    const c = createDraftController("a");
    c.focus("a");
    expect(c.commit("select", { value: "b" })?.value).toBe("b");
    expect(c.commit("select", { value: "c" })).toBeNull();
    c.arm();
    expect(c.commit("select", { value: "c" })?.value).toBe("c");
  });

  test("blur and Tab report an edit only, unless the consumer asks for the unchanged one", () => {
    const c = createDraftController("a");
    c.focus("a");
    expect(c.blur()).toBeNull();
    c.focus("a");
    expect(c.commit("tab")).toBeNull();
    c.focus("a");
    expect(c.blur({ unchanged: true })).toEqual({ value: "a", reason: "blur" });
  });

  test("a rejected draft commits nothing and blur restores the baseline", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.input("bad");
    expect(c.commit("enter", { accept: false })).toBeNull();
    expect(c.getState().draft).toBe("bad");
    expect(c.blur({ accept: false })).toBeNull();
    expect(c.getState().draft).toBe("a");
  });
});

describe("draftController — Escape", () => {
  test("restores the baseline, and the blur after it commits nothing", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.input("zz");
    expect(c.cancel()).toBe("a");
    expect(c.getState().draft).toBe("a");
    expect(c.blur()).toBeNull();
  });

  test("restores the last committed text, not the text at focus", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.input("b");
    c.commit("enter");
    c.input("c");
    expect(c.cancel()).toBe("b");
  });
});

describe("draftController — IME", () => {
  test("composition blocks Escape and nothing changes", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.input("あ");
    c.compositionStart();
    expect(c.isComposing()).toBe(true);
    expect(c.cancel()).toBeNull();
    expect(c.getState().draft).toBe("あ");
    c.compositionEnd();
    expect(c.isComposing()).toBe(false);
    expect(c.cancel()).toBe("a");
  });

  test("a key event reports composition through isComposing and keyCode 229", () => {
    const c = createDraftController("a");
    expect(c.isComposing({ isComposing: true })).toBe(true);
    expect(c.isComposing({ keyCode: 229 })).toBe(true);
    expect(c.isComposing({ isComposing: false, keyCode: 13 })).toBe(false);
    expect(isImeKey({})).toBe(false);
    expect(isImeKey({ keyCode: 229 })).toBe(true);
    // i2-input (D03): iOS reports 229 for a plain Return; only the Return right
    // after compositionend belongs to the IME.
    expect(isImeKey({ keyCode: 229, key: "Enter" })).toBe(false);
    document.dispatchEvent(new Event("compositionend"));
    expect(isImeKey({ keyCode: 229, key: "Enter" })).toBe(true);
    expect(isImeKey({ keyCode: 229, key: "Enter" }, Date.now() + 1000)).toBe(false);
  });

  test("leaving the field ends a composition", () => {
    const c = createDraftController("a");
    c.focus("a");
    c.compositionStart();
    c.blur();
    expect(c.getState().composing).toBe(false);
  });
});

describe("comboOptions", () => {
  const options = [
    { id: "a", label: "Apple" },
    { id: "b", label: "Banana" },
    { id: "c", label: "Apricot" },
  ];

  test("filterOptions matches the label case-insensitively and returns all for an empty query", () => {
    expect(filterOptions(options, "AP").map((o) => o.id)).toEqual(["a", "c"]);
    expect(filterOptions(options, "  ").map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect(filterOptions(options, "zzz")).toEqual([]);
  });

  test("stepActive wraps, and starts from the ends when nothing is active", () => {
    expect(stepActive(-1, 1, 3)).toBe(0);
    expect(stepActive(-1, -1, 3)).toBe(2);
    expect(stepActive(2, 1, 3)).toBe(0);
    expect(stepActive(0, -1, 3)).toBe(2);
    expect(stepActive(0, 1, 0)).toBe(-1);
  });

  test("optionDomId is stable, and ids that differ only in punctuation stay distinct", () => {
    expect(optionDomId("l", "a b")).toBe(optionDomId("l", "a b"));
    expect(optionDomId("l", "a b")).not.toBe(optionDomId("l", "a_b"));
    expect(optionDomId("l", "a b")).toMatch(/^[\w-]+$/);
  });
});
