import { App, Modal } from "obsidian";
import { get } from "svelte/store";

import { i18n } from "src/lib/stores/i18n";
import { nextUniqueFieldName } from "src/lib/helpers";

import CreateField from "./components/CreateField.svelte";
import type {
  DataField,
  DataValue,
  Optional,
} from "src/lib/dataframe/dataframe";
import type { ProjectDefinition } from "src/settings/settings";

export class CreateFieldModal extends Modal {
  component?: CreateField;

  constructor(
    app: App,
    readonly fields: DataField[],
    /**
     * Resolves to `false` (or throws) when the write failed: the modal stays
     * open with the draft. M03 (C03): it used to close before the write ended.
     */
    readonly onCreate: (
      field: DataField,
      value: Optional<DataValue>
    ) => void | boolean | Promise<void | boolean>,
    readonly availableProjects: ProjectDefinition[] = [],
    readonly currentProjectId: string = "",
    readonly onSetupRelation?: (field: DataField) => void,
    /**
     * #144 — how many notes the create will write to. The modal used to close
     * on click with no statement of the consequence; Vision scene 2 asks for
     * exactly this sentence before the write.
     */
    readonly recordCount: number = 0
  ) {
    super(app);
    // Shared plugin modal root: phone input size, reduced motion (tokens.css).
    this.containerEl.addClass("ppp-modal");
  }

  onOpen() {
    this.component = new CreateField({
      target: this.contentEl,
      props: {
        existingFields: this.fields,
        defaultName: nextUniqueFieldName(
          this.fields,
          get(i18n).t("modals.field.create.untitled")
        ),
        availableProjects: this.availableProjects,
        currentProjectId: this.currentProjectId,
        onSetupRelation: this.onSetupRelation,
        recordCount: this.recordCount,
        onCreate: async (field: DataField, value: Optional<DataValue>) => {
          const outcome = await this.onCreate(field, value);
          if (outcome !== false) this.close();
          return outcome;
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
