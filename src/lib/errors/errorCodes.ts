/**
 * #202 — the error-code registry. Pure data, and deliberately importing nothing.
 *
 * The user asked for two things: that a message carry a short code they can
 * name, and that hovering it explain the cause. Underneath both is a third
 * thing they described as "упорядочить" — today one event is worded three
 * different ways across the notice, the standing mark and the console line, so
 * nothing can be matched to anything. Diagnosing #199 cost a day for exactly
 * that reason.
 *
 * ## Why this file has no imports at all
 *
 * Not style. `settingsWriter.ts` and the engine modules are unit-tested in
 * isolation and have no i18n dependency; naming a code must not drag the four
 * locale files and i18next into their test runs. That is the hazard
 * `headerChrome.ts` was carved out for, and its header names it precisely:
 * weight, not cycles. So resolution lives in `errorText.ts`, the console
 * formatter in `errorLog.ts`, and this file stays data.
 *
 * ## The code is a promise
 *
 * A code that has been shown to a user is public forever: it can appear in a
 * screenshot, a forum post or a bug report years later. A retired code is
 * therefore marked `status: "retired"` and keeps both its registry entry and
 * its section on the page — the same rule that keeps `DataTableConfig.subBases`
 * alive for data that was written once.
 *
 * ## Areas
 *
 * The area digit groups by what the USER was doing, not by which module threw.
 * Renaming a record fails the same way from three different files, and giving
 * that one event three numbers would recreate the problem this ticket exists
 * to remove.
 *
 *   1xx  settings and their persistence
 *   2xx  writing records
 *   3xx  acting on a record inside a view
 *   4xx  dashboard configuration
 *   5xx  relations
 *   6xx  onboarding and the demo project
 *   7xx  sources and filters
 *   9xx  unexpected — error boundaries
 */

/** What the message is: something broke, something is not ready, or a caution. */
export type ErrorKind = "failure" | "refusal" | "warning";

export interface ErrorCodeEntry {
  /** `PPP-104`. Stable forever once shown. */
  readonly code: string;
  readonly kind: ErrorKind;
  /** i18n key for the short caption shown in the notice and the mark. */
  readonly key: string;
  /** i18n key for the cause, revealed on hover. */
  readonly causeKey: string;
  /** English default for `key`, and the text the console line uses. */
  readonly caption: string;
  /** English default for `causeKey`. */
  readonly cause: string;
  /**
   * `retired` — no longer issued; the entry and its page section stay, so the
   * number can never be reused and an old screenshot stays legible.
   *
   * `pending` — reserved and documented, but no call site shows it yet. The
   * audit of step 3 is why this exists: a code that the page explains and
   * nothing can ever display is a promise to the user that no code keeps, and
   * without a marker the ratchet cannot tell that state from a wired one. The
   * markers come off area by area as steps 4-6 wire them.
   */
  readonly status?: "retired" | "pending";
}

/**
 * The area digits that may appear in a code, with what each one covers.
 * Pinned by R0.21 so a new area is a deliberate act rather than a typo.
 */
export const ERROR_AREAS: Readonly<Record<string, string>> = {
  "1": "settings and their persistence",
  "2": "writing records",
  "3": "acting on a record inside a view",
  "4": "dashboard configuration",
  "5": "relations",
  "6": "onboarding and the demo project",
  "7": "sources and filters",
  "9": "unexpected — error boundaries",
};

/**
 * Every code the plugin can show.
 *
 * Issued in one pass over the 43 live `new Notice(` sites in `src/`. Six of
 * them confirm a success and are deliberately absent: numbering "Demo project
 * created." would teach the reader that the token carries no information. The
 * remaining 37 sites collapse to the 30 entries below, because a code names an
 * event and not a call site — renaming a note fails identically from Board,
 * Gallery and two places in Calendar, and giving that one event four numbers
 * would recreate the confusion this registry exists to remove.
 *
 * `caption` is the English default for `key`, verbatim — R0.21 asserts the two
 * are the same string. That equality is the point rather than a tidiness rule:
 * `errorLog.ts` prints `caption` and the Notice resolves `key`, so it is what
 * makes the console line and the message on screen the same sentence carrying
 * the same token. It also means a caption is not free to be "nicer" than the
 * text that ships; changing one is changing both.
 */
export const ERROR_CODES: readonly ErrorCodeEntry[] = [
  {
    code: "PPP-101",
    kind: "failure",
    key: "save-status.failed.notice",
    causeKey: "errors.causes.settings-write-failed",
    caption:
      'Projects+: settings could not be written to disk. Your change is still here, but it will be lost on reload. Retry from the "Not saved" mark in the toolbar.',
    cause:
      "The write was accepted but data.json still holds the old value, so the change exists only in this session.",
  },
  {
    code: "PPP-102",
    kind: "warning",
    key: "save-status.superseded.notice",
    causeKey: "errors.causes.settings-superseded",
    caption:
      "Projects+: data.json was changed outside this window. Your latest change may not be saved — reopen the vault before making more.",
    cause:
      "Another window or a synchroniser replaced the file, so this window cannot tell whether its own change survived.",
  },
  {
    code: "PPP-103",
    kind: "failure",
    key: "errors.settingsUnreadable",
    causeKey: "errors.causes.settings-unreadable",
    caption: "The settings file could not be read; defaults are in use.",
    cause:
      "data.json could not be read or parsed, so the plugin started from defaults and left the file on disk untouched.",
  },
  {
    code: "PPP-104",
    kind: "failure",
    key: "errors.settingsCorrupted",
    causeKey: "errors.causes.settings-corrupted",
    caption: "The settings file is corrupted; defaults were restored.",
    cause:
      "data.json parsed but matched no known settings version, so there was nothing that could be migrated.",
  },
  {
    /**
     * #200 — memory and disk disagreed and the plugin refused to merge them.
     *
     * Distinct from PPP-102 on purpose. That one says a write could not be
     * confirmed; this one says a conflict was decided — memory kept, the other
     * version preserved beside the file. Same file, different events, and
     * collapsing them would leave the user unable to tell "your change may not
     * be saved" from "somebody else's change is in a file named here".
     */
    code: "PPP-105",
    kind: "warning",
    key: "save-status.conflict.notice",
    causeKey: "errors.causes.settings-conflict",
    caption:
      "Projects+: data.json was changed outside this window and could not be adopted. Your version is kept, and the one from disk was saved as {{path}}.",
    cause:
      "Another window, a synchroniser or a hand edit replaced data.json while this session held changes of its own, so neither version could be discarded.",
  },
  {
    /**
     * #200 — the same conflict, with the copy refused.
     *
     * A separate code rather than a softer wording of PPP-105, because the
     * user's next move is different and urgent: the other version exists only
     * as `data.json`, and this plugin's next ordinary save overwrites it. The
     * #195 rule applies one level up — a notice must never name a file that
     * was not written.
     */
    code: "PPP-106",
    kind: "failure",
    key: "save-status.conflict-uncopied.notice",
    causeKey: "errors.causes.settings-conflict-uncopied",
    caption:
      "Projects+: data.json was changed outside this window, and the other version could not be saved anywhere — not beside the file, not as a note in the vault. On desktop it is printed in the developer console. Nothing is being written over it until you change a setting yourself.",
    cause:
      "Both the copy beside data.json and the note in the vault failed to write, so the console line is the only remaining copy of the other version; this session's writing is held until your next change.",
  },
  {
    code: "PPP-201",
    kind: "failure",
    key: "errors.recordWriteFailed",
    causeKey: "errors.causes.record-write-failed",
    caption:
      "Could not save changes to {{path}}; the previous value was restored.",
    cause:
      "Writing the note's frontmatter failed, so the value on screen was rolled back to what is on disk.",
  },
  {
    code: "PPP-202",
    kind: "failure",
    key: "errors.recordsWriteFailed",
    causeKey: "errors.causes.records-write-failed",
    caption:
      "Could not save {{count}} record(s); the previous values were restored.",
    cause:
      "A batch write failed part way through, so every record in the batch was rolled back to what is on disk.",
  },
  {
    code: "PPP-203",
    kind: "failure",
    key: "errors.recordFileMissing",
    causeKey: "errors.causes.record-file-missing",
    caption: "{{path}} no longer exists; the change was not saved.",
    cause:
      "The note was renamed, moved or deleted after the view loaded it, so there was no file left to write to.",
  },
  {
    code: "PPP-204",
    kind: "failure",
    key: "errors.fieldWritePartial",
    causeKey: "errors.causes.field-write-partial",
    caption:
      "'{{field}}' was written to {{written}} notes; {{unwritten}} could not be updated. See the console for the list.",
    cause:
      "A new field is written into the project's notes one by one, and some of those writes did not succeed.",
  },
  {
    code: "PPP-301",
    kind: "failure",
    key: "errors.renameFailed",
    causeKey: "errors.causes.rename-failed",
    caption: "The note could not be renamed.",
    cause:
      "Obsidian refused the rename — usually the new name is already taken, or holds characters the file system does not allow.",
  },
  {
    code: "PPP-302",
    kind: "failure",
    key: "modals.note.edit.save-error",
    causeKey: "errors.causes.note-save-failed",
    caption: "Failed to save changes",
    cause:
      "The note editor could not write its changes back to the file, so what is on screen is ahead of what is on disk.",
  },
  {
    code: "PPP-303",
    kind: "failure",
    key: "views.calendar.errors.delete-failed",
    causeKey: "errors.causes.delete-failed",
    caption: "The note could not be deleted.",
    cause:
      "Deleting the file failed — it may be open elsewhere, read-only, or already gone.",
  },
  {
    code: "PPP-304",
    kind: "failure",
    key: "views.calendar.errors.duplicate-failed",
    causeKey: "errors.causes.duplicate-failed",
    caption: "The note could not be duplicated.",
    cause:
      "One of the copies could not be created, so the set of new notes is incomplete.",
  },
  {
    code: "PPP-305",
    kind: "failure",
    key: "views.calendar.errors.check-failed",
    causeKey: "errors.causes.check-failed",
    caption: "The checkbox could not be changed.",
    cause:
      "Writing the checkbox field back to the note failed, so the tick does not reflect the file.",
  },
  {
    code: "PPP-306",
    kind: "refusal",
    key: "views.calendar.errors.check-field-required",
    causeKey: "errors.causes.check-field-required",
    caption: "Choose a field for the checkboxes first.",
    cause:
      "The view has no boolean field assigned, so there is nothing for a tick to be written into.",
  },
  {
    code: "PPP-307",
    kind: "failure",
    key: "views.calendar.errors.date-change-failed",
    causeKey: "errors.causes.date-change-failed",
    caption: "The event date could not be changed.",
    cause:
      "Writing the new date back to the note failed, so the event stays where it was.",
  },
  {
    code: "PPP-308",
    kind: "refusal",
    key: "views.calendar.errors.date-required",
    causeKey: "errors.causes.date-field-required",
    caption: "Date field is required to create events",
    cause:
      "The view has no date field assigned, so an event has nothing to be placed by.",
  },
  {
    code: "PPP-309",
    kind: "refusal",
    key: "views.calendar.errors.date-invalid",
    causeKey: "errors.causes.date-invalid",
    caption: "That date cannot be used for this event.",
    cause:
      "The target date failed validation — it is outside the supported range, or it would put the end of the event before its start.",
  },
  {
    code: "PPP-310",
    kind: "refusal",
    key: "views.calendar.errors.record-invalid",
    causeKey: "errors.causes.record-invalid",
    caption: "This record cannot be moved.",
    cause:
      "The record is missing fields the calendar needs, so its new position cannot be worked out.",
  },
  {
    code: "PPP-311",
    kind: "failure",
    key: "views.calendar.errors.color-failed",
    causeKey: "errors.causes.color-failed",
    caption: "The colour could not be changed.",
    cause:
      "Writing the colour field back to the note failed, so the event keeps its previous colour.",
  },
  {
    code: "PPP-312",
    kind: "refusal",
    key: "views.calendar.errors.color-field-required",
    causeKey: "errors.causes.color-field-required",
    caption: "No colour field is set for this project.",
    cause:
      "The view has no field assigned to hold an event colour, so there is nothing to write the choice into.",
  },
  {
    code: "PPP-313",
    kind: "failure",
    key: "views.calendar.errors.navigation-failed",
    causeKey: "errors.causes.navigation-failed",
    caption: "The calendar could not move to that date.",
    cause:
      "Working out the next period failed, so the calendar stayed where it was.",
  },
  {
    code: "PPP-314",
    kind: "refusal",
    key: "views.calendar.errors.create-readonly",
    causeKey: "errors.causes.create-readonly",
    caption: "Cannot create events in read-only projects",
    cause:
      "The project is read-only, so no note can be created from this view.",
  },
  {
    code: "PPP-401",
    kind: "failure",
    key: "views.dashboard.canvas.error-add-field",
    causeKey: "errors.causes.dashboard-add-field",
    caption: "Failed to add field. Please try again.",
    cause:
      "The field could not be written into the project's notes, so the schema is unchanged.",
  },
  {
    code: "PPP-402",
    kind: "failure",
    key: "views.dashboard.canvas.error-reopen-schema",
    causeKey: "errors.causes.dashboard-reopen-schema",
    caption: "Failed to reopen schema.",
    cause:
      "The schema dialog could not be reopened after the edit; the edit itself was applied.",
  },
  {
    code: "PPP-403",
    kind: "failure",
    key: "errors.migrationBackupFailed",
    causeKey: "errors.causes.dashboard-migration-backup",
    caption:
      "The dashboard configuration was migrated, but its restore point could not be written. See the console.",
    cause:
      "The pre-migration copy of the configuration could not be saved, so there is nothing to roll back to.",
  },
  {
    code: "PPP-501",
    kind: "failure",
    key: "errors.inverseWriteFailed",
    causeKey: "errors.causes.inverse-write-failed",
    caption:
      "The back-link for '{{field}}' could not be written to {{count}} note(s). See the console.",
    cause:
      "The back-link is written into the notes on the other side of the relation, and some of those writes failed.",
  },
  {
    code: "PPP-601",
    kind: "failure",
    key: "onboarding.demo.folder-failed",
    causeKey: "errors.causes.demo-folder-failed",
    caption:
      "Could not create the demo folder '{{folder}}'. The demo project was not created.",
    cause:
      "The folder the demo notes live in could not be created, so none of them had anywhere to land.",
  },
  {
    code: "PPP-602",
    kind: "failure",
    key: "onboarding.demo.partial",
    causeKey: "errors.causes.demo-partial",
    caption:
      "The demo project was created, but {{count}} notes could not be written. See the console for the list.",
    cause:
      "Some of the demo notes could not be written, so the project is registered but incomplete.",
  },
  {
    code: "PPP-603",
    kind: "failure",
    key: "commands.create-demo-project.repair-failed",
    causeKey: "errors.causes.demo-repair-failed",
    caption:
      "Demo project already exists. {{count}} missing notes could not be written — see the console.",
    cause:
      "The demo project was re-seeded to restore the notes it was missing, and some of those writes failed.",
  },
  {
    code: "PPP-701",
    kind: "refusal",
    key: "views.filter.bar.save-name-taken",
    causeKey: "errors.causes.source-name-taken",
    caption: 'This project already has a source called "{{name}}"',
    cause:
      "Two sources sharing a name are indistinguishable in the only picker that lists them, so the name is refused.",
  },
];

/** The entry for `code`, or `undefined`. Callers decide what a miss means. */
export function findErrorCode(code: string): ErrorCodeEntry | undefined {
  return ERROR_CODES.find((entry) => entry.code === code);
}
