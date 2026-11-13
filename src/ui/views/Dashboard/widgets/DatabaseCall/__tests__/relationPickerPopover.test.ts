import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? "",
    }),
  };
});

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const RelationPickerPopover = require("../RelationPickerPopover.svelte").default;
const { isMobile } = require("src/lib/stores/ui");

const field = {
  name: "Related",
  type: DataFieldType.Relation,
  repeated: false,
  typeConfig: {},
} as import("src/lib/dataframe/dataframe").DataField;

const frame = {
  fields: [field],
  records: [{ id: "Alpha.md", values: { Related: "[[Alpha]]" } }],
} as import("src/lib/dataframe/dataframe").DataFrame;

async function settle(): Promise<void> {
  await tick();
  await tick();
}

describe("relation picker popup", () => {
  afterEach(() => {
    isMobile.set(false);
  });

  it("uses the shared anchored popup and cancels through its Escape lifecycle", async () => {
    const trigger = document.createElement("div");
    document.body.append(trigger);
    const view = render(RelationPickerPopover, {
      props: { field, value: null, api: {}, frame, triggerEl: trigger },
    });
    const cancel = jest.fn();
    view.component.$on("cancel", cancel);
    await settle();

    const popup = document.querySelector<HTMLElement>(".ppp-popup--floating");
    expect(popup).toHaveAttribute("role", "presentation");
    expect(popup).toHaveAttribute("aria-label", "Related");
    expect(popup?.querySelector(".ppp-rel-picker")).not.toBeNull();
    expect(popup?.querySelector(".ppp-rel-picker-list")).toHaveTextContent("Alpha");
    const input = view.container.querySelector<HTMLInputElement>("input.ppp-rel-picker-search")!;
    expect(input).not.toBeNull(); expect(popup?.querySelector("input")).toBeNull();

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await settle();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".ppp-popup--floating")).toBeNull();

    view.unmount();
    trigger.remove();
  });

  it("keeps mobile suggestions floating and the input in its original row", async () => {
    isMobile.set(true);
    const trigger = document.createElement("div");
    document.body.append(trigger);
    const view = render(RelationPickerPopover, {
      props: { field, value: null, api: {}, frame, triggerEl: trigger },
    });
    await settle();

    expect(document.querySelector(".ppp-popup--bottom-sheet")).toBeNull();
    expect(document.querySelector(".ppp-popup--floating .ppp-rel-picker")).not.toBeNull();
    expect(view.container.querySelector("input.ppp-rel-picker-search")).not.toBeNull();

    view.unmount();
    trigger.remove();
  });
});
