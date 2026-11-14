import { FuzzySuggestModal, Modal, Setting, TFile, type App } from "obsidian";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { PackageInspectionError } from "src/lib/projectFiles/packagePolicy";
import type { ProjectPackageService } from "./packageService";

class PackageArchivePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly choose: (file: TFile) => Promise<void>) {
    super(app); this.containerEl.addClass("ppp-modal");
  }
  getItems(): TFile[] { return this.app.vault.getFiles().filter(file => /\.zip$/i.test(file.path)); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { void this.choose(file); }
}

/** Integrity preview only, available even in an empty vault with no configured copy root. */
export class ProjectPackageInspectModal extends Modal {
  private alive = false;
  private picker: PackageArchivePicker | undefined;
  constructor(app: App, private readonly service: ProjectPackageService) {
    super(app); this.containerEl.addClass("ppp-modal");
  }
  onOpen(): void {
    this.alive = true;
    const t = (key: string) => get(i18n).t("package-inspect." + key);
    this.setTitle(t("title"));
    this.contentEl.createEl("p", { text: t("description") });
    const controls = new Setting(this.contentEl);
    const status = this.contentEl.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
    const details = this.contentEl.createDiv();
    let busy = false;
    controls.addButton(button => button.setButtonText(t("choose")).onClick(() => {
      if (busy) return;
      this.picker?.close();
      this.picker = new PackageArchivePicker(this.app, async file => {
        if (!this.alive || busy) return;
        busy = true; button.setDisabled(true); details.empty(); status.textContent = t("checking");
        try {
          const result = await this.service.inspect(file.path);
          if (!this.alive) return;
          status.textContent = t("verified");
          details.createEl("p", { text: file.path });
          const projects = details.createEl("ul");
          for (const project of result.manifest.projects) projects.createEl("li", { text: project.name +
            (project.archived ? " · " + get(i18n).t("project-files.archived") : "") });
          details.createEl("p", { text: t("files") });
          const files = details.createEl("ul");
          for (const item of result.manifest.files) if (item.role !== "project") files.createEl("li", { text: `${item.sourcePath} · ${item.bytes}` });
          const missing = result.manifest.dependencies.filter(item => !item.resolved);
          if (missing.length) {
            details.createEl("p", { text: t("missing") });
            const list = details.createEl("ul");
            for (const dependency of missing) list.createEl("li", { text: dependency.reference });
          }
          details.createEl("p", { text: "SHA-256: " + result.archiveHash });
          details.createEl("p", { text: t("scope") });
        } catch (error) {
          if (this.alive) { details.empty(); status.textContent = t(error instanceof PackageInspectionError ? error.code : "read-failed"); }
        } finally { busy = false; if (this.alive) button.setDisabled(false); }
      });
      this.picker.open();
    }));
  }
  onClose(): void {
    this.alive = false; this.service.dispose(); this.picker?.close(); this.picker = undefined; this.contentEl.empty();
  }
}
