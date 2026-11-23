import { Setting, TFile, getAllTags, type App } from "obsidian";
import { ProjectTransferModal as Modal, ProjectTransferSuggestModal as FuzzySuggestModal } from "./transferModal";
import { get } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import { i18n } from "src/lib/stores/i18n";
import { PACKAGE_LIMITS, type PreparedProjectPackage } from "src/lib/projectFiles/package";
import type { ProjectPackageService } from "./packageService";
import type { PreparedPackageShare } from "src/lib/projectFiles/packageShare";

class PackageFilePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly service: ProjectPackageService, private readonly choose: (file: TFile) => void) {
    super(app); this.containerEl.addClass("ppp-modal");
  }
  getItems(): TFile[] { return this.app.vault.getFiles().filter(file => this.service.eligible(file.path)); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { this.choose(file); }
}

class PackageGroupPicker extends FuzzySuggestModal<string> {
  constructor(app: App, private readonly items: string[], private readonly choose: (value: string) => void) { super(app); this.containerEl.addClass("ppp-modal"); }
  getItems(): string[] { return this.items; }
  getItemText(item: string): string { return item; }
  onChooseItem(item: string): void { this.choose(item); }
}

/** Native scrolling and explicit preview; no archive is written merely by opening a picker. */
export class ProjectPackageModal extends Modal {
  private alive = false;
  private picker: { open(): void; close(): void } | undefined;
  constructor(app: App, private readonly service: ProjectPackageService, private readonly initialProjectId?: string) {
    super(app); this.containerEl.addClass("ppp-modal");
  }
  onOpen(): void {
    this.alive = true;
    const t = (key: string) => get(i18n).t("project-package." + key);
    this.setTitle(t("title"));
    this.contentEl.createEl("p", { text: t("description") });
    const projects = [...get(settings).projects, ...get(settings).archives];
    if (!projects.length) { this.contentEl.createEl("p", { text: t("empty") }); return; }
    if (this.initialProjectId && !projects.some(project => project.id === this.initialProjectId)) {
      this.contentEl.createEl("p", { text: get(i18n).t("project-manager.project-missing"), attr: { role: "alert" } }); return;
    }
    let projectId = this.initialProjectId ?? projects[0]!.id, prepared: PreparedProjectPackage | undefined, busy = false;
    const paths = new Set<string>();
    const projectRow = new Setting(this.contentEl).setName(t("project"));
    const select = projectRow.controlEl.createEl("select", { attr: { "aria-label": t("project") } });
    const archived = new Set(get(settings).archives.map(project => project.id));
    for (const project of projects) select.createEl("option", { value: project.id,
      text: project.name + (archived.has(project.id) ? " · " + get(i18n).t("project-files.archived") : "") });
    select.value = projectId;
    const chosen = this.contentEl.createDiv();
    const groupControls = new Setting(this.contentEl).setName(get(i18n).t("project-manager.include-files"));
    const controls = new Setting(this.contentEl);
    const preview = this.contentEl.createDiv({ attr: { role: "status", "aria-live": "polite" } });
    const saveRow = new Setting(this.contentEl);
    const result = this.contentEl.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
    const shareRow = this.contentEl.createDiv();
    let sharing: PreparedPackageShare | undefined;
    let updateButtons = () => {};
    const invalidate = () => { prepared = undefined; sharing = undefined; shareRow.empty(); preview.empty(); result.textContent = ""; updateButtons(); };
    const renderFiles = () => {
      chosen.empty();
      for (const path of paths) new Setting(chosen).setName(path).addButton(button => button.setButtonText(t("remove")).setDisabled(busy).onClick(() => {
        if (busy) return; paths.delete(path); invalidate(); renderFiles();
      }));
    };
    select.addEventListener("change", () => { if (busy) return; projectId = select.value; invalidate(); });
    let addButton: import("obsidian").ButtonComponent, previewButton: import("obsidian").ButtonComponent, saveButton: import("obsidian").ButtonComponent;
    const groupButtons: import("obsidian").ButtonComponent[] = [];
    updateButtons = () => {
      select.disabled = busy;
      for (const button of groupButtons) button.setDisabled(busy);
      addButton?.setDisabled(busy || paths.size >= PACKAGE_LIMITS.files - 2);
      previewButton?.setDisabled(busy);
      saveButton?.setDisabled(busy || !prepared);
    };
    const addGroup = (kind: "folder" | "tag") => {
      if (busy || !this.alive) return;
      try {
        const available = this.app.vault.getFiles().filter(file => this.service.eligible(file.path));
        const tags = (file: TFile) => {
          if (file.extension !== "md") return [];
          const cache = this.app.metadataCache.getFileCache(file);
          if (!cache) throw new Error("metadata not ready");
          return getAllTags(cache) ?? [];
        };
        const groups = new Set<string>();
        for (const file of available) {
          if (kind === "tag") for (const tag of tags(file)) groups.add(tag);
          else {
            const parts = file.path.split("/"); parts.pop();
            for (let i = 1; i <= parts.length; i++) groups.add(parts.slice(0, i).join("/"));
          }
        }
        this.picker?.close();
        this.picker = new PackageGroupPicker(this.app, [...groups].sort(), value => {
          if (!this.alive || busy) return;
          try {
            // Reacquire membership after the picker closes; never use stale file
            // objects or silently truncate a group at the archive limit.
            const selected = this.app.vault.getFiles().filter(file => this.service.eligible(file.path) &&
              (kind === "folder" ? file.path.startsWith(value + "/") : tags(file).includes(value))).map(file => file.path);
            const next = new Set([...paths, ...selected]);
            if (next.size > PACKAGE_LIMITS.files - 2) { result.textContent = t("limits"); return; }
            for (const path of next) paths.add(path);
            invalidate(); renderFiles();
          } catch { result.textContent = t("failed"); }
        });
        this.picker.open();
      } catch { result.textContent = t("failed"); }
    };
    for (const kind of ["folder", "tag"] as const) groupControls.addButton(button => {
      groupButtons.push(button);
      button.setButtonText(get(i18n).t("project-manager.include-" + kind)).onClick(() => addGroup(kind));
    });
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
          if (this.alive) {
            result.textContent = get(i18n).t("project-package.saved", { path: receipt.path });
            sharing = undefined; shareRow.empty();
            try { sharing = await this.service.prepareShare(receipt.path, receipt.sha256); } catch { /* The saved ZIP remains available through the filesystem. */ }
            if (!this.alive) return;
            const row = new Setting(shareRow);
            if (!sharing?.available()) row.setDesc(t("share-unavailable"));
            row.addButton(button => button.setButtonText(t("share")).setDisabled(!sharing?.available()).onClick(() => {
              if (busy || !this.alive || !sharing) return;
              // Invoke synchronously in this click; all archive I/O was completed above.
              const operation = sharing.share(); busy = true; button.setDisabled(true); updateButtons(); result.textContent = t("sharing");
              void operation.then(outcome => { if (this.alive) result.textContent = t(outcome === "shared" ? "shared" : "share-" + outcome); })
                .finally(() => { busy = false; if (this.alive) { button.setDisabled(!sharing?.available()); updateButtons(); } });
            }));
          }
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
