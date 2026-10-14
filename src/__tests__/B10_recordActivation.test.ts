/**
 * B10 — one record opens the same way on every surface ("like Notion").
 *
 * The gallery (B9) and the dashboard table already open a record in the peek on
 * a plain activation. B10 brings the calendar (event in any scale, agenda row,
 * the day window's list) and the board (card tap) onto the same path:
 *
 *   plain → `openRecord(…, "peek")`, carrying `readonly` from the source;
 *   Shift → window; Ctrl/Meta → tab.
 *
 * `activateRecord` is that rule in one place; the wiring checks below pin that
 * the calendar and the board route their plain activation through it and keep
 * the old editor (EditNoteModal) as an explicit menu entry only.
 */

import * as fs from "fs";
import * as path from "path";

jest.mock("src/lib/stores/recordPeek", () => ({ openPeek: jest.fn() }));

import { activateRecord } from "src/lib/record/openRecord";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

function deps() {
  const openLinkText = jest.fn(() => Promise.resolve());
  const peek = jest.fn();
  // Only the workspace method is touched by openRecord.
  const app = { workspace: { openLinkText } } as unknown as import("obsidian").App;
  return { app, peek, openLinkText };
}

const ev = (init: Partial<MouseEvent> = {}) =>
  ({ shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...init }) as MouseEvent;

describe("B10 — activateRecord: the one rule for a record activation", () => {
  it("a plain activation opens the peek with the record id", async () => {
    const d = deps();
    await activateRecord({ id: "Notes/a.md" }, ev(), d);
    expect(d.peek).toHaveBeenCalledWith(expect.objectContaining({ id: "Notes/a.md" }));
    expect(d.openLinkText).not.toHaveBeenCalled();
  });

  it("no event at all (a touch handed up without one) is a plain activation", async () => {
    const d = deps();
    await activateRecord({ id: "a.md" }, undefined, d);
    expect(d.peek).toHaveBeenCalledTimes(1);
  });

  it("Shift opens a window, Ctrl or Meta a tab — the shipped modifiers", async () => {
    const d = deps();
    await activateRecord({ id: "a.md" }, ev({ shiftKey: true }), d);
    expect(d.openLinkText).toHaveBeenLastCalledWith("a.md", "a.md", "window");
    await activateRecord({ id: "a.md" }, ev({ ctrlKey: true }), d);
    expect(d.openLinkText).toHaveBeenLastCalledWith("a.md", "a.md", "tab");
    await activateRecord({ id: "a.md" }, ev({ metaKey: true }), d);
    expect(d.openLinkText).toHaveBeenLastCalledWith("a.md", "a.md", "tab");
    expect(d.peek).not.toHaveBeenCalled();
  });

  it("a read-only source opens a read-only peek", async () => {
    const d = deps();
    await activateRecord({ id: "a.md", readonly: true }, ev(), d);
    expect(d.peek).toHaveBeenCalledWith(expect.objectContaining({ id: "a.md", readonly: true }));
  });
});

/** The body of `function name(` … up to the next top-level function. */
function fnBody(code: string, name: RegExp): string {
  const m = name.exec(code);
  if (!m) return "";
  const rest = code.slice(m.index);
  const next = rest.slice(1).search(/\n {2}(?:function |const \w+\s*[:=])/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

describe("B10 — the calendar routes every plain activation to the peek", () => {
  const view = read("ui/views/Calendar/CalendarView.svelte");

  it("handleRecordClick opens through activateRecord with the source's read-only flag", () => {
    const body = fnBody(view, /function handleRecordClick\(/);
    expect(body).toMatch(/activateRecord\(/);
    expect(body).toMatch(/readonly:\s*dataReadOnly\s*\|\|\s*readonly/);
    expect(body).not.toMatch(/EditNoteModal/);
  });

  it("the agenda hands its event up, so modifiers reach the same rule", () => {
    const body = fnBody(view, /function handleAgendaRecordClick\(/);
    expect(body).toMatch(/activateRecord\(/);
    const sidebar = read("ui/views/Calendar/components/Timeline/AgendaSidebar.svelte");
    expect(sidebar).not.toMatch(/dispatch\('openInNewWindow'/);
    expect(sidebar).toMatch(/onRecordClick\?\.\(id, event\)/);
  });

  it("the old editor stays, as the day window's settings entry only", () => {
    expect(view.match(/new EditNoteModal\(/g)).toHaveLength(1);
    expect(fnBody(view, /function handleDayPopupRecordSettings\(/)).toMatch(/new EditNoteModal\(/);
  });
});

describe("B10 — the board card opens the peek; the pencil keeps the editor", () => {
  const view = read("ui/views/Board/BoardView.svelte");

  it("handleRecordClick opens through activateRecord with the read-only flag", () => {
    const m = /const handleRecordClick[^=]*=\s*\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\n {2}\};/.exec(view);
    expect(m?.[2]).toMatch(/activateRecord\(/);
    expect(m?.[2]).toMatch(/readonly:\s*dataReadOnly\s*\|\|\s*readonly/);
    expect(m?.[2]).not.toMatch(/EditNoteModal/);
  });

  it("the editor is a separate handler handed to the cards", () => {
    expect(view).toMatch(/const handleRecordEdit/);
    expect(view).toMatch(/onRecordEdit=\{handleRecordEdit\}/);
  });
});

describe("B10 — the decision record in openRecord.ts is current", () => {
  it("names the 14.10.2026 revision", () => {
    const code = read("lib/record/openRecord.ts");
    expect(code).toMatch(/2026-10-14/);
  });
});
