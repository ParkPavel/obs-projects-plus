import { App, Modal } from "obsidian";

import type { DataField } from "src/lib/dataframe/dataframe";
import type { ProjectDefinition } from "src/settings/settings";

import Schema from "./components/Schema.svelte";

/**
 * SchemaModal — project-wide field editor (Stage A.9).
 *
 * Single canonical entry point users hit from the Database / Table
 * toolbar. Lists every field of the project and exposes Configure /
 * Delete / Add affordances. The modal itself is presentational; the
 * caller wires the row callbacks to the existing CreateFieldModal /
 * ConfigureFieldModal infrastructure and to the view's data API so we
 * never duplicate field-mutation logic.
 */
export class SchemaModal extends Modal {
  component?: Schema;

  constructor(
    app: App,
    readonly title: string,
    readonly fields: DataField[],
    readonly availableProjects: ProjectDefinition[],
    readonly currentProjectId: string,
    readonly onConfigure: (field: DataField) => void,
    readonly onAdd: () => void,
    readonly onDelete: (field: DataField) => void
  ) {
    super(app);
  }

  onOpen() {
    this.component = new Schema({
      target: this.contentEl,
      props: {
        title: this.title,
        fields: this.fields,
        availableProjects: this.availableProjects,
        currentProjectId: this.currentProjectId,
        onConfigure: (field: DataField) => {
          this.onConfigure(field);
        },
        onAdd: () => {
          this.onAdd();
        },
        onDelete: (field: DataField) => {
          this.onDelete(field);
        },
        onClose: () => this.close(),
      },
    });
  }

  onClose() {
    if (this.component) {
      this.component.$destroy();
    }
  }
}
