import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import DataTableContent from "../DataTableContent.svelte";

type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? "" }) };
});

const field: DataField = { name: "name", type: DataFieldType.String, identifier: true, repeated: false, derived: false, typeConfig: {} };

function mount() {
  const reads = jest.fn((i: number) => i === 1400 ? "old needle" : i === 4500 ? "new needle" : "ordinary");
  const records: DataRecord[] = Array.from({ length: 5000 }, (_, i) => ({
    id: `row-${i}.md`, values: { name: `Record ${i}`, get note() { return reads(i); } },
  }));
  const view = render(DataTableContent, {
    props: { frame: { fields: [field], records }, fields: [field], api: {} as never, config: undefined, readonly: true, getRecordColor: () => null },
  });
  return { ...view, reads, records };
}

async function openSearch(container: HTMLElement): Promise<HTMLInputElement> {
  container.querySelector<HTMLButtonElement>('button[aria-label="Search records"]')?.click();
  await tick();
  const input = container.querySelector<HTMLInputElement>('input[role="searchbox"]');
  if (!input) throw new Error("search not opened");
  return input;
}

async function type(input: HTMLInputElement, query: string): Promise<void> {
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}

async function drain(): Promise<void> {
  // Macrotasks, not just Promise microtasks: input/scroll must get a turn.
  for (let i = 0; jest.getTimerCount() && i < 200; i++) {
    jest.runOnlyPendingTimers();
    await tick();
  }
  expect(jest.getTimerCount()).toBe(0);
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("does not scan a large database in the input/Svelte flush; finishes in yielding chunks", async () => {
  const { container, reads } = mount();
  await tick();
  const input = await openSearch(container);
  reads.mockClear();
  await type(input, "new needle");
  expect(input.value).toBe("new needle");
  expect(reads).not.toHaveBeenCalled();
  expect(container.querySelector(".ppp-dt-content")).toHaveAttribute("aria-busy", "true");
  jest.runOnlyPendingTimers();
  await tick();
  expect(reads.mock.calls.length).toBeGreaterThan(0);
  expect(reads.mock.calls.length).toBeLessThan(5000);
  await drain();
  expect(container.querySelector(".ppp-t2-cb-count")).toHaveTextContent("1");
  expect(container.querySelector(".ppp-t2-name")).toHaveTextContent("Record 4500");
  expect(container.querySelector(".ppp-dt-content")).not.toHaveAttribute("aria-busy", "true");
});

it("cancels an older query rather than publishing it after newer input", async () => {
  const { container } = mount();
  await tick();
  const input = await openSearch(container);
  await type(input, "old needle");
  jest.runOnlyPendingTimers();
  await tick();
  await type(input, "new needle");
  await drain();
  expect(container.querySelector(".ppp-t2-cb-count")).toHaveTextContent("1");
  expect(container.querySelector(".ppp-t2-name")).toHaveTextContent("Record 4500");
});

it("clearing cancels pending work immediately; closing search cannot restore old results", async () => {
  const { container, reads } = mount();
  await tick();
  const input = await openSearch(container);
  await type(input, "old needle");
  jest.runOnlyPendingTimers();
  await tick();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await tick();
  reads.mockClear();
  expect(container.querySelector(".ppp-t2-cb-count")).toHaveTextContent("5000");
  await drain();
  expect(reads).not.toHaveBeenCalled();
  expect(container.querySelector(".ppp-t2-cb-count")).toHaveTextContent("5000");
});

it("uses the replacement datasource and does not leave queued work after destroying the table", async () => {
  const { container, component, reads } = mount();
  await tick();
  const input = await openSearch(container);
  await type(input, "old needle");
  jest.runOnlyPendingTimers();
  await tick();
  component.$set({ frame: { fields: [field], records: [{ id: "fresh.md", values: { name: "Fresh old needle" } }] } });
  await tick();
  await drain();
  expect(container.querySelector(".ppp-t2-name")).toHaveTextContent("Fresh old needle");
  component.$destroy();
  reads.mockClear();
  await drain();
  expect(reads).not.toHaveBeenCalled();
});

it("stops a search that is still pending when the table is destroyed", async () => {
  const { container, component, reads } = mount();
  await tick();
  const input = await openSearch(container);
  await type(input, "old needle");
  jest.runOnlyPendingTimers();
  await tick();
  expect(container.querySelector(".ppp-dt-content")).toHaveAttribute("aria-busy", "true");
  component.$destroy();
  reads.mockClear();
  await drain();
  expect(reads).not.toHaveBeenCalled();
});

it("distinguishes a completed zero-match query from a search still running", async () => {
  const { container } = mount();
  await tick();
  const input = await openSearch(container);
  await type(input, "missing result");
  expect(container.querySelector(".ppp-t2-search-empty")).toBeNull();
  await drain();
  expect(container.querySelector(".ppp-t2-search-empty")).toHaveTextContent("No matches");
  expect(container.querySelector(".ppp-t2-cb-count")).toHaveTextContent("0");
  await type(input, "");
  expect(container.querySelector(".ppp-t2-search-empty")).toBeNull();
});
