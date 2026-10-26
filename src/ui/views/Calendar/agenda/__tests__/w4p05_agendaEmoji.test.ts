/**
 * w4-p05 (audit F10, P11a) — the agenda's emoji are emoji, and an icon saved
 * from the broken picker is shown as the emoji it was.
 *
 * The oracle for "broken" is Node's own Windows-1251 decoder, not the table the
 * repair uses.
 *
 * Why these fail on the old code: the picker's list was the broken runs of
 * Cyrillic letters (no button shows a pictograph, and two repeated), and a
 * stored broken value was shown as stored.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";
import { TextDecoder as NodeTextDecoder } from "util";
import { findCp1251Readings, undoCp1251Reading } from "src/lib/text/cp1251";

const AgendaIconPicker = require("../AgendaIconPicker.svelte").default;

const PICTOGRAPH = /\p{Extended_Pictographic}/u;
const asCp1251 = (text: string) => new NodeTextDecoder("windows-1251").decode(Buffer.from(text, "utf8"));

function pickerEmojis(currentIcon?: { type: string; value: string }) {
  const target = document.createElement("div");
  document.body.append(target);
  const picker = new AgendaIconPicker({ target, props: { currentIcon } });
  const buttons = Array.from(target.querySelectorAll<HTMLButtonElement>(".icon-btn.emoji"));
  return { picker, buttons };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("w4-p05 — the picker's emoji", () => {
  test("every emoji button shows a pictograph, once, with no broken text", () => {
    const { picker, buttons } = pickerEmojis();
    const texts = buttons.map((b) => b.textContent?.trim() ?? "");
    expect(texts).toHaveLength(48);
    for (const text of texts) {
      expect(text).toMatch(PICTOGRAPH);
      expect(findCp1251Readings(text)).toEqual([]);
    }
    expect(new Set(texts).size).toBe(texts.length);
    picker.$destroy();
  });

  test("a list saved with a broken emoji shows it selected as the emoji it was", async () => {
    const { picker, buttons } = pickerEmojis({ type: "emoji", value: asCp1251("🔥") });
    await tick();
    const fire = buttons.find((b) => b.textContent?.trim() === "🔥")!;
    expect(fire).toHaveClass("selected");
    expect(buttons.filter((b) => b.classList.contains("selected"))).toHaveLength(1);
    picker.$destroy();
  });
});

describe("w4-p05 — reading back stored values", () => {
  const { agendaEmoji, AGENDA_EMOJIS } = require("../agendaEmoji");

  test("each emoji's broken form is read back as the emoji", () => {
    for (const emoji of AGENDA_EMOJIS as string[]) {
      const broken = asCp1251(emoji);
      expect(broken).not.toBe(emoji);
      expect(agendaEmoji(broken)).toBe(emoji);
      expect(agendaEmoji(emoji)).toBe(emoji);
    }
  });

  test("any other value is shown as stored", () => {
    for (const value of ["Где", "★", "x", "", "Привет мир", "→"]) expect(agendaEmoji(value)).toBe(value);
    expect(undoCp1251Reading("plain")).toBeNull();
  });
});
