import { App, Modal } from "obsidian";
import type { DataField } from "src/lib/dataframe/dataframe";
import type { ProjectDefinition } from "src/settings/settings";

import ConfigureField from "./components/ConfigureField.svelte";

export class ConfigureFieldModal extends Modal {
  component?: ConfigureField;

  constructor(
    app: App,
    readonly title: string,
    readonly field: DataField,
    readonly existingFields: DataField[],
    readonly editable: boolean,
    readonly onSave: (field: DataField) => void,
    /**
     * All projects in the current vault. Surfaced to the modal so the
     * Relation/Rollup sub-panels can populate their target-project picker
     * (Stage A.9). Defaults to an empty array to keep the modal
     * constructor backward-compatible with callers that have not yet been
     * migrated.
     */
    readonly availableProjects: ProjectDefinition[] = [],
    /**
     * Identifier of the project the edited field belongs to. Used to
     * filter the project's own id out of Relation target candidates.
     */
    readonly currentProjectId: string = ""
  ) {
    super(app);
  }

  onOpen() {
    this.component = new ConfigureField({
      target: this.contentEl,
      props: {
        title: this.title,
        field: this.field,
        existingFields: this.existingFields,
        editable: this.editable,
        availableProjects: this.availableProjects,
        currentProjectId: this.currentProjectId,
        onSave: (field: DataField) => {
          this.onSave(field);
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
