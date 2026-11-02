import { DataFieldType } from "src/lib/dataframe/dataframe";
import { resolveCalendarColorField, withColorField } from "../colorField";
import { draftMapping, createCalendarDraft, draftPayload } from "../draft/calendarDraft";
import dayjs from "dayjs";

const view = (name: string, type = "calendar") => ({ type, config: { eventColorField: name } });
it("uses this view's exact property before any project mapping", () => {
  expect(resolveCalendarColorField({ eventColorField: "Color" }, [view("color")])).toBe("Color");
});
it("inherits a single explicit project mapping for an unconfigured sibling or embedded calendar", () => {
  expect(resolveCalendarColorField({ interval: "week" }, [view("color"), view("color"), view("unrelated", "board")])).toBe("color");
});
it("uses the documented default only when the project has no mapping", () => {
  expect(resolveCalendarColorField(undefined, [])).toBe("eventColor");
});
it("requires an explicit choice for conflicting project keys, including different case", () => {
  expect(resolveCalendarColorField({}, [view("color"), view("Color")])).toBeUndefined();
});
it.each([DataFieldType.Number, DataFieldType.Boolean, DataFieldType.Date])("does not overwrite a %s property as a color", type => {
  expect(resolveCalendarColorField({ eventColorField: "tint" }, [], [{ name: "tint", type, repeated: false, derived: false, identifier: false }])).toBeUndefined();
});
it("refuses computed and identity properties", () => {
  for (const flags of [{ derived: true, identifier: false }, { derived: false, identifier: true }]) {
    expect(resolveCalendarColorField({ eventColorField: "tint" }, [], [{ name: "tint", type: DataFieldType.String, repeated: false, ...flags }])).toBeUndefined();
  }
});

it("an invalid mapping cannot leak back through create defaults", () => {
  const config = { eventColorField: "amount" };
  const resolved = resolveCalendarColorField(config, [], [{ name: "amount", type: DataFieldType.Number, repeated: false, derived: false, identifier: false }]);
  const effective = withColorField(config, resolved);
  const ctl = createCalendarDraft();
  ctl.begin({ owner: "p", day: dayjs("2026-11-03"), durationMinutes: 60,
    name: "new", templatePath: "", prefill: { amount: 42 }, mapping: draftMapping({ config: effective, fields: [] }) });
  const payload = draftPayload(ctl.getState().draft!, dayjs("2026-11-03"), "Untitled");
  expect(payload.values["amount"]).toBe(42);
  expect(payload.defaults).not.toHaveProperty("amount");
  expect(config.eventColorField).toBe("amount");
  ctl.destroy();
});
