import dayjs from "dayjs";

import { App, Modal } from "obsidian";
import { get } from "svelte/store";

import { nextUniqueFileName } from "src/lib/helpers";
import { i18n } from "src/lib/stores/i18n";
import { interpolateTemplate } from "src/lib/templates/interpolate";

import CreateNote from "./components/CreateNote.svelte";
import type { ProjectDefinition } from "src/settings/settings";

export interface CreateNoteContext {
  /** Context date for template substitution (e.g., clicked date in calendar) */
  date?: dayjs.Dayjs;
  /** Context time for template substitution (e.g., clicked time in timeline) */
  time?: string;
}

export class CreateNoteModal extends Modal {
  component?: CreateNote;

  constructor(
    app: App,
    readonly project: ProjectDefinition,
    readonly onSave: (
      name: string,
      templatePath: string,
      project: ProjectDefinition
    ) => void,
    /** Optional context for template interpolation (date/time from calendar) */
    readonly context?: CreateNoteContext
  ) {
    super(app);
    this.containerEl.addClass("projects-modal");
  }

  getNewNotesFolder(project: ProjectDefinition) {
    if (project.newNotesFolder) {
      return project.newNotesFolder;
    }

    if (project.dataSource.kind === "folder") {
      return project.dataSource.config.path;
    }

    return "";
  }

  onOpen() {
    // Use context date/time if provided, otherwise use current time
    const contextDate = this.context?.date ?? dayjs();
    const contextTime = this.context?.time ?? dayjs().format("HH:mm");
    
    this.component = new CreateNote({
      target: this.contentEl,
      props: {
        name: this.project.defaultName
          ? interpolateTemplate(this.project.defaultName, {
              date: (format) => contextDate.format(format || "YYYY-MM-DD"),
              time: (format) => {
                // If format provided, parse contextTime and format
                if (format && this.context?.time) {
                  const [hours, minutes] = this.context.time.split(':').map(Number);
                  return dayjs().hour(hours ?? 0).minute(minutes ?? 0).format(format);
                }
                return contextTime;
              },
            })
          : nextUniqueFileName(
              this.getNewNotesFolder(this.project),
              get(i18n).t("modals.note.create.untitled")
            ),
        project: this.project,
        onSave: (
          name: string,
          templatePath: string,
          project: ProjectDefinition
        ) => {
          this.onSave(name, templatePath, project);
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
