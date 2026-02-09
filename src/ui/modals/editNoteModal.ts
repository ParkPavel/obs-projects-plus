import { App, Modal } from "obsidian";

import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";

import EditRecord from "./components/EditNote.svelte";

export class EditNoteModal extends Modal {
  component?: EditRecord;

  constructor(
    app: App,
    readonly fields: DataField[],
    readonly onSave: (record: DataRecord) => void,
    readonly defaults: DataRecord,
    readonly allRecords: DataRecord[] = [],
    // v3.0.1: New callbacks for note title actions
    readonly onOpenNote?: () => void,
    readonly onRenameNote?: (newName: string) => void,
    // v3.0.4: Autosave setting from project configuration
    readonly autosave: boolean = true
  ) {
    super(app);
    this.containerEl.addClass("projects-modal");
  }

  onOpen() {
    this.component = new EditRecord({
      target: this.contentEl,
      props: {
        record: this.defaults,
        fields: this.fields,
        allRecords: this.allRecords,
        autosave: this.autosave,
        // v3.0.4: Wrap openNote callback to close modal after opening
        onOpenNote: this.onOpenNote ? () => {
          this.onOpenNote?.();
          // Close modal after opening note
          this.close();
        } : undefined,
        // v3.0.1: Wrap rename callback to close modal after rename
        onRenameNote: this.onRenameNote ? (newName: string) => {
          this.onRenameNote?.(newName);
          // Close modal after rename - data needs to reload with new ID
          this.close();
        } : undefined,
        // v3.0.4: Save callback - behavior depends on autosave setting
        onSave: (record: DataRecord) => {
          this.onSave(record);
          // If manual save mode, close modal after save
          if (!this.autosave) {
            this.close();
          }
          // If autosave, modal stays open for continued editing
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
