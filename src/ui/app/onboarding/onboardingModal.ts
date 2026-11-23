import { App } from "obsidian";
import { ProjectTransferModal as Modal } from "src/ui/projectFiles/transferModal";

import Onboarding from "./Onboarding.svelte";

export class OnboardingModal extends Modal {
  component?: Onboarding;
  private importFailed = false;

  constructor(
    readonly app: App,
    readonly onCreate: () => void,
    /**
     * 3.6.1 — the primary path: the three linked demo projects. The modal
     * closes once this resolves `true`; `false` keeps it open with a message.
     */
    readonly onTry: () => Promise<boolean>,
    readonly onImport?: () => void | Promise<void>,
    readonly ownerAlive: () => boolean = () => true
  ) {
    super(app);
    // Shared plugin modal root: phone input size, reduced motion (tokens.css).
    this.containerEl.addClass("ppp-modal");
  }

  onOpen() {
    this.component = new Onboarding({
      target: this.contentEl,
      props: {
        importFailed: this.importFailed,
        onImport: this.onImport ? async () => {
          this.close();
          try { await this.onImport?.(); }
          catch { if (this.ownerAlive()) { this.importFailed = true; this.open(); } }
        } : undefined,
        onCreate: () => {
          this.onCreate();
          this.close();
        },
        onTry: async () => {
          const ok = await this.onTry();
          if (ok) this.close();
          return ok;
        },
      },
    });
  }

  onClose() {
    this.component?.$destroy();
  }
}
