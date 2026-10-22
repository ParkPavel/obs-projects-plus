import "@testing-library/jest-dom";
import { tick } from "svelte";
import { withPickedRelation } from "../noteProperties";

/**
 * i3-close — a relation chip can be chosen from the vault: the chips editor
 * offers the note picker (relations only) and reports the list as it stands;
 * the block appends the chosen note as a wikilink. Typing stays the fallback.
 */

type Mounted = {
  $destroy(): void;
  $on(event: string, handler: (e: CustomEvent<unknown>) => void): () => void;
};
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const ChipsEditor = require("../ChipsEditor.svelte").default as ComponentClass;

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new ChipsEditor({ target, props });
  const picks: string[][] = [];
  const changes: string[][] = [];
  component.$on("pick", (e) => picks.push(e.detail as string[]));
  component.$on("change", (e) => changes.push(e.detail as string[]));
  return { target, component, picks, changes };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("i3-close withPickedRelation", () => {
  it("appends the chosen note as a wikilink", () => {
    expect(withPickedRelation(["[[A]]"], "Projects/B")).toEqual(["[[A]]", "[[Projects/B]]"]);
  });

  it("a note already linked, by alias or bare, leaves the list unchanged", () => {
    expect(withPickedRelation(["[[Projects/B|Bee]]"], "Projects/B")).toEqual(["[[Projects/B|Bee]]"]);
    expect(withPickedRelation(["Projects/B"], "Projects/B")).toEqual(["Projects/B"]);
  });

  it("an empty path changes nothing and never mutates the input", () => {
    const items = ["[[A]]"];
    expect(withPickedRelation(items, "  ")).toEqual(["[[A]]"]);
    withPickedRelation(items, "C");
    expect(items).toEqual(["[[A]]"]);
  });
});

describe("i3-close ChipsEditor note picker", () => {
  it("a pickable relation editor offers the picker and reports the current list", async () => {
    const m = mount({ items: ["[[A]]"], type: "relation", pickable: true, ariaLabel: "links" });
    await tick();
    const button = m.target.querySelector<HTMLButtonElement>("[data-chips-pick]");
    expect(button).not.toBeNull();
    expect(button).toHaveAttribute("aria-label");
    button?.click();
    expect(m.picks).toEqual([["[[A]]"]]);
    expect(m.changes).toEqual([]);
    m.component.$destroy();
  });

  it("typed text is kept as a chip before the picker opens", async () => {
    const m = mount({ items: [], type: "relation", pickable: true, ariaLabel: "links" });
    await tick();
    const input = m.target.querySelector<HTMLInputElement>("input") as HTMLInputElement;
    input.value = "Typed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    m.target.querySelector<HTMLButtonElement>("[data-chips-pick]")?.click();
    expect(m.changes).toEqual([["[[Typed]]"]]);
    expect(m.picks).toEqual([["[[Typed]]"]]);
    m.component.$destroy();
  });

  it("no picker for lists, tags, or a relation editor not made pickable", async () => {
    for (const props of [
      { type: "list", pickable: true },
      { type: "tags", pickable: true },
      { type: "relation", pickable: false },
    ]) {
      const m = mount({ items: [], ariaLabel: "x", ...props });
      await tick();
      expect(m.target.querySelector("[data-chips-pick]")).toBeNull();
      m.component.$destroy();
    }
  });
});
