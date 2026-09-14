/**
 * SmartSuggestionBus.test.ts — #059 SmartSuggest strip component.
 */

import "@testing-library/jest-dom";
import { DataFieldType } from "src/lib/dataframe/dataframe";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      // Interpolates like the real translator does: a test that asserts on the
      // sentence a user reads cannot do it against a mock that hands back the
      // template. The placeholders are the whole point of these messages —
      // #207 was a template printed raw to a user.
      t: (key: string, options?: Record<string, unknown>) => {
        const template = (options?.["defaultValue"] as string) ?? key;
        return template.replace(/\{\{(\w+)\}\}/g, (whole: string, name: string) =>
          options && name in options ? String(options[name]) : whole
        );
      },
    }),
  };
});

const SmartSuggestionBus = require("../SmartSuggestionBus.svelte").default;

function numericField(name = "price") {
  return { name, type: DataFieldType.Number, repeated: false, identifier: false, derived: false };
}

function dateField(name = "dueDate") {
  return { name, type: DataFieldType.Date, repeated: false, identifier: false, derived: false };
}

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new SmartSuggestionBus({
    target,
    props: { fields: [], widgets: [], dismissed: [], ...props },
  });
  return {
    component,
    target,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

function click(element: Element | null) {
  if (!element) throw new Error("Expected element to exist");
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("SmartSuggestionBus (#059)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the strip when a numeric field triggers a suggestion", () => {
    const { target, destroy } = mount({ fields: [numericField()] });
    expect(target.querySelector(".ppp-smart-suggest")).not.toBeNull();
    expect(target.querySelector(".ppp-smart-suggest__message")).toHaveTextContent(
      "Numeric field"
    );
    destroy();
  });

  it("renders nothing when no rule fires", () => {
    const { target, destroy } = mount({ fields: [] });
    expect(target.querySelector(".ppp-smart-suggest")).toBeNull();
    destroy();
  });

  it("renders nothing when the suggestion kind is dismissed", () => {
    const { target, destroy } = mount({
      fields: [numericField()],
      dismissed: ["numeric-stats"],
    });
    expect(target.querySelector(".ppp-smart-suggest")).toBeNull();
    destroy();
  });

  it("dispatches accept with the full suggestion on CTA click", () => {
    const { component, target, destroy } = mount({ fields: [numericField()] });
    const onAccept = jest.fn();
    component.$on("accept", (e: CustomEvent) => onAccept(e.detail));

    click(target.querySelector(".ppp-smart-suggest__accept"));

    expect(onAccept).toHaveBeenCalledWith({
      kind: "numeric-stats",
      fieldName: "price",
      widgetType: "stats",
    });
    destroy();
  });

  it("dispatches dismissForever with the kind", () => {
    const { component, target, destroy } = mount({ fields: [numericField()] });
    const onDismiss = jest.fn();
    component.$on("dismissForever", (e: CustomEvent) => onDismiss(e.detail));

    click(target.querySelector(".ppp-smart-suggest__never"));

    expect(onDismiss).toHaveBeenCalledWith("numeric-stats");
    destroy();
  });

  it("hides the suggestion for the session on × without dispatching dismissForever", async () => {
    const { component, target, destroy } = mount({ fields: [numericField()] });
    const onDismiss = jest.fn();
    component.$on("dismissForever", (e: CustomEvent) => onDismiss(e.detail));

    click(target.querySelector(".ppp-smart-suggest__close"));
    await flush();

    expect(target.querySelector(".ppp-smart-suggest")).toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();
    destroy();
  });

  it("shows the next suggestion after the first is closed", async () => {
    const relationField = {
      name: "client",
      type: DataFieldType.Relation,
      repeated: false,
      identifier: false,
      derived: false,
      // #155 — the relation rule now requires a target: a relation that names
      // no project cannot produce a linked block, so it produces no suggestion.
      typeConfig: { relation: { targetProjectId: "p-clients" } },
    };
    const { target, destroy } = mount({ fields: [numericField(), relationField] });
    expect(target.querySelector(".ppp-smart-suggest__message")).toHaveTextContent(
      "Numeric field"
    );

    click(target.querySelector(".ppp-smart-suggest__close"));
    await flush();

    expect(target.querySelector(".ppp-smart-suggest__message")).toHaveTextContent(
      "Relation field"
    );
    destroy();
  });

  it("names the numeric field it will average when a date field and a numeric field coexist", () => {
    // numeric-stats fires too for this schema and is shown first (strip shows
    // one at a time) — dismiss it so the assertion exercises date-chart's text.
    const { target, destroy } = mount({
      fields: [dateField(), numericField("pain")],
      dismissed: ["numeric-stats"],
    });
    expect(target.querySelector(".ppp-smart-suggest__message")).toHaveTextContent("pain");
    destroy();
  });

  it("promises a count, not a named field, when only a date field exists", () => {
    const { target, destroy } = mount({ fields: [dateField()] });
    expect(target.querySelector(".ppp-smart-suggest__message")).toHaveTextContent(
      "record count"
    );
    destroy();
  });

  it("dispatches accept with the date-chart suggestion on CTA click", () => {
    const { component, target, destroy } = mount({ fields: [dateField()] });
    const onAccept = jest.fn();
    component.$on("accept", (e: CustomEvent) => onAccept(e.detail));

    click(target.querySelector(".ppp-smart-suggest__accept"));

    expect(onAccept).toHaveBeenCalledWith({
      kind: "date-chart",
      fieldName: "dueDate",
      widgetType: "chart",
    });
    destroy();
  });
});
