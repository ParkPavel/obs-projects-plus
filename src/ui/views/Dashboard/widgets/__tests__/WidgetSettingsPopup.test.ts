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
  expect(dialog.style.getPropertyValue("--ppp-popup-max-w")).toBe("44rem");
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

test("an outside press commits the valid native draft before the settings unmount", async () => {
  const view = render(Fixture); await settle();
  const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
  input.focus(); await fireEvent.input(input,{target:{value:"new.png"}});
  await fireEvent.mouseDown(document.body); await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(view.container.querySelector("output")).toHaveTextContent("new.png");
});

test("the real cover settings commit their pending image source exactly once on outside dismissal", async () => {
  const view = render(Fixture); await settle();
  const input = document.querySelector<HTMLInputElement>("#cb-src")!;
  input.focus(); await fireEvent.input(input,{target:{value:"Attachments/new.png"}});
  await fireEvent.mouseDown(document.body); await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(view.container.querySelector("#banner-result")).toHaveTextContent("Attachments/new.png");
  expect(view.container.querySelector("#banner-result")).toHaveAttribute("data-writes","1");
});

test.each(["invalid","composition"])("%s prevents outside dismissal and retains the original field", async kind => {
  const view = render(Fixture); await settle();
  const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
  input.focus();
  if(kind === "composition") await fireEvent.compositionStart(input);
  await fireEvent.input(input,{target:{value:kind === "invalid" ? "invalid" : "new.png"}});
  await fireEvent.mouseDown(document.body); await settle();
  expect(document.querySelector('[role="dialog"] input')).toBe(input);
  expect(view.container.querySelector("output")).toHaveTextContent("price * 2");
  if(kind === "composition") await fireEvent.compositionEnd(input);
  await fireEvent.input(input,{target:{value:"valid.png"}});
  await fireEvent.mouseDown(document.body); await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(view.container.querySelector("output")).toHaveTextContent("valid.png");
});
