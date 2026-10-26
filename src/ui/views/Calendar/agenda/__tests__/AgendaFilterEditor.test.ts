/**
 * The agenda list's condition editor — w4-filters (N11): the shared
 * FilterPanel over the list's stored AgendaFilterGroup.
 *
 * Kept from the old FilterRow suite: the report "Agenda filter input takes
 * focus but not text" (P1 #12) — the typed value reaches the list's state and
 * stays in the box through the re-render the edit causes. New: the editor is
 * the view filter's (one condition row, one operator catalog), and the stored
 * group keeps its ids, value types and legacy operator names until edited.
 *
 * Why these fail on the old code: the agenda drew its own FilterGroupEditor
 * and FilterRow (no `.ppp-filter-panel`, its own operator copy without the
 * catalog's list), and its edits went through those rows.
 */

import "@testing-library/jest-dom";

import { DataFieldType } from "src/lib/dataframe/dataframe";
import { comboInputs, enter, mountCollecting, settle, typeInto } from "src/ui/components/fields/__tests__/support/comboKit";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const AgendaFilterEditor = require("../AgendaFilterEditor.svelte").default;

const field = (name: string, type = DataFieldType.String) => ({ name, type, repeated: false, identifier: false, derived: false });
const fields = [field("status"), field("title"), field("due", DataFieldType.Date)];
const records = [
  { id: "a", values: { status: "Alpha", title: "x" } },
  { id: "b", values: { status: "Beta", title: "y" } },
];
type Group = { id: string; conjunction: string; filters: Array<{ id: string; field: string; operator: string; value: unknown; enabled?: boolean }>; groups: Group[] };
const group: Group = { id: "g1", conjunction: "AND", filters: [{ id: "f1", field: "status", operator: "is", value: "" }], groups: [] };

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = "";
});

const mount = (g: Group = group) => mountCollecting<Group>(AgendaFilterEditor, { filterGroup: g, fields, records }, "change");
const flush = async () => { jest.advanceTimersByTime(200); await settle(); };

describe("AgendaFilterEditor — the view filter's editor (N11)", () => {
  test("the agenda's conditions are drawn by FilterPanel", () => {
    const m = mount();
    // FilterPanel's row buttons (the agenda's own row had none of this class).
    expect(m.target.querySelector(".row-btn.row-toggle")).not.toBeNull();
    m.destroy();
  });

  test("P1 #12: typing in the value box emits a change whose filter carries the text, with its id", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Be");
    await flush();
    const last = m.events[m.events.length - 1]!;
    expect(last.filters[0]?.value).toBe("Be");
    expect(last.filters[0]?.id).toBe("f1");
    expect(last.id).toBe("g1");
    expect(last.conjunction).toBe("AND");
    m.destroy();
  });

  test("P1 #12: the text stays in the box through the re-render the edit causes", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Be");
    await flush();
    typeInto(box, "Bet");
    await flush();
    expect(box.value).toBe("Bet");
    expect(m.events[m.events.length - 1]?.filters[0]?.value).toBe("Bet");
    m.destroy();
  });

  test("a switched-off condition stays switched off in the stored group", async () => {
    const m = mount({ ...group, filters: [{ id: "f1", field: "status", operator: "is", value: "Alpha", enabled: false }] });
    const toggle = m.target.querySelector<HTMLElement>(".row-btn.row-toggle")!;
    expect(toggle).toHaveClass("row-toggle--off");
    toggle.click();
    await flush();
    expect(m.events[m.events.length - 1]?.filters[0]?.enabled).not.toBe(false);
    m.destroy();
  });
});
