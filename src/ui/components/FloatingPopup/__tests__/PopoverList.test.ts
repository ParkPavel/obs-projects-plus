/**
 * PopoverList smoke tests — verifies the presentational helper renders
 * items, filters when searchable, and dispatches `select` with keepOpen.
 *
 * Ticket: #034.2a (Phase 4 — popoverDropdown migration).
 */

import "@testing-library/jest-dom";

// PopoverList itself does not consume isMobile, but other modules pulled
// transitively through Svelte runtime resolution might — mock defensively.
jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return {
    isMobile: writable(false),
  };
});

// `setIcon` from obsidian is a no-op in tests — provide a stub.
jest.mock("obsidian", () => ({
  setIcon: jest.fn(),
}), { virtual: false });

const PopoverList = require("../PopoverList.svelte").default;

interface PopoverItem {
  label: string;
  icon?: string;
  selected?: boolean;
  keepOpen?: boolean;
  handler?: () => void;
}

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new PopoverList({ target, props });
  return {
    component,
    target,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("PopoverList", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders items and dispatches `select` with keepOpen flag + invokes handler on mousedown", async () => {
    const handlerA = jest.fn();
    const handlerB = jest.fn();
    const items: PopoverItem[] = [
      { label: "Alpha", handler: handlerA, keepOpen: true },
      { label: "Beta", handler: handlerB, selected: true },
    ];

    const { component, target, destroy } = mount({ items, searchable: false });

    try {
      await flush();

      const buttons = target.querySelectorAll<HTMLButtonElement>(".ppp-pop-item");
      expect(buttons.length).toBe(2);
      expect(buttons[0]!.textContent).toContain("Alpha");
      expect(buttons[1]!.textContent).toContain("Beta");
      expect(buttons[1]!.classList.contains("ppp-pop-item--selected")).toBe(true);

      const events: Array<{ item: PopoverItem; keepOpen: boolean }> = [];
      component.$on("select", (e: CustomEvent<{ item: PopoverItem; keepOpen: boolean }>) => {
        events.push(e.detail);
      });

      buttons[0]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      await flush();

      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(events).toHaveLength(1);
      expect(events[0]!.item.label).toBe("Alpha");
      expect(events[0]!.keepOpen).toBe(true);

      buttons[1]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      await flush();

      expect(handlerB).toHaveBeenCalledTimes(1);
      expect(events).toHaveLength(2);
      expect(events[1]!.item.label).toBe("Beta");
      expect(events[1]!.keepOpen).toBe(false);
    } finally {
      destroy();
    }
  });

  it("filters items by query when searchable=true", async () => {
    const items: PopoverItem[] = [
      { label: "Apple" },
      { label: "Banana" },
      { label: "Apricot" },
    ];

    const { target, destroy } = mount({ items, searchable: true });

    try {
      await flush();

      const search = target.querySelector<HTMLInputElement>(".ppp-pop-search-input");
      expect(search).not.toBeNull();
      expect(target.querySelectorAll(".ppp-pop-item").length).toBe(3);

      search!.value = "ap";
      search!.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();

      const remaining = Array.from(target.querySelectorAll(".ppp-pop-item")).map((el) =>
        (el.textContent ?? "").trim(),
      );
      expect(remaining.length).toBe(2);
      expect(remaining.some((t) => t.includes("Apple"))).toBe(true);
      expect(remaining.some((t) => t.includes("Apricot"))).toBe(true);
      expect(remaining.some((t) => t.includes("Banana"))).toBe(false);
    } finally {
      destroy();
    }
  });
});
