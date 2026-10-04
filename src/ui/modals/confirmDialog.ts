import { App, Modal } from "obsidian";

import ConfirmDialog from "./components/ConfirmDialog.svelte";

export class ConfirmDialogModal extends Modal {
  component?: ConfirmDialog;

  constructor(
    app: App,
    readonly title: string,
    readonly message: string,
    readonly cta: string,
    readonly onConfirm: () => void | Promise<void>
  ) {
    super(app);
    // Shared plugin modal root: phone input size, reduced motion (tokens.css).
    this.containerEl.addClass("ppp-modal");
  }

  onOpen() {
    this.component = new ConfirmDialog({
      target: this.contentEl,
      props: {
        title: this.title,
        message: this.message,
        cta: this.cta,
        onConfirm: () => {
          void this.onConfirm();
          this.close();
        },
        onCancel: () => {
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
