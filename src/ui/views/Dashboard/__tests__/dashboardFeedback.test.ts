import { render } from "@testing-library/svelte";
import { tick } from "svelte";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }) };
});
const DashboardToolbar = require("../DashboardToolbar.svelte").default;

it("the first Add widget click opens the actual type menu, not a second creation button", async () => {
  const { container, component } = render(DashboardToolbar, { props: { readonly: false, showFormulaBar: false, currentWidgets: [] } });
  const add = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
  expect(add).not.toBeNull();
  add?.click(); await tick();
  const choices = document.querySelectorAll('button[role="menuitem"]');
  expect(choices.length).toBeGreaterThan(2);
  const added = jest.fn(); component.$on("addWidget", added);
  (choices[0] as HTMLButtonElement).click(); await tick();
  expect(added).toHaveBeenCalledTimes(1);
  expect(document.querySelector('button[role="menuitem"]')).toBeNull();
});

it("a read-only dashboard exposes no creation or formula controls", () => {
  const { container } = render(DashboardToolbar, { props: { readonly: true, showFormulaBar: false, currentWidgets: [] } });
  expect(container.querySelector("button")).toBeNull();
});
