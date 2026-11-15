import { FuzzySuggestModal, Modal, Setting, TFile, type App } from "obsidian";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { PackageInspectionError } from "src/lib/projectFiles/packagePolicy";
import type { ProjectPackageService } from "./packageService";
import { settings } from "src/lib/stores/settings";
import type { ConfigPathChoice } from "src/lib/projectFiles/packagePathBindings";
import { ProjectPackageBindingsModal } from "./packageBindingsModal";
import { ProjectPackageScopesModal } from "./packageScopesModal";
import type { PackageScopeChoice } from "src/lib/projectFiles/packageScopeChoices";

class PackageArchivePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly choose: (file: TFile) => Promise<void>) {
    super(app); this.containerEl.addClass("ppp-modal");
  }
  getItems(): TFile[] { return this.app.vault.getFiles().filter(file => /\.zip$/i.test(file.path)); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { void this.choose(file); }
}

/** Integrity preview and explicit preparation, including an empty vault with no copy root. */
export class ProjectPackageInspectModal extends Modal {
  private alive = false;
  private picker: PackageArchivePicker | undefined;
  private editor: ProjectPackageBindingsModal | undefined;
  private scopeEditor: ProjectPackageScopesModal | undefined;
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
    const pathControls = new Setting(this.contentEl).setName(t("destination"));
    const pathDetails = this.contentEl.createDiv();
    let busy = false;
    let destination = "";
    let choices: readonly ConfigPathChoice[] = [];
    let scopeChoices: readonly PackageScopeChoice[] = [];
    let target: { path: string; hash: string; root: string } | undefined;
    let stageButton: import("obsidian").ButtonComponent;
    let chooseButton: import("obsidian").ButtonComponent;
    let pathButton: import("obsidian").ButtonComponent;
    let destinationInput: import("obsidian").TextComponent;
    let bindingButton: import("obsidian").ButtonComponent | undefined;
    let scopeButton: import("obsidian").ButtonComponent | undefined;
    const closeEditor = () => { this.editor?.close(); this.editor = undefined; this.scopeEditor?.close(); this.scopeEditor = undefined; };
    const refresh = () => {
      chooseButton.setDisabled(busy); stageButton.setDisabled(busy || !target);
      pathButton.setDisabled(busy || !target || !destination); destinationInput.setDisabled(busy);
      bindingButton?.setDisabled(busy);
      scopeButton?.setDisabled(busy);
    };
    controls.addButton(button => { chooseButton = button; button.setButtonText(t("choose")).onClick(() => {
      if (busy) return;
      this.picker?.close();
      this.picker = new PackageArchivePicker(this.app, async file => {
        if (!this.alive || busy) return;
        busy = true; target = undefined; choices = []; scopeChoices = []; closeEditor(); bindingButton = undefined; scopeButton = undefined; refresh(); details.empty(); pathDetails.empty(); status.textContent = t("checking");
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
          const root = get(settings).preferences.projectFiles?.root ?? "Projects Plus";
          target = { path: file.path, hash: result.archiveHash, root };
          details.createEl("p", { text: get(i18n).t("package-inspect.stage-destination", { path: root + "/Incoming/" + result.archiveHash }) });
          if (!get(settings).preferences.projectFiles) details.createEl("p", { text: t("stage-binding") });
        } catch (error) {
          if (this.alive) { details.empty(); status.textContent = t(error instanceof PackageInspectionError ? error.code : "read-failed"); }
        } finally { busy = false; if (this.alive) refresh(); }
      });
      this.picker.open();
    }); });
    controls.addButton(button => {
      stageButton = button;
      button.setButtonText(t("stage")).setDisabled(true).onClick(async () => {
        if (busy || !target) return;
        const selected = target;
        busy = true; closeEditor(); bindingButton = undefined; scopeButton = undefined; refresh(); pathDetails.empty(); status.textContent = t("staging");
        try {
          const receipt = await this.service.stage(selected.path, selected.hash, selected.root);
          if (this.alive) status.textContent = get(i18n).t("package-inspect.staged", { path: receipt.folder, files: receipt.files });
        } catch {
          if (this.alive) { target = undefined; status.textContent = t("stage-failed"); }
        } finally { busy = false; if (this.alive) refresh(); }
      });
    });
    pathControls.addText(input => {
      destinationInput = input;
      input.inputEl.setAttribute("aria-label", t("destination"));
      input.setPlaceholder(t("destination-placeholder")).onChange(value => {
        if (!this.alive) return;
        if (destination !== value) { destination = value; choices = []; scopeChoices = []; closeEditor(); bindingButton = undefined; scopeButton = undefined; pathDetails.empty(); }
        if (!busy) refresh();
      });
    }).addButton(button => {
      pathButton = button;
      const run = async (selected: { path: string; hash: string }, folder: string, nextChoices: readonly ConfigPathChoice[], nextScopes: readonly PackageScopeChoice[]) => {
        if (!this.alive || busy || !target || selected.path !== target.path || selected.hash !== target.hash || folder !== destination) return;
        busy = true; closeEditor(); bindingButton = undefined; scopeButton = undefined; refresh(); pathDetails.empty(); status.textContent = t("checking-destination");
        try {
          const result = await this.service.previewFiles(selected.path, selected.hash, folder, nextChoices, nextScopes);
          if (!this.alive) return;
          if (folder !== destination || selected.path !== target?.path || selected.hash !== target?.hash) { status.textContent = t("binding-changed"); return; }
          choices = result.configuration.choices;
          scopeChoices = result.scopeReview?.choices ?? [];
          status.textContent = t("destination-checked");
          pathDetails.createEl("p", { text: get(i18n).t("package-inspect.destination-summary", { path: result.root, files: result.files.length, conflicts: result.conflicts.length }) });
          const list = pathDetails.createEl("ul");
          for (const file of result.files) list.createEl("li", { text: file.source + " → " + file.destination });
          if (result.conflicts.length) {
            pathDetails.createEl("p", { text: t("destination-conflicts") });
            const conflicts = pathDetails.createEl("ul");
            for (const conflict of result.conflicts) conflicts.createEl("li", { text: conflict.destination + " ↔ " + conflict.existing });
          }
          const config = result.configuration;
          pathDetails.createEl("p", { text: get(i18n).t("package-inspect.config-summary", { changes: config.changes.length, issues: config.issues.length, scopes: config.scopes.length }) });
          const short = (value: string) => value.length > 160 ? value.slice(0, 160) + "…" : value;
          const names = new Map(config.projects.map(item => [item.project.id, short(item.project.name)]));
          if (result.coreChecks?.length) {
            const total = result.coreChecks.reduce((sum, item) => sum + item.check.issues.length, 0);
            pathDetails.createEl("p", { text: get(i18n).t("package-inspect.core-summary", { projects: result.coreChecks.length, issues: total }) });
            pathDetails.createEl("p", { text: t("core-incomplete") });
            const diagnostics = pathDetails.createEl("ul"); let shown = 0;
            for (const item of result.coreChecks) for (const issue of item.check.issues) if (shown++ < 32) {
              const row = diagnostics.createEl("li"), points = Array.from(`${short(item.name)}: ${t("core-" + issue.code)} · ${short(issue.location.map(String).join(".")) || "/"}`);
              for (let at = 0; at < points.length; at += 32) {
                row.append(row.ownerDocument.createTextNode(points.slice(at, at + 32).join("")));
                if (at + 32 < points.length) row.createEl("wbr");
              }
            }
            if (total > 32) pathDetails.createEl("p", { text: t("config-more") });
          }
          const changes = pathDetails.createEl("ul");
          for (const change of config.changes.slice(0, 32)) changes.createEl("li", { text: `${names.get(change.projectId) ?? ""}: ${short(change.source)} → ${short(change.destination)}` });
          const issues = pathDetails.createEl("ul");
          for (const issue of config.issues.slice(0, 32)) issues.createEl("li", { text: `${names.get(issue.projectId) ?? ""}: ${t("config-" + issue.code)}${issue.source ? " · " + short(issue.source) : ""}` });
          if (config.scopes.length) {
            pathDetails.createEl("p", { text: t("config-candidates") });
            const scopes = pathDetails.createEl("ul");
            for (const scope of config.scopes.slice(0, 32)) scopes.createEl("li", { text: `${names.get(scope.projectId) ?? ""} · ${t("config-source-" + scope.kind)}: ${short(scope.value) || (scope.kind === "folder" ? "/" : "—")} · ${scope.existingCandidates ?? t("config-uncounted")}` });
          }
          if (Math.max(config.changes.length, config.issues.length, config.scopes.length) > 32) pathDetails.createEl("p", { text: t("config-more") });
          if (config.bindings.length || config.choices.length) new Setting(pathDetails).addButton(control => {
            bindingButton = control;
            control.setButtonText(t("binding-title")).onClick(() => {
              if (busy || !this.alive) return;
              closeEditor(); this.editor = new ProjectPackageBindingsModal(this.app, result, next => { void run(selected, folder, next, scopeChoices); }); this.editor.open();
            });
          });
          if (result.scopeReview && (result.scopeReview.rows.length || result.scopeReview.choices.length)) {
            pathDetails.createEl("p", { text: get(i18n).t("package-inspect.scope-summary", { confirmed: result.scopeReview.rows.filter(row => row.status === "confirmed").length, total: result.scopeReview.rows.length }) });
            new Setting(pathDetails).addButton(control => {
              scopeButton = control;
              control.setButtonText(t("scope-title")).onClick(() => {
                if (busy || !this.alive) return;
                closeEditor(); this.scopeEditor = new ProjectPackageScopesModal(this.app, result, next => { void run(selected, folder, choices, next); }); this.scopeEditor.open();
              });
            });
          }
          pathDetails.createEl("p", { text: t("config-scope") });
          if (result.notesNeedInspection) pathDetails.createEl("p", { text: t("note-links-pending") });
          pathDetails.createEl("p", { text: t("destination-scope") });
        } catch { if (this.alive) { pathDetails.empty(); bindingButton = undefined; scopeButton = undefined; status.textContent = t("destination-failed"); } }
        finally { busy = false; if (this.alive) refresh(); }
      };
      button.setButtonText(t("preview-files")).setDisabled(true).onClick(() => { if (target && destination) void run(target, destination, choices, scopeChoices); });
    });
  }
  onClose(): void {
    this.alive = false; this.editor?.close(); this.editor = undefined; this.scopeEditor?.close(); this.scopeEditor = undefined; this.service.dispose(); this.picker?.close(); this.picker = undefined; this.contentEl.empty();
  }
}
