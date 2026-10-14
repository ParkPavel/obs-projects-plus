import { render } from "@testing-library/svelte";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }) };
});
const DashboardToolbar = require("../DashboardToolbar.svelte").default;

it("B7: the toolbar holds no second «Add widget» — blocks are added with the «+» on the page", () => {
  const { container } = render(DashboardToolbar, { props: { readonly: false, showFormulaBar: false } });
  expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
  expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
});

it("a read-only dashboard exposes no creation or formula controls", () => {
  const { container } = render(DashboardToolbar, { props: { readonly: true, showFormulaBar: false } });
  expect(container.querySelector("button")).toBeNull();
});
