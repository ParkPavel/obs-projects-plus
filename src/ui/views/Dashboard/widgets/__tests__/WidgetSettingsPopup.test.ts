import "@testing-library/jest-dom";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});
const Fixture = require("./WidgetSettingsPopup.fixture.svelte").default;
const { isMobile } = require("src/lib/stores/ui");
const settle = async () => { await tick(); await tick(); };
afterEach(() => { cleanup(); isMobile.set(false); });

test("desktop settings escape widget clipping and close with Escape", async () => {
  const view = render(Fixture);
  await settle();
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog).toHaveAttribute("aria-label", "Formula settings");
  expect(dialog.style.width).toBe("44rem");
  expect(view.container.contains(dialog)).toBe(false);
  expect(dialog.querySelector("input")).toHaveValue("price * 2");
  await fireEvent.keyDown(document, { key: "Escape" }); await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(view.container.querySelector("input")).toBeNull();
});

test("mobile settings keep the existing inline form", async () => {
  isMobile.set(true);
  const view = render(Fixture); await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(view.container.querySelector("input")).toHaveValue("price * 2");
});
