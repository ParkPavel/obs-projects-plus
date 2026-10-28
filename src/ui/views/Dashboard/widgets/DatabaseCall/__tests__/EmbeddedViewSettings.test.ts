import { cleanup, render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { DEFAULT_VIEW } from "src/settings/settings";
import EmbeddedViewSettings from "../EmbeddedViewSettings.svelte";

jest.mock("src/lib/stores/i18n", () => ({
  i18n: require("svelte/store").writable({ t: (key: string, options?: { name?: string }) => options?.name ? `${key} ${options.name}` : key }),
}));

afterEach(cleanup);
test("a block's settings button opens the shared controls and preserves unrelated config", async () => {
  const onChange = jest.fn();
  const config = { groupByField: "status", thumbnailLayout: "none", customKey: 7 };
  const view = { ...DEFAULT_VIEW, id: "tab", name: "Board", type: "board", config };
  const rendered = render(EmbeddedViewSettings, { view, fields: [], onChange });
  await fireEvent.click(rendered.container.querySelector("button")!);
  await tick();
  const select = document.querySelector<HTMLSelectElement>('select[data-board-option="thumbnail-layout"]')!;
  expect(select).not.toBeNull();
  await fireEvent.change(select, { target: { value: "top" } });
  expect(onChange).toHaveBeenCalledWith({ ...config, thumbnailLayout: "top" });
  expect(view.config.thumbnailLayout).toBe("none");
});
test("following a view is visible, and local editing starts through the existing unlink action", async () => {
  const onUnlink = jest.fn();
  const rendered = render(EmbeddedViewSettings, {
    view: { ...DEFAULT_VIEW, id: "tab", name: "Calendar", type: "calendar" },
    fields: [], onChange: jest.fn(), linkedName: "Publication plan", onUnlink,
  });
  await fireEvent.click(rendered.container.querySelector("button")!);
  await tick();
  const popup = document.querySelector(".embedded-view-settings")!;
  expect(popup.textContent).toContain("Publication plan");
  await fireEvent.click(popup.querySelector("button")!);
  expect(onUnlink).toHaveBeenCalledTimes(1);
});
