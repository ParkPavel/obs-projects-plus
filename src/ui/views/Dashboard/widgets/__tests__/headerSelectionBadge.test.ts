/**
 * d13 step 2 — a stats widget narrowed by another widget's selection says so
 * in its header (SelectionBadge, #044.5), and clearing it ends the selection
 * for the whole canvas. Only stats really narrows by selection today
 * (statsSelectionReceiver), so only stats may carry the claim.
 */

import "@testing-library/jest-dom";
import { get } from "svelte/store";
import { fireEvent } from "@testing-library/svelte";
import {
  createSelectionStore,
  EMPTY_SELECTION,
  SELECTION_CONTEXT_KEY,
} from "../../canvasSelectionStore";

// Loaded lazily so each test reports on its own while the wrapper is missing.
const loadWrapper = () => require("../_shared/WidgetHeaderBadges.svelte").default;

const frame = { fields: [], records: [] };

function mount(type: string, selectionSource: string | null) {
  const store = createSelectionStore();
  if (selectionSource) store.setSelection({ source: selectionSource, field: "status", values: ["Active"] });
  const target = document.createElement("div");
  document.body.appendChild(target);
  const Wrapper = loadWrapper();
  const component = new Wrapper({
    target,
    props: { widget: { id: "w1", type, title: "T", layout: { x: 0, y: 0, w: 4, h: 3 }, config: {} }, frame },
    context: new Map([[SELECTION_CONTEXT_KEY, store]]),
  });
  return {
    store,
    badge: () => target.querySelector<HTMLElement>("[data-testid='ppp-selection-badge']"),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("header selection badge", () => {
  test("a stats widget shows the selection another widget made", () => {
    const h = mount("stats", "chart:c1");
    expect(h.badge()).not.toBeNull();
    expect(h.badge()!.textContent).toContain("status");
    expect(h.badge()!.textContent).toContain("Active");
    h.destroy();
  });

  test("clearing the badge ends the selection for the canvas", async () => {
    const h = mount("stats", "chart:c1");
    const clear = h.badge()!.querySelector("button")!;
    await fireEvent.click(clear);
    expect(get(h.store)).toEqual(EMPTY_SELECTION);
    h.destroy();
  });

  test("no badge without a selection", () => {
    const h = mount("stats", null);
    expect(h.badge()).toBeNull();
    h.destroy();
  });

  test.each(["chart", "data-table", "database-call", "text"])(
    "a %s widget makes no claim: it is not narrowed by the selection",
    (type) => {
      const h = mount(type, "chart:c1");
      expect(h.badge()).toBeNull();
      h.destroy();
    }
  );

  test("the clear button's name is translated, not an English literal", () => {
    const h = mount("stats", "chart:c1");
    const clear = h.badge()!.querySelector("button")!;
    expect(clear.getAttribute("aria-label")).not.toBe("Clear selection");
    expect(clear.getAttribute("aria-label")).toBe(clear.getAttribute("title"));
    h.destroy();
  });
});
