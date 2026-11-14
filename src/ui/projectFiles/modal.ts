import { Modal, Setting, TFile, type App } from "obsidian";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { settings } from "src/lib/stores/settings";
import TextField from "src/ui/components/fields/TextField.svelte";
import { nextCopyPreferences, projectFilesRoot } from "src/lib/projectFiles/paths";
import type { ProjectFilesController } from "./controller";

/** Reuses native modal scrolling and the shared IME-aware field kit. */
export class ProjectFilesModal extends Modal {
  private field: (TextField & { syncForSubmit(): boolean }) | undefined;
  private off: (() => void) | undefined;

  constructor(app: App, private readonly controller: ProjectFilesController) {
    super(app);
    this.containerEl.addClass("ppp-modal");
  }

  onOpen(): void {
    const t = (key: string) => get(i18n).t("project-files." + key);
    this.setTitle(t("title"));
    this.contentEl.createEl("p", { text: t("description") });
    if (get(settings).projects.some(project => project.dataSource.kind === "dataview" || project.additionalSources?.some(source => source.kind === "dataview"))) {
      this.contentEl.createEl("p", { text: t("dataview-warning") });
    }
    const current = get(settings).preferences.projectFiles;
    let root = current?.root ?? "Projects Plus";
    const valid = (value: string) => { try { projectFilesRoot(value, this.app.vault.configDir); return true; } catch { return false; } };
    const folder = new Setting(this.contentEl).setName(t("folder")).setDesc(t("folder-description"));
    this.field = new TextField({ target: folder.controlEl, props: { value: root, ariaLabel: t("folder"), validate: valid } }) as TextField & { syncForSubmit(): boolean };
    this.field.$on("commit", (event: CustomEvent<{ value: string }>) => {
      root = event.detail.value;
      this.field?.$set({ value: root });
      const preferences = get(settings).preferences;
      settings.updatePreferences({ ...preferences, projectFiles: nextCopyPreferences(preferences.projectFiles, root, preferences.projectFiles?.autoSync ?? false, this.app.vault.configDir) });
    });
    const toggle = new Setting(this.contentEl).setName(t("automatic")).setDesc(t("automatic-description"));
    toggle.addToggle(control => control.setValue(current?.autoSync ?? false).onChange(autoSync => {
      if (!this.field?.syncForSubmit() || !valid(root)) { control.setValue(get(settings).preferences.projectFiles?.autoSync ?? false); return; }
      const preferences = get(settings).preferences;
      settings.updatePreferences({ ...preferences, projectFiles: nextCopyPreferences(preferences.projectFiles, root, autoSync, this.app.vault.configDir) });
    }));
    const status = this.contentEl.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
    const documents = this.contentEl.createEl("ul");
    const action = new Setting(this.contentEl);
    action.addButton(button => {
      button.setButtonText(t("sync")).setCta().onClick(async () => {
        if (!this.field?.syncForSubmit() || !valid(root)) return;
        const preferences = get(settings).preferences;
        if (!preferences.projectFiles) settings.updatePreferences({ ...preferences, projectFiles: nextCopyPreferences(undefined, root, false, this.app.vault.configDir) });
        await this.controller.runWithNotice();
      });
      this.off = this.controller.status.subscribe(value => {
        status.textContent = value.kind === "saved" && value.receipt
          ? get(i18n).t("project-files.saved", { total: value.receipt.projects, path: value.receipt.root })
          : t(value.kind);
        button.setDisabled(value.kind === "copying");
        documents.empty();
        for (const document of value.receipt?.documents ?? []) {
          const item = documents.createEl("li");
          const link = item.createEl("a", { text: document.name + (document.archived ? " · " + t("archived") : ""), href: document.path });
          link.addEventListener("click", event => {
            event.preventDefault();
            const file = this.app.vault.getAbstractFileByPath(document.path);
            if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
          });
        }
      });
    });
    this.contentEl.createEl("p", { text: t("scope") });
    new Setting(this.contentEl).addButton(button => button.setButtonText(get(i18n).t("project-package.title")).onClick(async () => {
      if (!this.field?.syncForSubmit() || !valid(root)) return;
      const preferences = get(settings).preferences;
      if (!preferences.projectFiles) settings.updatePreferences({ ...preferences, projectFiles: nextCopyPreferences(undefined, root, false, this.app.vault.configDir) });
      await this.controller.openPackages();
    }));
  }

  onClose(): void {
    this.off?.(); this.off = undefined;
    this.field?.$destroy(); this.field = undefined;
    this.contentEl.empty();
  }
}
