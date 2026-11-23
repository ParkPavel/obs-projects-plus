import { Setting, type App, type TFile } from "obsidian";
import { ProjectTransferModal as Modal, ProjectTransferSuggestModal as FuzzySuggestModal } from "./transferModal";
import { get } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import { i18n } from "src/lib/stores/i18n";
import { ProjectConfigurationService, type ConfigurationApplyMode, type ConfigurationApplyPreview } from "./configurationService";

class ConfigurationPicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly service: ProjectConfigurationService, private readonly mode: ConfigurationApplyMode, private readonly choose: (path: string) => void) { super(app); this.containerEl.addClass("ppp-modal"); }
  getItems(): TFile[] { return this.app.vault.getFiles().filter(file => this.service.eligible(file.path, this.mode, get(settings))); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { this.choose(file.path); }
}

/** Read-only, paginated diff before explicit application; native modal and one common scroll area. */
export class ProjectConfigurationModal extends Modal {
  private alive = false;
  private picker: ConfigurationPicker | undefined;
  constructor(app: App, private readonly service: ProjectConfigurationService, private readonly mode: ConfigurationApplyMode) { super(app); this.containerEl.addClass("ppp-modal"); }
  onOpen(): void {
    this.alive = true;
    const t = (key: string) => get(i18n).t("project-configuration." + key);
    this.setTitle(t(this.mode)); this.contentEl.createEl("p", { text: t("description") });
    const status = this.contentEl.createEl("p", { attr: { role: "status", "aria-live": "polite" } }), details = this.contentEl.createDiv();
    let busy = false, preview: ConfigurationApplyPreview | undefined, page = 0;
    let apply: import("obsidian").ButtonComponent, choose: import("obsidian").ButtonComponent;
    const wrap = (element: HTMLElement, text: string) => {
      const points = Array.from(text);
      for (let at = 0; at < points.length; at += 32) { element.append(element.ownerDocument.createTextNode(points.slice(at, at + 32).join(""))); if (at + 32 < points.length) element.createEl("wbr"); }
    };
    const render = () => {
      details.empty(); if (!preview) return;
      details.createEl("p", { text: preview.name + " · " + preview.path });
      details.createEl("p", { text: get(i18n).t("project-configuration.summary", { count: preview.changes.length }) });
      new Setting(details).addButton(button => button.setButtonText(t("open-source")).setDisabled(busy).onClick(() => { if (preview && this.alive && !busy) void this.app.workspace.openLinkText(preview.path, "", "tab", { state: { mode: "source", source: true } }); }));
      const list = details.createEl("ul");
      for (const change of preview.changes.slice(page * 20, (page + 1) * 20)) {
        const row = list.createEl("li"); wrap(row.createEl("strong"), change.location.map(String).join(" / ") || "/");
        wrap(row.createEl("p"), change.before); wrap(row.createEl("p"), "→ " + change.after);
      }
      if (preview.changes.length > 20) new Setting(details).addButton(button => button.setButtonText(get(i18n).t("package-inspect.binding-previous")).setDisabled(busy || !page).onClick(() => { if (!busy && page) { page--; render(); } }))
        .addButton(button => button.setButtonText(get(i18n).t("package-inspect.binding-next")).setDisabled(busy || (page + 1) * 20 >= preview!.changes.length).onClick(() => { if (!busy && preview && (page + 1) * 20 < preview.changes.length) { page++; render(); } }));
    };
    new Setting(this.contentEl).addButton(button => {
      choose = button; button.setButtonText(t("choose")).onClick(() => {
        if (busy || !this.alive) return;
        this.picker?.close(); this.picker = new ConfigurationPicker(this.app, this.service, this.mode, path => {
          if (busy || !this.alive) return;
          busy = true; preview = undefined; details.empty(); choose.setDisabled(true); apply.setDisabled(true); status.textContent = t("checking");
          void this.service.preview(path, this.mode).then(result => { if (this.alive) { preview = result; page = 0; status.textContent = t("review"); } })
            .catch(() => { if (this.alive) status.textContent = t("failed"); }).finally(() => { busy = false; if (this.alive) { render(); choose.setDisabled(false); apply.setDisabled(!preview); } });
        }); this.picker.open();
      });
    });
    new Setting(this.contentEl).addButton(button => {
      apply = button; button.setButtonText(t("apply")).setCta().setDisabled(true).onClick(async () => {
        if (!this.alive || busy || !preview) return;
        const expected = preview; busy = true; choose.setDisabled(true); apply.setDisabled(true); render(); status.textContent = t("applying");
        try {
          const receipt = await this.service.apply(expected);
          if (this.alive) { status.textContent = get(i18n).t(receipt.copyUpdated ? "project-configuration.applied" : "project-configuration.applied-copy-pending", { path: receipt.backup }); preview = undefined; details.empty(); }
        } catch { if (this.alive) { status.textContent = t("failed"); preview = undefined; details.empty(); } }
        finally { busy = false; if (this.alive) choose.setDisabled(false); }
      });
    });
  }
  onClose(): void { this.alive = false; this.service.dispose(); this.picker?.close(); this.picker = undefined; this.contentEl.empty(); }
}
