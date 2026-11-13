import dayjs from "dayjs";

import { App, Modal, normalizePath, TFile } from "obsidian";
import { get } from "svelte/store";

import { nextUniqueFileName } from "src/lib/helpers";
import { isValidPath } from "src/lib/obsidian";
import { i18n } from "src/lib/stores/i18n";
import { interpolateTemplate } from "src/lib/templates/interpolate";

import CreateNote from "./components/CreateNote.svelte";
import type { ProjectDefinition } from "src/settings/settings";

export interface CreateNoteContext {
  /** Context date for template substitution (e.g., clicked date in calendar) */
  date?: dayjs.Dayjs;
  /** Context time for template substitution (e.g., clicked time in timeline) */
  time?: string;
  /**
   * w4-p03 (audit F15, decision 24.10 #7): offer a project choice. Only the
   * general command does; a note created from a view belongs to that view's
   * project, so the window opened there has no choice (the views wrote to
   * their own project whatever was picked).
   */
  chooseProject?: boolean;
}

/** The folder a project's new notes go to. */
export function newNotesFolder(project: ProjectDefinition): string {
  if (project.newNotesFolder) {
    return project.newNotesFolder;
  }

  if (project.dataSource.kind === "folder") {
    return project.dataSource.config.path;
  }

  if (
    project.dataSource.kind === "native-query" &&
    project.dataSource.config.from.kind === "folder"
  ) {
    return project.dataSource.config.from.path;
  }

  return "";
}

/**
 * The name a new note is offered under: the project's name template filled
 * with the context date/time, otherwise the next free "Untitled". The window
 * and the calendar's draft form start from the same name.
 */
export function initialNoteName(project: ProjectDefinition, context?: CreateNoteContext): string {
  // Use context date/time if provided, otherwise use current time
  const contextDate = context?.date ?? dayjs();
  const contextTime = context?.time ?? dayjs().format("HH:mm");
  return project.defaultName
    ? interpolateTemplate(project.defaultName, {
        date: (format) => contextDate.format(format || "YYYY-MM-DD"),
        time: (format) => {
          // If format provided, parse contextTime and format
          if (format && context?.time) {
            const [hours, minutes] = context.time.split(':').map(Number);
            return dayjs().hour(hours ?? 0).minute(minutes ?? 0).format(format);
          }
          return contextTime;
        },
      })
    : nextUniqueFileName(newNotesFolder(project), get(i18n).t("modals.note.create.untitled"));
}

/**
 * Why `name` cannot be a new note's file name in `project`, or "" when it can.
 * The rules of the create window (CreateNote.svelte): not empty, not taken,
 * a valid path, no leading dot.
 */
export function noteNameProblem(app: App, project: ProjectDefinition, name: string): string {
  const t = get(i18n).t;
  if (name.trim() === "") return t("modals.note.create.empty-name-error");
  const existing = app.vault.getAbstractFileByPath(normalizePath(newNotesFolder(project) + "/" + name + ".md"));
  if (existing instanceof TFile) return t("modals.note.create.name-taken-error");
  if (!isValidPath(name)) return t("modals.project.defaultName.invalid");
  if (name.startsWith(".")) return t("modals.note.create.dot-start-error");
  return "";
}

export class CreateNoteModal extends Modal {
  component?: CreateNote;

  constructor(
    app: App,
    readonly project: ProjectDefinition,
    /**
     * w4-p02 (F14): returns the write. The window waits for it, closes on
     * success and stays open with the error and the typed name on a refusal.
     */
    readonly onSave: (
      name: string,
      templatePath: string,
      project: ProjectDefinition
    ) => void | Promise<unknown>,
    /** Optional context for template interpolation (date/time from calendar) */
    readonly context?: CreateNoteContext
  ) {
    super(app);
    this.containerEl.addClass("projects-modal");
    // Shared plugin modal root: phone input size, reduced motion (tokens.css).
    this.containerEl.addClass("ppp-modal");
  }

  getNewNotesFolder(project: ProjectDefinition) {
    return newNotesFolder(project);
  }

  onOpen() {
    this.component = new CreateNote({
      target: this.contentEl,
      props: {
        name: initialNoteName(this.project, this.context),
        project: this.project,
        chooseProject: this.context?.chooseProject === true,
        // Closed only once the note is written; a refusal reaches the form,
        // which shows it and keeps what was typed (CreateNote.svelte).
        onSave: async (
          name: string,
          templatePath: string,
          project: ProjectDefinition
        ) => {
          await this.onSave(name, templatePath, project);
          this.close();
        },
      },
    });
  }

  onClose() {
    if (this.component) {
      this.component.$destroy();
    }
  }
}
