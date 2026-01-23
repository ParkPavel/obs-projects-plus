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
    readonly onRenameNote?: (newName: string) => void
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
        onOpenNote: this.onOpenNote,
        // v3.0.1: Wrap rename callback to close modal after rename
        onRenameNote: this.onRenameNote ? async (newName: string) => {
          await this.onRenameNote?.(newName);
          // Close modal after rename - data needs to reload with new ID
          this.close();
        } : undefined,
        onSave: (record: DataRecord) => {
          this.onSave(record);
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
