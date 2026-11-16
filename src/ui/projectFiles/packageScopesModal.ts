import { Modal, Setting, type App } from "obsidian";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { configPathChoiceKey } from "src/lib/projectFiles/packagePathBindings";
import { MAX_SCOPE_RULE_DISPLAY, type PackageScopeChoice } from "src/lib/projectFiles/packageScopeChoices";
import type { PackageDestinationPreview } from "./packageService";

/** Native controls and the shared modal root; no separate popup, styles or nested scroll panel. */
export class ProjectPackageScopesModal extends Modal {
  private alive = false;
  private page = 0;
  private readonly choices: Map<string, PackageScopeChoice>;
  constructor(app: App, private readonly preview: PackageDestinationPreview, private readonly submit: (choices: readonly PackageScopeChoice[]) => void) {
    super(app); this.containerEl.addClass("ppp-modal");
    this.choices = new Map(preview.scopeReview.choices.map(choice => [configPathChoiceKey(choice.projectId, choice.location), choice]));
  }
  onOpen(): void {
    this.alive = true;
    const t = (key: string) => get(i18n).t("package-inspect." + key);
    this.setTitle(t("scope-title")); this.contentEl.createEl("p", { text: t("scope-description") });
    const rows = this.contentEl.createDiv(), nav = new Setting(this.contentEl), options = this.preview.scopeReview.rows;
    const pageSize = 12, pages = Math.max(1, Math.ceil(options.length / pageSize));
    const names = new Map(this.preview.configuration.projects.map(item => [item.project.id, item.project.name + (item.archived ? " · " + get(i18n).t("project-files.archived") : "")]));
    const fragment = (values: readonly { text: string; limit: number }[]) => {
      const document = rows.ownerDocument, view = document.win as Window & typeof window, result = view.createFragment();
      values.forEach(({ text, limit }, line) => {
        if (line) result.append(view.createEl("br"));
        const short = text.slice(0, limit), lines = short.split("\n").slice(0, 128);
        lines.forEach((value, index) => {
          if (index) result.append(view.createEl("br"));
          const points = Array.from(value);
          for (let at = 0; at < points.length; at += 32) {
            result.append(document.createTextNode(points.slice(at, at + 32).join("")));
            if (at + 32 < points.length) result.append(view.createEl("wbr"));
          }
        });
        if (text.length > limit || short.split("\n").length > 128) result.append(document.createTextNode("…"));
      });
      return result;
    };
    let previous: import("obsidian").ButtonComponent, next: import("obsidian").ButtonComponent;
    const render = () => {
      if (!this.alive) return;
      rows.empty();
      for (const option of options.slice(this.page * pageSize, (this.page + 1) * pageSize)) {
        const key = configPathChoiceKey(option.projectId, option.location), saved = this.choices.get(key);
        // Invalid choices must not appear checked; a fresh explicit toggle replaces them.
        let selected = saved?.revision === option.revision && option.status !== "blocked";
        const row = new Setting(rows).setName(t("config-source-" + option.kind));
        const describe = () => row.setDesc(fragment([
          { text: [names.get(option.projectId) ?? "", option.context].filter(Boolean).join(" · "), limit: 160 },
          { text: option.value || (option.kind === "folder" ? "/" : "—"), limit: MAX_SCOPE_RULE_DISPLAY },
          ...(option.recursive !== undefined ? [{ text: t(option.recursive ? "scope-recursive" : "scope-direct"), limit: 160 }] : []),
          ...(option.hierarchy !== undefined ? [{ text: t(option.hierarchy ? "scope-hierarchy" : "scope-exact-tag"), limit: 160 }] : []),
          { text: get(i18n).t("package-inspect.scope-candidates", { value: option.existingCandidates ?? t("config-uncounted") }), limit: 160 },
          { text: t(option.status === "blocked" ? "scope-blocked-" + option.blockedReason : selected ? option.status === "confirmed" ? "scope-confirmed" : "scope-pending-check" : this.choices.has(key) && option.status === "invalid" ? "scope-invalid" : "scope-unconfirmed"), limit: 240 },
        ]));
        describe();
        row.addToggle(toggle => { toggle.toggleEl.setAttribute("aria-label", t("scope-keep-rule")); toggle.setValue(selected).setDisabled(option.status === "blocked").onChange(value => {
          if (!this.alive || option.status === "blocked") return;
          selected = value;
          if (value) this.choices.set(key, Object.freeze({ projectId: option.projectId, location: Object.freeze([...option.location]), revision: option.revision, mode: "keep-rule" }));
          else this.choices.delete(key);
          describe();
        }); });
      }
      nav.setName(get(i18n).t("package-inspect.binding-page", { page: this.page + 1, pages }));
      previous.setDisabled(this.page === 0); next.setDisabled(this.page + 1 >= pages);
    };
    nav.addButton(button => { previous = button; button.setButtonText(t("binding-previous")).onClick(() => { if (this.page > 0) { this.page--; render(); } }); });
    nav.addButton(button => { next = button; button.setButtonText(t("binding-next")).onClick(() => { if (this.page + 1 < pages) { this.page++; render(); } }); });
    new Setting(this.contentEl).addButton(button => button.setButtonText(t("binding-reset-all")).onClick(() => { if (this.alive) { this.choices.clear(); render(); } }))
      .addButton(button => button.setButtonText(t("binding-recheck")).setCta().onClick(() => {
        if (!this.alive) return;
        const choices = Object.freeze([...this.choices.values()]); this.close(); this.submit(choices);
      }));
    render();
  }
  onClose(): void { this.alive = false; this.choices.clear(); this.contentEl.empty(); }
}
