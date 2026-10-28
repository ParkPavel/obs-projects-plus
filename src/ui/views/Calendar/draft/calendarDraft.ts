/**
 * w4-calendar-draft (report 27.10, R06/R07) — the event a hold, a drag or a
 * click on the time grid creates BEFORE anything is written.
 *
 * Release used to open the create window and write at once. Now it opens a
 * draft: the calendar draws it as a temporary record, the same finger (or the
 * mouse) can still move and stretch it behind the bottom form, and one explicit
 * confirm writes exactly one note. Cancel, Escape, a project or mapping change
 * and the end of the view write nothing.
 *
 * Pure apart from the store: CalendarView hands in the mapping and the save,
 * this module decides the values. A move goes through the same
 * `buildRecordChangeUpdates` a stored event's drag does, so a draft and a note
 * answer a drag the same way.
 *
 * ## Sessions
 *
 * Every draft has a session number. A save remembers it; when it settles and
 * the current draft is another one (cancelled, replaced, the view destroyed),
 * the late result changes nothing.
 */
import dayjs from "dayjs";
import { writable, type Readable } from "svelte/store";

import type { DataField, DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
import { toNumber } from "src/lib/engine/numeric";
import { buildRecordChangeUpdates } from "../dnd/recordChangeUpdates";
import { DND_CONSTANTS, type RecordChangeOptions } from "../dnd/types";
import type { CalendarConfig } from "../types";

type Dayjs = dayjs.Dayjs;
type Values = Record<string, Optional<DataValue>>;

const DAY = "YYYY-MM-DD";
const CLOCK = "HH:mm";
const LEADING_DAY = /^\d{4}-\d{2}-\d{2}\s*/;

/** Never a vault path: no note can be opened, renamed or deleted under it. */
export const DRAFT_ID_PREFIX = "ppp-calendar-draft://";

export function isDraftId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith(DRAFT_ID_PREFIX);
}

/** The view's field names a draft writes, resolved the way the calendar reads them. */
export interface DraftMapping {
  readonly start: string;
  readonly end: string;
  readonly startTime: string;
  readonly endTime: string;
  /** The note's creation date: today, never the event's start. */
  readonly creation?: string | undefined;
  readonly color?: string | undefined;
  readonly icon?: string | undefined;
  /** The done checkbox (checkField): the status the calendar already shows. */
  readonly check?: string | undefined;
  readonly status?: string | undefined;
  /** Computed fields: shown, never written. */
  readonly computed: readonly string[];
}

export interface DraftMappingInput {
  config: CalendarConfig | undefined;
  fields: readonly DataField[];
  /** The start field CalendarView resolved (configured, common name or first date). */
  start?: string | undefined;
  end?: string | undefined;
  creation?: string | undefined;
  check?: string | undefined;
}

export function draftMapping({ config, fields, start, end, creation, check }: DraftMappingInput): DraftMapping {
  const startName = start ?? (config?.startDateField || "startDate");
  return {
    start: startName,
    end: end ?? (config?.endDateField || "endDate"),
    startTime: config?.startTimeField || "startTime",
    endTime: config?.endTimeField || "endTime",
    creation: creation && creation !== startName && creation !== "name" ? creation : undefined,
    color: config?.eventColorField || undefined,
    icon: config?.iconField || undefined,
    check: check ?? (config?.checkField || undefined),
    status: config?.statusField || undefined,
    computed: fields.filter((f) => f.derived).map((f) => f.name),
  };
}

/** One key per mapping: a draft begun under another mapping is not this view's. */
export function mappingKey(m: DraftMapping): string {
  return JSON.stringify([m.start, m.end, m.startTime, m.endTime, m.creation, m.color, m.icon, m.check, m.status, m.computed]);
}

/** Different values cannot be safely written into the same property. */
export function conflictingDraftFields(m: DraftMapping): string[] {
  const names = [m.start, m.end, m.startTime, m.endTime, m.creation, m.check, m.status, m.color, m.icon].filter((n): n is string => !!n);
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

export interface CalendarDraft {
  readonly session: number;
  /** Grows on every change; with the session it keys the calendar's cache. */
  readonly revision: number;
  /** The project and mapping it was begun under. */
  readonly owner: string;
  readonly start: Dayjs;
  readonly end: Dayjs;
  readonly name: string;
  readonly templatePath: string;
  readonly color: string;
  readonly icon: string;
  readonly done: boolean;
  readonly status: string;
  /** The view's defaults (filter prefill), written under the mapped values. */
  readonly prefill: Values;
  readonly mapping: DraftMapping;
}

/** `HH:mm` (24:00 included) on `day`, past midnight rolling into the next day. */
export function clockOn(day: Dayjs, clock: string): Dayjs {
  const [h = 0, m = 0] = clock.split(":").map((part) => toNumber(part) ?? 0);
  return day.startOf("day").add(h * 60 + m, "minute");
}

/** The four time values in the separate model the calendar reads and writes. */
function timeValues(start: Dayjs, end: Dayjs, m: DraftMapping): Record<string, string> {
  return {
    [m.start]: start.format(DAY),
    [m.startTime]: start.format(CLOCK),
    [m.end]: end.format(DAY),
    [m.endTime]: end.format(CLOCK),
  };
}

const minEnd = (start: Dayjs) => start.add(DND_CONSTANTS.MIN_DURATION_MINUTES, "minute");

/**
 * Where a move or a resize puts the draft: the stored-event builder decides the
 * values, which are read back. A bottom resize keeps the end on the day it was
 * on (the builder, writing a stored note, puts it on the start's day); an end
 * that still lands on or before the start becomes the shortest event.
 */
export function movedRange(
  draft: Pick<CalendarDraft, "start" | "end" | "mapping">,
  date: Dayjs,
  options?: RecordChangeOptions
): { start: Dayjs; end: Dayjs } {
  const m = draft.mapping;
  const values = timeValues(draft.start, draft.end, m);
  const { updates } = buildRecordChangeUpdates({
    values,
    dateFieldName: m.start,
    endDateFieldName: m.end,
    startTimeFieldName: m.startTime,
    endTimeFieldName: m.endTime,
    targetDate: date.startOf("day"),
    options,
    originalStart: draft.start,
    originalEnd: draft.end,
  });
  const next = { ...values, ...updates };
  // The builder writes `YYYY-MM-DD`, which dayjs reads as a local day.
  const read = (dayName: string, clockName: string) => clockOn(dayjs(next[dayName]), next[clockName] ?? "00:00");
  const start = read(m.start, m.startTime);
  let end = read(m.end, m.endTime);
  if (options?.endTime && !options.startTime && !options.endDate) {
    const shift = start.startOf("day").diff(draft.start.startOf("day"), "day");
    end = clockOn(draft.end.add(shift, "day"), options.endTime);
  }
  if (!end.isAfter(start)) end = minEnd(start);
  return { start, end };
}

/** The file name when the start is stored in it: the day first, once. */
export function nameWithDay(name: string, day: Dayjs, untitled: string): string {
  const prefix = day.format(DAY);
  const rest = name.trim().replace(LEADING_DAY, "");
  return rest && rest !== untitled ? `${prefix} ${rest}` : prefix;
}

/** The name the note is created under. */
export function draftFileName(draft: CalendarDraft, untitled: string): string {
  return draft.mapping.start === "name" ? nameWithDay(draft.name, draft.start, untitled) : draft.name.trim();
}

/** The temporary record the calendar draws. Its id is not a path and ends in a title. */
export function draftRecord(draft: CalendarDraft, untitled: string): DataRecord {
  const m = draft.mapping;
  const values: Values = { ...draft.prefill, ...timeValues(draft.start, draft.end, m) };
  // The start stored in the name is read from the title in the id, as a note's file name is.
  if (m.start === "name") delete values["name"];
  if (m.color) values[m.color] = draft.color || null;
  if (m.icon) values[m.icon] = draft.icon.trim() || null;
  if (m.check) values[m.check] = draft.done;
  if (m.status) values[m.status] = draft.status || null;
  const title = (draftFileName(draft, untitled) || untitled).replace(/[\\/]/g, " ");
  return { id: `${DRAFT_ID_PREFIX}${draft.session}/${title}.md`, values };
}

export interface DraftPayload {
  readonly name: string;
  readonly templatePath: string;
  readonly values: Values;
}

/**
 * What confirm writes: the defaults, then start/end date and time (written even
 * when the frame has no such field yet), the creation date as today, the done
 * state as a boolean (false included), colour and icon when set. Nothing
 * computed is written, a default included.
 */
export function draftPayload(draft: CalendarDraft, today: Dayjs, untitled: string): DraftPayload {
  const m = draft.mapping;
  const values: Values = { ...draft.prefill, ...timeValues(draft.start, draft.end, m) };
  if (m.start === "name") delete values["name"];
  if (m.creation) values[m.creation] = today.format(DAY);
  if (m.check) values[m.check] = draft.done;
  if (m.status) values[m.status] = draft.status || null;
  if (m.color) values[m.color] = draft.color || null;
  if (m.icon) values[m.icon] = draft.icon.trim() || null;
  for (const name of m.computed) delete values[name];
  return { name: draftFileName(draft, untitled), templatePath: draft.templatePath, values };
}

export interface DraftBegin {
  readonly owner: string;
  readonly day: Dayjs;
  readonly startTime: string;
  /** The end chosen on the grid; without it the view's creation length applies. */
  readonly endTime?: string | undefined;
  readonly durationMinutes: number;
  readonly name: string;
  readonly templatePath: string;
  readonly prefill: Values;
  readonly mapping: DraftMapping;
}

export type DraftEdit = Partial<Pick<CalendarDraft, "name" | "templatePath" | "color" | "icon" | "done" | "status">>;

export interface DraftState {
  readonly draft: CalendarDraft | null;
  readonly saving: boolean;
  /** The last refusal, shown beside the form until the next try. */
  readonly error: string | null;
}

export type ConfirmResult = "saved" | "failed" | "busy" | "stale" | "none" | "invalid";

export interface CalendarDraftController extends Readable<DraftState> {
  getState(): DraftState;
  owns(id: string): boolean;
  begin(input: DraftBegin): CalendarDraft | null;
  move(date: Dayjs, options?: RecordChangeOptions): void;
  edit(fields: DraftEdit): void;
  /** A new start keeps the length; the end follows it. */
  setStart(start: Dayjs): void;
  /** An end on or before the start becomes the shortest event after it. */
  setEnd(end: Dayjs): void;
  cancel(): void;
  confirm(save: (payload: DraftPayload, draft: CalendarDraft) => Promise<unknown>, today: Dayjs, untitled: string): Promise<ConfirmResult>;
  destroy(): void;
}

/** A stale gesture must not edit a replacement draft or reach a file API. */
export function interceptDraft(id: unknown, controller: CalendarDraftController, action: () => void): boolean {
  if (typeof id !== "string" || !isDraftId(id)) return false;
  if (controller.owns(id)) action();
  return true;
}

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

export function createCalendarDraft(): CalendarDraftController {
  let state: DraftState = { draft: null, saving: false, error: null };
  let sessions = 0;
  let alive = true;
  const store = writable<DraftState>(state);
  const set = (next: DraftState) => {
    state = next;
    store.set(next);
  };
  /** The current draft when it may change: there is one and it is not being written. */
  const editable = () => (alive && !state.saving ? state.draft : null);
  const change = (draft: CalendarDraft, fields: Partial<CalendarDraft>) =>
    set({ draft: { ...draft, ...fields, revision: draft.revision + 1 }, saving: false, error: state.error });

  return {
    subscribe: store.subscribe,
    getState: () => state,
    owns: (id) => alive && !!state.draft && id.startsWith(`${DRAFT_ID_PREFIX}${state.draft.session}/`),

    begin(input) {
      if (!alive || state.saving) return null;
      const start = clockOn(input.day, input.startTime);
      let end = input.endTime ? clockOn(input.day, input.endTime) : start.add(input.durationMinutes, "minute");
      if (!end.isAfter(start)) end = input.endTime ? end.add(1, "day") : minEnd(start);
      if (!end.isAfter(start)) end = minEnd(start);
      const prior = state.draft?.owner === input.owner ? state.draft : null;
      // Holding elsewhere while a draft is open moves it: what was typed stays.
      if (prior) {
        change(prior, { start, end });
        return state.draft;
      }
      sessions += 1;
      const { prefill, mapping } = input;
      const draft: CalendarDraft = {
        session: sessions,
        revision: 0,
        owner: input.owner,
        start,
        end,
        name: input.name,
        templatePath: input.templatePath,
        color: mapping.color ? textOf(prefill[mapping.color]) : "",
        icon: mapping.icon ? textOf(prefill[mapping.icon]) : "",
        done: mapping.check ? prefill[mapping.check] === true : false,
        status: mapping.status ? textOf(prefill[mapping.status]) : "",
        prefill,
        mapping,
      };
      set({ draft, saving: false, error: null });
      return draft;
    },

    move(date, options) {
      const draft = editable();
      if (draft) change(draft, movedRange(draft, date, options));
    },

    edit(fields) {
      const draft = editable();
      if (draft) change(draft, fields);
    },

    setStart(start) {
      const draft = editable();
      if (draft) change(draft, { start, end: start.add(draft.end.diff(draft.start, "minute"), "minute") });
    },

    setEnd(end) {
      const draft = editable();
      if (draft) change(draft, { end: end.isAfter(draft.start) ? end : minEnd(draft.start) });
    },

    cancel() {
      if (state.draft || state.saving) set({ draft: null, saving: false, error: null });
    },

    async confirm(save, today, untitled) {
      const draft = state.draft;
      if (!alive || !draft) return "none";
      if (state.saving) return "busy";
      if (conflictingDraftFields(draft.mapping).length) return "invalid";
      const session = draft.session;
      set({ draft, saving: true, error: null });
      const current = () => alive && state.draft?.session === session;
      try {
        await save(draftPayload(draft, today, untitled), draft);
      } catch (error) {
        if (!current()) return "stale";
        set({ draft: state.draft, saving: false, error: error instanceof Error ? error.message : String(error) });
        return "failed";
      }
      if (!current()) return "stale";
      set({ draft: null, saving: false, error: null });
      return "saved";
    },

    destroy() {
      alive = false;
      set({ draft: null, saving: false, error: null });
    },
  };
}
