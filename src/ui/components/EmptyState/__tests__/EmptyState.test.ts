/**
 * EmptyState.test.ts — shared zero-state component (#065, M-VISION-PARITY).
 */

import "@testing-library/jest-dom";

const EmptyState = require("../EmptyState.svelte").default;

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new EmptyState({ target, props });
  return {
    component,
    target,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("EmptyState (#065)", () => {
  it("renders the title", () => {
    const { target, destroy } = mount({ title: "No records yet" });
    expect(target.querySelector(".ppp-empty-state-title")).toHaveTextContent(
      "No records yet"
    );
    destroy();
  });

  it("renders the hint when provided", () => {
    const { target, destroy } = mount({
      title: "Empty canvas",
      hint: "Start with a data block",
    });
    expect(target.querySelector(".ppp-empty-state-hint")).toHaveTextContent(
      "Start with a data block"
    );
    destroy();
  });

  it("omits the hint element when hint is empty", () => {
    const { target, destroy } = mount({ title: "Empty canvas" });
    expect(target.querySelector(".ppp-empty-state-hint")).toBeNull();
    destroy();
  });

  it("omits the actions container when no actions slot is given", () => {
    const { target, destroy } = mount({ title: "Empty canvas" });
    expect(target.querySelector(".ppp-empty-state-actions")).toBeNull();
    destroy();
  });

  it("exposes role=status for assistive tech", () => {
    const { target, destroy } = mount({ title: "Empty canvas" });
    expect(target.querySelector('[role="status"]')).not.toBeNull();
    destroy();
  });
});
