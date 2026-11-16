import { FuzzySuggestModal, Modal, Setting, TFile, type App } from "obsidian";
import { get } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import { i18n } from "src/lib/stores/i18n";
import { PACKAGE_LIMITS, type PreparedProjectPackage } from "src/lib/projectFiles/package";
import type { ProjectPackageService } from "./packageService";

class PackageFilePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly service: ProjectPackageService, private readonly choose: (file: TFile) => void) {
    super(app); this.containerEl.addClass("ppp-modal");
  }
  getItems(): TFile[] { return this.app.vault.getFiles().filter(file => this.service.eligible(file.path)); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { this.choose(file); }
}

/** Native scrolling and explicit preview; no archive is written merely by opening a picker. */
export class ProjectPackageModal extends Modal {
  private alive = false;
  private picker: PackageFilePicker | undefined;
  constructor(app: App, private readonly service: ProjectPackageService) {
    super(app); this.containerEl.addClass("ppp-modal");
  }
  onOpen(): void {
    this.alive = true;
    const t = (key: string) => get(i18n).t("project-package." + key);
    this.setTitle(t("title"));
    this.contentEl.createEl("p", { text: t("description") });
    const projects = [...get(settings).projects, ...get(settings).archives];
    if (!projects.length) { this.contentEl.createEl("p", { text: t("empty") }); return; }
    let projectId = projects[0]!.id, prepared: PreparedProjectPackage | undefined, busy = false;
    const paths = new Set<string>();
    const projectRow = new Setting(this.contentEl).setName(t("project"));
    const select = projectRow.controlEl.createEl("select", { attr: { "aria-label": t("project") } });
    const archived = new Set(get(settings).archives.map(project => project.id));
    for (const project of projects) select.createEl("option", { value: project.id,
      text: project.name + (archived.has(project.id) ? " · " + get(i18n).t("project-files.archived") : "") });
    const chosen = this.contentEl.createDiv();
    const controls = new Setting(this.contentEl);
    const preview = this.contentEl.createDiv({ attr: { role: "status", "aria-live": "polite" } });
    const saveRow = new Setting(this.contentEl);
    const result = this.contentEl.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
    let updateButtons = () => {};
    const invalidate = () => { prepared = undefined; preview.empty(); result.textContent = ""; updateButtons(); };
    const renderFiles = () => {
      chosen.empty();
      for (const path of paths) new Setting(chosen).setName(path).addButton(button => button.setButtonText(t("remove")).setDisabled(busy).onClick(() => {
        if (busy) return; paths.delete(path); invalidate(); renderFiles();
      }));
    };
    select.addEventListener("change", () => { if (busy) return; projectId = select.value; invalidate(); });
    let addButton: import("obsidian").ButtonComponent, previewButton: import("obsidian").ButtonComponent, saveButton: import("obsidian").ButtonComponent;
    updateButtons = () => {
      select.disabled = busy;
      addButton?.setDisabled(busy || paths.size >= PACKAGE_LIMITS.files - 2);
      previewButton?.setDisabled(busy);
      saveButton?.setDisabled(busy || !prepared);
    };
    controls.addButton(button => {
      addButton = button;
      button.setButtonText(t("add-file")).onClick(() => {
        if (busy) return;
        this.picker?.close();
        this.picker = new PackageFilePicker(this.app, this.service, file => {
          if (!this.alive || busy || paths.size >= PACKAGE_LIMITS.files - 2) return;
          paths.add(file.path); invalidate(); renderFiles();
        });
        this.picker.open();
      });
    });
    controls.addButton(button => {
      previewButton = button;
      button.setButtonText(t("preview")).onClick(async () => {
        if (busy) return;
        busy = true; invalidate(); renderFiles(); updateButtons();
        try {
          const capture = await this.service.prepare(projectId, [...paths]);
          if (!this.alive) return;
          prepared = capture;
          const manifest = capture.manifest;
          preview.createEl("p", { text: get(i18n).t("project-package.summary", { projects: manifest.projects.length, files: paths.size, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0) }) });
          const list = preview.createEl("ul");
          for (const project of manifest.projects) list.createEl("li", { text: project.name });
          const missing = manifest.dependencies.filter(dependency => !dependency.resolved);
          if (missing.length) {
            preview.createEl("p", { text: t("missing") });
            for (const dependency of missing) list.createEl("li", { text: dependency.reference });
          }
          preview.createEl("p", { text: t("scope") });
        } catch { if (this.alive) preview.textContent = t("failed"); }
        finally { busy = false; if (this.alive) { renderFiles(); updateButtons(); } }
      });
    });
    saveRow.addButton(button => {
      saveButton = button;
      button.setButtonText(t("save")).setCta().onClick(async () => {
        if (busy || !prepared) return;
        busy = true; renderFiles(); updateButtons();
        try {
          const receipt = await this.service.save(prepared);
          if (this.alive) result.textContent = get(i18n).t("project-package.saved", { path: receipt.path });
        } catch { if (this.alive) { prepared = undefined; result.textContent = t("failed"); } }
        finally { busy = false; if (this.alive) { renderFiles(); updateButtons(); } }
      });
    });
    updateButtons();
    this.contentEl.createEl("p", { text: t("limits") });
  }
  onClose(): void {
    this.alive = false; this.service.dispose(); this.picker?.close(); this.picker = undefined; this.contentEl.empty();
  }
}
