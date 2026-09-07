import "@testing-library/jest-dom";

/**
 * #187 — a group with no value must still look like a group.
 *
 * Found by the user in a visual run: "an empty separator row without a header,
 * so it is unclear where one group ends and the next begins." The mechanism,
 * not the impression: `valueToGroupKey` returns "" for a record whose grouped
 * field is empty, and the header rendered that verbatim — chevron, nothing,
 * count. The semantic grouping mode has always had a fallback label for the
 * same case; the default value mode never got one.
 */

const TableGroupSection =
  require("../TableGroupSection.svelte").default as new (o: unknown) => {
    $destroy(): void;
  };

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new TableGroupSection({
    target,
    props: { count: 3, collapsed: false, ...props },
  });
  return {
    label: () => target.querySelector(".ppp-t2-group-label"),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("#187 — the group header of an empty value", () => {
  it("names the absence instead of rendering nothing", () => {
    const m = mount({ groupKey: "" });

    const label = m.label();
    expect(label?.textContent?.trim()).not.toBe("");
    expect(label).toHaveClass("ppp-t2-group-label--empty");
    m.destroy();
  });

  it("leaves a real value exactly as it is", () => {
    const m = mount({ groupKey: "In progress" });

    expect(m.label()?.textContent?.trim()).toBe("In progress");
    expect(m.label()).not.toHaveClass("ppp-t2-group-label--empty");
    m.destroy();
  });

  it("does not mistake a value that merely looks empty", () => {
    // A field holding "0" or a space is a value, not an absence, and turning
    // either into "No value" would hide data rather than label its absence.
    for (const key of ["0", " ", "false"]) {
      const m = mount({ groupKey: key });
      expect(m.label()).not.toHaveClass("ppp-t2-group-label--empty");
      m.destroy();
    }
  });
});
