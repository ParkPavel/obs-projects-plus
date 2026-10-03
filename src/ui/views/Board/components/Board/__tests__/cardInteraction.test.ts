/**
 * cards-g2: a board card renders through SharedCard inside a keyed wrapper,
 * and every way of acting on it behaves as before.
 *
 * The wrapper exists because `animate:flip` may only sit on an element that is
 * a direct child of a keyed each, never on a component. svelte-dnd-action
 * treats the zone's direct children as its items, so the wrapper is now what
 * the library arms, clones, hides and marks as the shadow; the card (an
 * `article`) moves inside it. gripLayout.test.ts pins the grip lane, arming,
 * the disabled-zone gate and keyboard reorder; this file pins the wrapper and
 * what a click does on each part of the card.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";
import { SHADOW_ITEM_MARKER_PROPERTY_NAME } from "svelte-dnd-action";

// CardList reads two view contexts keyed by private symbols; a test cannot
// provide them through `context`, so the context helpers are stubbed (the
// gripLayout pattern), with the two outputs a card's link hands work to.
jest.mock("src/ui/views/helpers", () => ({
  ...jest.requireActual("src/ui/views/helpers"),
  getRecordColorContext: { get: () => () => null, set: () => undefined },
  sortRecordsContext: { get: () => (records: unknown[]) => records, set: () => undefined },
  showMobileNavMenu: jest.fn(),
  handleHoverLink: jest.fn(),
}));
jest.mock("src/lib/record/openRecord", () => ({
  ...jest.requireActual("src/lib/record/openRecord"),
  openRecord: jest.fn(() => Promise.resolve()),
}));
// The shared obsidian-svelte mock renders nothing; the card's checkbox is the
// real obsidian-svelte component, so a click on it is the click a user makes.
jest.mock("obsidian-svelte", () => ({
  ...jest.requireActual("src/__mocks__/obsidian-svelte.js"),
  Checkbox: jest.requireActual("obsidian-svelte/Checkbox/Checkbox.svelte").default,
}));

type Mounted = { $destroy(): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const CardList = require("../CardList.svelte").default as ComponentClass;
const { openRecord } = require("src/lib/record/openRecord") as { openRecord: jest.Mock };
const helpers = require("src/ui/views/helpers") as { showMobileNavMenu: jest.Mock };

const record = (id: string, done = false) => ({ id, values: { done } });

function mountCards(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const items = [record("a.md"), record("b.md")];
  const onRecordClick = jest.fn();
  const onRecordCheck = jest.fn();
  const component = new CardList({
    target,
    props: {
      items,
      onRecordClick,
      onRecordCheck,
      onDrop: jest.fn(),
      includeFields: [],
      checkField: "done",
      customHeader: undefined,
      boardEditing: false,
      ...props,
    },
  });
  const zone = target.querySelector(".projects--board--card-list") as HTMLElement;
  const card = (i: number) => target.querySelectorAll<HTMLElement>("article.projects--board--card")[i] as HTMLElement;
  return {
    items,
    zone,
    card,
    onRecordClick,
    onRecordCheck,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

const click = (init: MouseEventInit = {}) => new MouseEvent("click", { bubbles: true, cancelable: true, ...init });

beforeEach(() => {
  openRecord.mockClear();
  helpers.showMobileNavMenu.mockClear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cards-g2 — the keyed wrapper is the drag item", () => {
  it("the zone's direct children are the wrappers, each holding one card", () => {
    const m = mountCards();
    const children = Array.from(m.zone.children);
    expect(children).toHaveLength(2);
    for (const child of children) {
      expect(child.tagName).toBe("DIV");
      expect(child).toHaveClass("ppp-board-card-slot");
      expect(child.children).toHaveLength(1);
      expect(child.firstElementChild?.tagName).toBe("ARTICLE");
      expect(child.firstElementChild).toHaveClass("projects--board--card", "ppp-shared-card");
      // The library labels its items, so the label is on the wrapper now.
      expect(child).toHaveAttribute("role", "listitem");
    }
    m.destroy();
  });

  it("the card itself is not a control: no role, no tabindex", () => {
    const m = mountCards();
    expect(m.card(0)).not.toHaveAttribute("role");
    expect(m.card(0)).not.toHaveAttribute("tabindex");
    m.destroy();
  });

  it("the shadow item's wrapper carries the placeholder class; the others do not", () => {
    const shadow = { ...record("c.md"), [SHADOW_ITEM_MARKER_PROPERTY_NAME]: true };
    const m = mountCards({ items: [record("a.md"), shadow] });
    const [plain, placeholder] = Array.from(m.zone.children);
    expect(plain).not.toHaveClass("projects--board--card-placeholder");
    expect(placeholder).toHaveClass("projects--board--card-placeholder");
    // The column and list rules find it with `:has()` at any depth; it is the
    // zone's own child, wrapping the card.
    const marked = m.zone.querySelector(".projects--board--card-placeholder");
    expect(marked?.parentElement).toBe(m.zone);
    expect(marked?.firstElementChild?.tagName).toBe("ARTICLE");
    m.destroy();
  });
});

describe("cards-g2 — what a click does on each part of a board card", () => {
  it("a click on the body opens that card's record", () => {
    const m = mountCards();
    m.card(1).querySelector(".color-item")?.dispatchEvent(click());
    expect(m.onRecordClick).toHaveBeenCalledTimes(1);
    expect(m.onRecordClick).toHaveBeenCalledWith(m.items[1]);
    m.card(0).dispatchEvent(click());
    expect(m.onRecordClick).toHaveBeenCalledTimes(2);
    expect(m.onRecordClick).toHaveBeenLastCalledWith(m.items[0]);
    m.destroy();
  });

  it("a click on the grip, or its glyph, does not open the card", () => {
    const m = mountCards();
    const grip = m.card(0).firstElementChild as HTMLElement;
    expect(grip).toHaveClass("board-card-grip");
    grip.dispatchEvent(click());
    grip.querySelector(".board-card-grip-glyph")?.dispatchEvent(click());
    expect(m.onRecordClick).not.toHaveBeenCalled();
    m.destroy();
  });

  it("the checkbox toggles the record without opening it", async () => {
    const m = mountCards();
    const box = m.card(0).querySelector<HTMLInputElement>(".checkbox-wrapper input[type='checkbox']");
    expect(box).not.toBeNull();
    expect(box?.checked).toBe(false);
    box?.click();
    await tick();
    expect(m.onRecordCheck).toHaveBeenCalledTimes(1);
    expect(m.onRecordCheck).toHaveBeenCalledWith(m.items[0], true);
    expect(m.onRecordClick).not.toHaveBeenCalled();
    m.destroy();
  });

  it("the pencil opens the record once, not again through the card", () => {
    const m = mountCards();
    const pencil = m.card(0).querySelector<HTMLElement>(".edit-hint .clickable-icon");
    expect(pencil).toHaveAttribute("aria-label", "components.note.edit");
    pencil?.dispatchEvent(click());
    expect(m.onRecordClick).toHaveBeenCalledTimes(1);
    expect(m.onRecordClick).toHaveBeenCalledWith(m.items[0]);
    m.destroy();
  });

  it("on read-only data the pencil says it opens the note", () => {
    const m = mountCards({ readOnly: true });
    const pencil = m.card(0).querySelector<HTMLElement>(".edit-hint .clickable-icon");
    expect(pencil).toHaveAttribute("aria-label", "common.open-note");
    m.destroy();
  });
});

describe("cards-g2 — the title link keeps its modifiers", () => {
  const link = (m: ReturnType<typeof mountCards>, i: number) =>
    m.card(i).querySelector<HTMLElement>("a.internal-link") as HTMLElement;

  it("a plain click opens the record once", () => {
    const m = mountCards();
    link(m, 0).dispatchEvent(click());
    expect(m.onRecordClick).toHaveBeenCalledTimes(1);
    expect(m.onRecordClick).toHaveBeenCalledWith(m.items[0]);
    expect(openRecord).not.toHaveBeenCalled();
    m.destroy();
  });

  it("Shift opens a window, Ctrl or Meta a tab, and none of them opens the card", () => {
    const m = mountCards();
    const target = { id: "a.md", sourcePath: "a.md" };
    link(m, 0).dispatchEvent(click({ shiftKey: true }));
    expect(openRecord).toHaveBeenLastCalledWith(target, "window", expect.anything());
    link(m, 0).dispatchEvent(click({ ctrlKey: true }));
    expect(openRecord).toHaveBeenLastCalledWith(target, "tab", expect.anything());
    link(m, 0).dispatchEvent(click({ metaKey: true }));
    expect(openRecord).toHaveBeenLastCalledWith(target, "tab", expect.anything());
    expect(openRecord).toHaveBeenCalledTimes(3);
    expect(m.onRecordClick).not.toHaveBeenCalled();
    m.destroy();
  });

  it("a long press on it offers the navigation menu, whose first entry opens the record", () => {
    jest.useFakeTimers();
    try {
      const m = mountCards();
      const press = new Event("touchstart", { bubbles: true, cancelable: true });
      Object.defineProperty(press, "touches", { value: [{ clientX: 100, clientY: 100 }] });
      link(m, 0).dispatchEvent(press);
      jest.advanceTimersByTime(500);
      expect(helpers.showMobileNavMenu).toHaveBeenCalledTimes(1);
      const [, target, , onModal] = helpers.showMobileNavMenu.mock.calls[0] as [unknown, unknown, Event, () => void];
      expect(target).toEqual({ id: "a.md", sourcePath: "a.md" });
      onModal();
      expect(m.onRecordClick).toHaveBeenCalledWith(m.items[0]);
      m.destroy();
    } finally {
      jest.useRealTimers();
    }
  });
});
