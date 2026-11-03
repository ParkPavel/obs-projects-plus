import "@testing-library/jest-dom";
import { comboInputs, enter, mountCollecting, optionRows, settle, tap, typeInto } from "./support/comboKit";

const OptionField = require("../OptionField.svelte").default;
const choices = [{ id: "status-key", label: "Статус" }, { id: "Status-key", label: "Состояние" }];
function mount() { return mountCollecting<string>(OptionField, { value: "status-key", options: choices, contextKey: "note-a" }, "change"); }

test("the original query chooses the exact canonical ID and keeps its input, caret and focus across refresh", async () => {
  const m = mount(); const input = comboInputs(m.target)[0]!;
  try {
    await enter(input); typeInto(input, "сост"); await settle(); input.setSelectionRange(2, 2);
    m.component.$set({ options: [...choices] }); await settle();
    expect(comboInputs(m.target)[0]).toBe(input); expect(document.activeElement).toBe(input);
    expect(input.value).toBe("сост"); expect(input.selectionStart).toBe(2);
    tap(optionRows()[0]!); await settle(); input.blur();
    expect(m.events).toEqual(["Status-key"]); expect(input.value).toBe("Состояние");
  } finally { m.destroy(); }
});

test.each(["context", "disabled", "removed-option"])("a still-mounted old row cannot commit after %s changes before the next flush", async change => {
  const m = mount(); const input = comboInputs(m.target)[0]!;
  try {
    await enter(input); const row = optionRows()[1]!; expect(row).toBeDefined();
    m.component.$set(change === "context" ? { contextKey: "note-b" } : change === "disabled" ? { disabled: true } : { options: [choices[0]] });
    tap(row); await settle(); expect(m.events).toEqual([]);
    if (change === "context") expect(comboInputs(m.target)[0]).not.toBe(input);
  } finally { m.destroy(); }
});

test("removing the owner retires a query without choosing its sole matching suggestion", async () => {
  const m = mount(); const input = comboInputs(m.target)[0]!; await enter(input);
  typeInto(input, "Состояние"); await settle(); m.destroy(); await settle(); expect(m.events).toEqual([]);
});
