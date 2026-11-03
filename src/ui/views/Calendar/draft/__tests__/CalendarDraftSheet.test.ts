/**
 * w4-calendar-draft — the draft's bottom form, as the user meets it: there as
 * soon as a draft begins, still there while the draft is moved, not a modal,
 * deaf to an IME composition, keeping what was typed when the write is refused,
 * and closed to a second ✓ while the note is written.
 */
import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import dayjs from "dayjs";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
// The Svelte CJS test compiler reads .default; the browser build imports dayjs normally.
jest.mock("dayjs", () => { const actual = jest.requireActual("dayjs"); return Object.assign(actual, { default: actual }); });

import CalendarDraftSheet from "../CalendarDraftSheet.svelte";
import { createCalendarDraft, draftMapping } from "../calendarDraft";
type CalendarDraftController = import("../calendarDraft").CalendarDraftController;
type DraftBegin = import("../calendarDraft").DraftBegin;

const mapping = draftMapping({
  config: { checkField: "done", eventColorField: "color", iconField: "icon" },
  fields: [],
});

function begin(ctl: CalendarDraftController, extra: Partial<DraftBegin> = {}) {
  return ctl.begin({
    owner: "p|k",
    day: dayjs("2026-10-26"),
    startTime: "10:00",
    endTime: "11:00",
    durationMinutes: 60,
    name: "Meeting",
    templatePath: "",
    prefill: {},
    mapping,
    ...extra,
  });
}

function mount(props: Record<string, unknown> = {}) {
  const ctl = createCalendarDraft();
  const onConfirm = jest.fn();
  const view = render(CalendarDraftSheet, { props: { controller: ctl, onConfirm, ...props } });
  const sheet = () => view.container.querySelector<HTMLElement>(".ppp-draft-sheet");
  const nameInput = () => view.container.querySelector<HTMLInputElement>('input[id$="-name"]')!;
  const confirmButton = () => view.container.querySelector<HTMLButtonElement>(".ppp-draft-sheet__confirm")!;
  return { ctl, onConfirm, sheet, nameInput, confirmButton, ...view };
}

const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(el, { key: k, bubbles: true, cancelable: true, ...init });

describe("CalendarDraftSheet — there at once, and not in the way", () => {
  it("appears as soon as the draft begins, in the view's own tree, without a modal", async () => {
    const m = mount();
    expect(m.sheet()).toBeNull();
    begin(m.ctl);
    await tick();
    expect(m.sheet()).not.toBeNull();
    expect(m.container.contains(m.sheet())).toBe(true);
    expect(m.sheet()).toHaveAttribute("aria-modal", "false");
    expect(m.nameInput().value).toBe("Meeting");
  });

  it("stays open while the draft is moved behind it, and shows where it went", async () => {
    const m = mount();
    const draft = begin(m.ctl)!;
    await tick();
    m.ctl.move(dayjs("2026-10-27"), { startTime: "14:00", endTime: "15:00", endDate: dayjs("2026-10-27") });
    await tick();
    expect(m.sheet()).toHaveAttribute("data-draft-session", String(draft.session));
    const times = Array.from(m.container.querySelectorAll<HTMLInputElement>("input.ppp-date-field__text")).map((i) => i.value);
    expect(times[0]).toContain("14:00");
    expect(times[1]).toContain("15:00");
  });

  it("uses date-only inputs for a date-only draft", async () => {
    const m = mount();
    begin(m.ctl, { startTime: undefined, endTime: undefined });
    await tick();
    const inputs = Array.from(m.container.querySelectorAll<HTMLInputElement>(".ppp-date-field__native"));
    expect(inputs.map((input) => input.type)).toEqual(["date", "date"]);
  });

  it("a new draft starts from its own name, not from text left in the last one", async () => {
    const m = mount();
    begin(m.ctl);
    await tick();
    await fireEvent.input(m.nameInput(), { target: { value: "Left over" } });
    m.ctl.cancel();
    await tick();
    expect(m.sheet()).toBeNull();
    begin(m.ctl, { name: "Fresh" });
    await tick();
    expect(m.nameInput().value).toBe("Fresh");
  });
});

describe("CalendarDraftSheet — keys", () => {
  it("the explicit confirm cannot accept an unfinished composition from any field", async () => {
    const m = mount(); begin(m.ctl); await tick();
    const input = m.container.querySelector<HTMLInputElement>('input[id$="-icon"]')!;
    await fireEvent.compositionStart(input);
    await fireEvent.input(input, { target: { value: "📞" } });
    await fireEvent.click(m.confirmButton()); expect(m.onConfirm).not.toHaveBeenCalled();
    await key(input, "Escape"); expect(m.ctl.getState().draft).not.toBeNull();
    await fireEvent.compositionEnd(input); await fireEvent.click(m.confirmButton());
    expect(m.onConfirm).toHaveBeenCalledTimes(1); expect(m.ctl.getState().draft?.icon).toBe("📞");
  });

  it.each(["not a date", ""])("a refused required date %j blocks create without discarding typed text", async text => {
    const m = mount(); begin(m.ctl); await tick();
    const input = m.container.querySelector<HTMLInputElement>(".ppp-date-field__text")!;
    input.focus(); await fireEvent.input(input, { target: { value: text } });
    await fireEvent.click(m.confirmButton());
    expect(m.onConfirm).not.toHaveBeenCalled(); expect(input.value).toBe(text);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("confirm commits the unblurred date and preserves the focused input through pending/rejection", async () => {
    let fail!: (error: Error) => void;
    const m = mount();
    m.component.$set({ onConfirm: () => { void m.ctl.confirm(() => new Promise<void>((_, reject) => { fail = reject; }), dayjs(), "Untitled"); } });
    begin(m.ctl); await tick();
    const input = m.container.querySelector<HTMLInputElement>(".ppp-date-field__text")!;
    input.focus(); await fireEvent.input(input, { target: { value: "03.11.2026 12:00" } });
    input.setSelectionRange(0, 10);
    await fireEvent.click(m.confirmButton()); await tick();
    expect(m.ctl.getState().draft?.start.format("YYYY-MM-DD HH:mm")).toBe("2026-11-03 12:00");
    expect(input.readOnly).toBe(true); expect(input.disabled).toBe(false);
    expect(input.ownerDocument.activeElement).toBe(input); expect([input.selectionStart, input.selectionEnd]).toEqual([0, 10]);
    fail(new Error("disk busy")); await tick(); await tick();
    expect(m.container.querySelector(".ppp-date-field__text")).toBe(input); expect(input.value).toBe("03.11.2026 12:00");
  });

  it("an IME composition neither confirms nor discards", async () => {
    const m = mount();
    begin(m.ctl);
    await tick();
    await key(m.nameInput(), "Enter", { isComposing: true });
    await key(m.nameInput(), "Escape", { isComposing: true });
    await tick();
    expect(m.onConfirm).not.toHaveBeenCalled();
    expect(m.ctl.getState().draft).not.toBeNull();
  });

  it("Enter in the name confirms once with the typed name", async () => {
    const m = mount();
    begin(m.ctl);
    await tick();
    await fireEvent.input(m.nameInput(), { target: { value: "Standup" } });
    await key(m.nameInput(), "Enter");
    expect(m.onConfirm).toHaveBeenCalledTimes(1);
    expect(m.ctl.getState().draft?.name).toBe("Standup");
  });

  it("Escape restores an edited name first, then discards the draft", async () => {
    const m = mount();
    begin(m.ctl);
    await tick();
    await fireEvent.focus(m.nameInput());
    await fireEvent.input(m.nameInput(), { target: { value: "Typo" } });
    await key(m.nameInput(), "Escape");
    await tick();
    expect(m.ctl.getState().draft).not.toBeNull();
    await key(m.nameInput(), "Escape");
    await tick();
    expect(m.ctl.getState().draft).toBeNull();
  });
});

describe("CalendarDraftSheet — writing", () => {
  it("explains a computed time mapping instead of saving a note without its chosen date", async () => {
    const m = mount();
    begin(m.ctl, { mapping: draftMapping({ config: { startDateField: "calculated" }, fields: [
      { name: "calculated", type: DataFieldType.Date, repeated: false, identifier: false, derived: true },
    ] }) });
    await tick();
    expect(m.confirmButton()).toBeDisabled();
    expect(m.container.querySelector('[role="alert"]')).not.toBeNull();
    const dates = Array.from(m.container.querySelectorAll<HTMLInputElement>("input.ppp-date-field__text"));
    expect(dates).toHaveLength(2);
    expect(dates.every((input) => input.disabled)).toBe(true);
    await fireEvent.click(m.confirmButton());
    expect(m.onConfirm).not.toHaveBeenCalled();
  });
  it("leaves untouched template properties inherited, with a mixed completion state", async () => {
    const m = mount();
    begin(m.ctl, { templatePath: "Template.md" });
    await tick();
    expect(m.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.indeterminate).toBe(true);
    await fireEvent.click(m.confirmButton());
    expect(m.onConfirm).toHaveBeenCalledTimes(1);
    expect(m.ctl.getState().draft?.edited).toEqual([]);
    expect(m.ctl.getState().draft?.revision).toBe(0);
  });
  it("captures an unblurred textual status when ✓ is pressed", async () => {
    const m = mount();
    begin(m.ctl, { mapping: draftMapping({ config: { statusField: "stage" }, fields: [] }) });
    await tick();
    const input = m.container.querySelector<HTMLInputElement>('input[id$="-status"]')!;
    await fireEvent.input(input, { target: { value: "Active" } });
    await fireEvent.click(m.confirmButton());
    expect(m.onConfirm).toHaveBeenCalledTimes(1);
    expect(m.ctl.getState().draft?.status).toBe("Active");
  });
  it("a refusal is shown beside the form and the typed values stay", async () => {
    const m = mount();
    begin(m.ctl);
    await tick();
    await fireEvent.input(m.nameInput(), { target: { value: "Kept" } });
    await fireEvent.blur(m.nameInput());
    expect(await m.ctl.confirm(() => Promise.reject(new Error("vault refused")), dayjs(), "Untitled")).toBe("failed");
    await tick();
    expect(m.sheet()).not.toBeNull();
    expect(m.container.querySelector('[role="alert"]')).not.toBeNull();
    expect(m.nameInput().value).toBe("Kept");
    expect(m.confirmButton()).not.toBeDisabled();
  });

  it("Enter retries the same name after an asynchronous refusal without editing it again", async () => {
    const m = mount(), save = jest.fn().mockRejectedValueOnce(new Error("disk busy")).mockResolvedValue(undefined);
    const confirm = jest.fn(() => { void m.ctl.confirm(save, dayjs(), "Untitled"); });
    m.component.$set({ onConfirm: confirm }); begin(m.ctl); await tick();
    m.nameInput().focus(); await fireEvent.input(m.nameInput(), { target: { value: "Kept" } });
    await key(m.nameInput(), "Enter"); await tick(); await tick();
    expect(m.ctl.getState().error).toBe("disk busy"); expect(m.nameInput().value).toBe("Kept");
    await key(m.nameInput(), "Enter"); await tick(); await tick();
    expect(save).toHaveBeenCalledTimes(2); expect(m.ctl.getState().draft).toBeNull();
  });

  it("✓ is off while the note is written: a second press does nothing", async () => {
    const m = mount();
    begin(m.ctl);
    await tick();
    let finish!: () => void;
    const pending = m.ctl.confirm(() => new Promise<void>((resolve) => (finish = resolve)), dayjs(), "Untitled");
    await tick();
    expect(m.confirmButton()).toBeDisabled();
    expect(m.sheet()).toHaveAttribute("aria-busy", "true");
    const discard = m.container.querySelector<HTMLButtonElement>(".ppp-draft-sheet__bar button")!;
    expect(discard).toBeDisabled();
    await fireEvent.click(discard);
    await key(m.nameInput(), "Escape");
    expect(m.ctl.getState().saving).toBe(true);
    expect(m.ctl.getState().draft).not.toBeNull();
    await fireEvent.click(m.confirmButton());
    expect(m.onConfirm).not.toHaveBeenCalled();
    finish();
    expect(await pending).toBe("saved");
    await tick();
    expect(m.sheet()).toBeNull();
  });

  it("a name the create window would refuse keeps ✓ off and says why", async () => {
    const m = mount({ nameProblem: (fileName: string) => (fileName === "Taken" ? "name-taken" : "") });
    begin(m.ctl);
    await tick();
    await fireEvent.input(m.nameInput(), { target: { value: "Taken" } });
    await tick();
    expect(m.confirmButton()).toBeDisabled();
    expect(m.container.textContent).toContain("name-taken");
    await fireEvent.click(m.confirmButton());
    expect(m.onConfirm).not.toHaveBeenCalled();
  });
});
