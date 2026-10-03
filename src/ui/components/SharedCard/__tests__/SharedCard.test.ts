/**
 * cards-g2: the shared card shell, mounted on its own.
 *
 * SharedCard is the root Gallery and Board both render a card through. These
 * tests pin its contract without either view: the article root and its public
 * classes per variant, the order of the slots, that a slot not given adds no
 * element, that the root is not a control (no role, no tabindex), that click
 * and keypress on the root reach whoever listens, and the reserved hooks
 * (`size` as a custom property, `interactive` / `disabled` as classes).
 *
 * Slot content is handed in the way a compiled parent does: `$$slots` holds,
 * per slot name, a block factory with `c` / `m` / `p` / `d`, and `$$scope`
 * the (empty) parent context.
 */

import "@testing-library/jest-dom";

type Mounted = {
  $destroy(): void;
  $on(type: string, handler: (e: Event) => void): () => void;
};
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

type Block = {
  c(): void;
  m(target: Node, anchor?: Node | null): void;
  p(): void;
  d(detaching: boolean): void;
};

const SharedCard = require("../SharedCard.svelte").default as ComponentClass;

/** A slot definition whose block renders the element `make` returns. */
function slot(make: () => HTMLElement): [() => Block] {
  return [
    () => {
      const node = make();
      return {
        c: () => undefined,
        m: (target, anchor) => {
          target.insertBefore(node, anchor ?? null);
        },
        p: () => undefined,
        d: (detaching) => {
          if (detaching) node.remove();
        },
      };
    },
  ];
}

const el = (tag: string, className: string, text = ""): HTMLElement => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

function mount(props: Record<string, unknown>, slots: Record<string, [() => Block]> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new SharedCard({
    target,
    props: { recordId: "notes/Alpha.md", ...props, $$slots: slots, $$scope: { ctx: [] } },
  });
  const root = target.firstElementChild as HTMLElement;
  return {
    component,
    root,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

/** An element's own first class (Svelte appends its scoping class after it). */
const firstClass = (node: Element): string => node.className.split(/\s+/)[0] ?? "";

const childClasses = (node: HTMLElement): string[] => Array.from(node.children).map(firstClass);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cards-g2 — the shell's root", () => {
  it.each([
    ["gallery", "projects--gallery--card", "projects--board--card"],
    ["board", "projects--board--card", "projects--gallery--card"],
  ])("a %s card is an article with its public and variant classes", (variant, own, other) => {
    const m = mount({ variant });
    expect(m.root.tagName).toBe("ARTICLE");
    expect(m.root).toHaveClass("ppp-shared-card", own, `ppp-shared-card--${variant}`);
    expect(m.root).not.toHaveClass(other);
    expect(m.root).toHaveAttribute("data-ppp-card-id", "notes/Alpha.md");
    m.destroy();
  });

  it.each(["gallery", "board"])("the %s root is not a control: no role, no tabindex", (variant) => {
    const m = mount({ variant });
    expect(m.root).not.toHaveAttribute("role");
    expect(m.root).not.toHaveAttribute("tabindex");
    m.destroy();
  });

  it("forwards click and keypress on the root to its listeners", () => {
    const m = mount({ variant: "board" });
    const clicked = jest.fn();
    const pressed = jest.fn();
    m.component.$on("click", clicked);
    m.component.$on("keypress", pressed);
    m.root.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    m.root.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", bubbles: true }));
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(clicked.mock.calls[0]?.[0]).toBeInstanceOf(MouseEvent);
    expect(pressed).toHaveBeenCalledTimes(1);
    m.destroy();
  });

  it("exposes the reserved hooks as classes and a custom property, off by default", () => {
    const plain = mount({ variant: "gallery" });
    expect(plain.root).not.toHaveClass("ppp-shared-card--interactive");
    expect(plain.root).not.toHaveClass("ppp-shared-card--disabled");
    expect(plain.root.style.getPropertyValue("--ppp-shared-card-size")).toBe("");
    plain.destroy();

    const hooked = mount({ variant: "gallery", interactive: true, disabled: true, size: "18rem" });
    expect(hooked.root).toHaveClass("ppp-shared-card--interactive", "ppp-shared-card--disabled");
    expect(hooked.root.style.getPropertyValue("--ppp-shared-card-size")).toBe("18rem");
    hooked.destroy();
  });
});

describe("cards-g2 — slots", () => {
  it("a board card with no slots is the colour item alone", () => {
    const m = mount({ variant: "board" });
    expect(childClasses(m.root)).toEqual(["color-item"]);
    m.destroy();
  });

  it("a gallery card with no slots is the body alone, holding the colour item", () => {
    const m = mount({ variant: "gallery" });
    expect(childClasses(m.root)).toEqual(["projects--gallery--card__body"]);
    expect(m.root.querySelector(".projects--gallery--card__body > .color-item")).not.toBeNull();
    expect(m.root.querySelector(".projects--gallery--card__media")).toBeNull();
    m.destroy();
  });

  it("board: grip first, then the colour item, then controls", () => {
    const m = mount(
      { variant: "board" },
      {
        grip: slot(() => el("span", "test-grip")),
        header: slot(() => el("div", "test-header", "Title")),
        metadata: slot(() => el("div", "test-meta", "Status")),
        controls: slot(() => el("div", "test-controls")),
      }
    );
    expect(childClasses(m.root)).toEqual(["test-grip", "color-item", "test-controls"]);
    m.destroy();
  });

  it("gallery: media first, then the body", () => {
    const m = mount(
      { variant: "gallery" },
      {
        media: slot(() => el("div", "projects--gallery--card__media")),
        header: slot(() => el("a", "test-header", "Title")),
      }
    );
    expect(childClasses(m.root)).toEqual(["projects--gallery--card__media", "projects--gallery--card__body"]);
    m.destroy();
  });

  it("header goes into the colour item's header line, metadata after it", () => {
    for (const variant of ["gallery", "board"]) {
      const m = mount(
        { variant },
        {
          header: slot(() => el("a", "test-header", "Title")),
          metadata: slot(() => el("div", "test-meta", "Status")),
        }
      );
      const header = m.root.querySelector(".color-item .card-header > .test-header");
      expect(header).not.toBeNull();
      const meta = m.root.querySelector(".color-item .test-meta");
      expect(meta).not.toBeNull();
      // The metadata follows the header line inside the same layout column.
      expect(meta?.previousElementSibling).toHaveClass("card-header");
      m.destroy();
    }
  });

  it("a slot not given adds no element anywhere in the card", () => {
    const m = mount({ variant: "board" }, { header: slot(() => el("a", "test-header", "Title")) });
    // Only ColorItem's own markup and the header given: nothing for grip,
    // media, metadata or controls.
    const all = Array.from(m.root.querySelectorAll("*")).map(firstClass);
    expect(all).toEqual(["color-item", "card-layout", "card-header", "test-header"]);
    m.destroy();
  });
});

describe("cards-g2 — colour", () => {
  it("draws the colour bar only when a colour is given", () => {
    const none = mount({ variant: "board" });
    expect(none.root.querySelector(".color-item > span")).toBeNull();
    none.destroy();

    const red = mount({ variant: "board", color: "red" });
    const bar = red.root.querySelector<HTMLElement>(".color-item > span");
    expect(bar).not.toBeNull();
    expect(bar?.style.backgroundColor).toBe("red");
    red.destroy();
  });
});
