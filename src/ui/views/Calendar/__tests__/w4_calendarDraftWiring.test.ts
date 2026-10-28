/**
 * w4-calendar-draft — how CalendarView wires the draft. Mounting the whole
 * calendar engine for this is not worth its weight; the behaviour lives in
 * `draft/calendarDraft.ts` and its tests. These pins keep the doors of the view
 * shut: a time on the grid opens a draft and writes nothing, ✓ is the one write,
 * and every path that would touch a note by id recognises the draft first.
 */
import * as fs from "fs";
import * as path from "path";

const CALENDAR = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(CALENDAR, rel), "utf8");
const view = read("CalendarView.svelte");

/** The body of `function name(` up to the next top-level function of the script. */
function fnBody(code: string, signature: RegExp): string {
  const m = signature.exec(code);
  if (!m) throw new Error(`not found: ${signature}`);
  const rest = code.slice(m.index);
  const next = rest.slice(1).search(/\n {2}(?:async function |function |const \w+\s*[:=]|\$:)/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

describe("a time on the grid opens a draft, not a note", () => {
  const add = fnBody(view, /function handleRecordAdd\(/);

  it("handleRecordAdd hands a timed creation to the draft before the create window, on writable data only", () => {
    const draft = add.search(/if \(startTime && !readonly && !dataReadOnly\) \{\s*beginDraft\(date, startTime, endTime\);\s*return;/);
    expect(draft).toBeGreaterThanOrEqual(0);
    expect(draft).toBeLessThan(add.indexOf("new CreateNoteModal("));
  });

  it("beginning a draft writes nothing", () => {
    const begin = fnBody(view, /function beginDraft\(/);
    expect(begin).toMatch(/draftCtl\.begin\(/);
    expect(begin).not.toMatch(/api\.|addRecord|updateRecord|vault\./);
  });

  it("✓ is the draft's one write, through the view API's complete create", () => {
    const confirm = fnBody(view, /async function confirmDraft\(/);
    expect(confirm).toMatch(/if \(dataReadOnly \|\| readonly\) return;/);
    expect(confirm).toMatch(/draftCtl\.confirm\(/);
    expect(confirm.match(/api\.addRecord\(createDataRecord\(name, project, values\), fields, templatePath\)/g)).toHaveLength(1);
  });

  it("the form is mounted only for a draft, in the view's own layout", () => {
    expect(view).toMatch(/\{#if draftState\.draft\}\s*<CalendarDraftSheet/);
    expect(view).toMatch(/onDestroy\(\(\) => draftCtl\.destroy\(\)\)/);
    expect(view).not.toMatch(/<CalendarDraftSheet[^>]*use:portal/);
  });
});

describe("the calendar draws the draft beside the notes", () => {
  it("the processed frame is the frame plus the draft, never the draft alone", () => {
    expect(view).toMatch(/displayFrame = shownDraft \? \{ \.\.\.frame, records: \[\.\.\.frame\.records, shownDraft\] \} : frame/);
    expect(view).toMatch(/updateProcessedData\(processedStartField, config, records, dataVersion, draftKey, displayFrame,/);
  });

  it("the cache key joins the data version and the draft revision as text, not as a sum", () => {
    const body = fnBody(view, /function updateProcessedData\(/);
    expect(body).toMatch(/const versionKey = `\$\{dv\}\|\$\{dk\}`;/);
    expect(body).toMatch(/versionKey !== lastProcessedKey/);
    expect(view).not.toMatch(/lastProcessedVersion/);
  });

  it("the agenda lists notes only", () => {
    expect(view).toMatch(/\$: agendaRecords = records;/);
  });
});

describe("every path that touches a note by id recognises the draft first", () => {
  it.each([
    ["drag-change", /async function handleRecordChange\(/, /draftCtl\.move\(date, options\)/],
    ["check", /function handleRecordCheck\(/, /draftCtl\.edit\(\{ done: checked \}\)/],
    ["popup check", /async function handleDayPopupRecordCheck\(/, /draftCtl\.edit\(\{ done: checked \}\)/],
    ["popup colour", /async function handleDayPopupRecordColorChange\(/, /draftCtl\.edit\(\{ color \}\)/],
    ["popup delete", /async function handleDayPopupRecordDelete\(/, /draftCtl\.cancel\(\)/],
  ])("%s: after the read-only guard, before any write", (_name, signature, branch) => {
    const body = fnBody(view, signature);
    const guard = body.indexOf("if (dataReadOnly) return;");
    const draft = body.search(/isDraftId\(record\??\.id\)/);
    const write = body.search(/\bapi\.|await |updateRecord\(/);
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(draft).toBeGreaterThan(guard);
    expect(body).toMatch(branch);
    if (write >= 0) expect(draft).toBeLessThan(write);
  });

  it.each([
    ["duplicate", /async function handleDayPopupRecordDuplicate\(/],
    ["duplicate request", /function handleDayPopupRecordDuplicateRequest\(/],
    ["open in a window", /function handleDayPopupRecordOpenInNewWindow\(/],
    ["peek", /function handleRecordClick\(/],
  ])("%s refuses a draft", (_name, signature) => {
    expect(fnBody(view, signature)).toMatch(/isDraftId\((record|entry)\.id\)/);
  });

  it("the day window is not handed the draft", () => {
    expect(fnBody(view, /function handleDayTap\(/)).toMatch(/records\.filter\(\(r\) => !isDraftId\(r\.id\)\)/);
  });

  it.each([
    "components/Calendar/EventBarContainer.svelte",
    "components/Calendar/Day.svelte",
    "components/Calendar/EventList.svelte",
    "components/Calendar/TimelineView.svelte",
  ])("%s does not open a draft in a tab or window", (file) => {
    const code = read(file);
    expect(code).toMatch(/import \{ isDraftId \} from ["']\.\.\/\.\.\/draft\/calendarDraft["']/);
    const at = code.search(/isDraftId\(/);
    const open = code.search(/void openRecord\(/);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(open);
  });
});
