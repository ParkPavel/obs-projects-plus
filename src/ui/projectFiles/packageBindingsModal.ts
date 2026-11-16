import { FuzzySuggestModal, Modal, Setting, type App } from "obsidian";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { configPathChoiceKey, type ConfigBindingTarget, type ConfigPathChoice } from "src/lib/projectFiles/packagePathBindings";
import type { PackageDestinationPreview } from "./packageService";

class BindingTargetPicker extends FuzzySuggestModal<ConfigBindingTarget> {
  constructor(app: App, private readonly targets: readonly ConfigBindingTarget[], private readonly choose: (target: ConfigBindingTarget) => void) {
    super(app); this.containerEl.addClass("ppp-modal");
  }
  getItems(): ConfigBindingTarget[] { return [...this.targets]; }
  getItemText(target: ConfigBindingTarget): string { return target.path + (target.origin === "planned" ? " · " + get(i18n).t("package-inspect.binding-planned") : ""); }
  onChooseItem(target: ConfigBindingTarget): void { this.choose(target); }
}

/** Native settings rows, one modal scrollbar and stable pagination; no custom dropdown/portal/theme. */
export class ProjectPackageBindingsModal extends Modal {
  private alive = false;
  private picker: BindingTargetPicker | undefined;
  private page = 0;
  private readonly choices: Map<string, ConfigPathChoice>;
  constructor(app: App, private readonly preview: PackageDestinationPreview, private readonly submit: (choices: readonly ConfigPathChoice[]) => void) {
    super(app); this.containerEl.addClass("ppp-modal");
    this.choices = new Map(preview.configuration.choices.map(choice => [configPathChoiceKey(choice.projectId, choice.location), choice]));
  }
  onOpen(): void {
    this.alive = true;
    const t = (key: string) => get(i18n).t("package-inspect." + key);
    this.setTitle(t("binding-title"));
    this.contentEl.createEl("p", { text: t("binding-description") });
    const rows = this.contentEl.createDiv();
    const nav = new Setting(this.contentEl);
    let previous: import("obsidian").ButtonComponent, next: import("obsidian").ButtonComponent;
    const options = this.preview.configuration.bindings, pageSize = 12, pages = Math.max(1, Math.ceil(options.length / pageSize));
    const targetsByKind = { file: this.preview.configuration.targets.filter(target => target.kind === "file"), folder: this.preview.configuration.targets.filter(target => target.kind === "folder") };
    const checkedChoices = new Map(this.preview.configuration.choices.map(choice => [configPathChoiceKey(choice.projectId, choice.location), JSON.stringify(choice)]));
    const names = new Map(this.preview.configuration.projects.map(item => [item.project.id, item.project.name + (item.archived ? " · " + get(i18n).t("project-files.archived") : "")]));
    const fragment = (values: string[]) => {
      const document = rows.ownerDocument, view = document.win as Window & typeof window, result = view.createFragment();
      values.forEach((value, line) => {
        if (line) result.append(view.createEl("br"));
        const chars = Array.from(value), short = chars.slice(0, 160).join("") + (chars.length > 160 ? "…" : "");
        // Soft break opportunities preserve copied text and native responsive styles.
        const points = Array.from(short);
        for (let at = 0; at < points.length; at += 8) {
          result.append(document.createTextNode(points.slice(at, at + 8).join("")));
          if (at + 8 < points.length) result.append(view.createEl("wbr"));
        }
      });
      return result;
    };
    const render = (focusKey?: string) => {
      if (!this.alive) return;
      rows.empty(); let focus: HTMLButtonElement | undefined;
      for (const option of options.slice(this.page * pageSize, (this.page + 1) * pageSize)) {
        const key = configPathChoiceKey(option.projectId, option.location), choice = this.choices.get(key);
        const checked = choice && option.mode === "explicit" && choice.target === option.target && choice.origin === option.origin;
        const invalid = choice && option.mode === "invalid" && checkedChoices.get(key) === JSON.stringify(choice);
        const target = choice?.target ?? option.defaultTarget ?? "—";
        const status = choice ? t(invalid ? "binding-invalid" : checked ? "binding-verified" : "binding-pending") : t("binding-mode-" + option.defaultMode);
        const row = new Setting(rows).setName(t("binding-purpose-" + option.purpose)).setDesc(fragment([
          [names.get(option.projectId) ?? "", option.context].filter(Boolean).join(" · "), `${option.source || "—"} → ${target}`, status,
        ]));
        row.addButton(button => {
          if (key === focusKey) focus = button.buttonEl;
          const targets = targetsByKind[option.kind];
          button.setButtonText(t("binding-choose-" + option.kind)).setDisabled(!targets.length).onClick(() => {
            if (!this.alive) return;
            this.picker?.close();
            this.picker = new BindingTargetPicker(this.app, targets, selected => {
              if (!this.alive) return;
              this.choices.set(key, Object.freeze({ projectId: option.projectId, location: Object.freeze([...option.location]), root: this.preview.root, source: option.source, kind: option.kind, target: selected.path, origin: selected.origin }));
              render(key);
            });
            this.picker.open();
          });
        }).addButton(button => button.setButtonText(t("binding-default")).setDisabled(!choice).onClick(() => { this.choices.delete(key); render(key); }));
      }
      nav.setName(get(i18n).t("package-inspect.binding-page", { page: this.page + 1, pages }));
      previous.setDisabled(this.page === 0); next.setDisabled(this.page + 1 >= pages);
      if (focusKey) queueMicrotask(() => { if (this.alive && focus?.isConnected) focus.focus(); });
    };
    nav.addButton(button => { previous = button; button.setButtonText(t("binding-previous")).onClick(() => { if (this.page > 0) { this.page--; render(); } }); });
    nav.addButton(button => { next = button; button.setButtonText(t("binding-next")).onClick(() => { if (this.page + 1 < pages) { this.page++; render(); } }); });
    new Setting(this.contentEl).addButton(button => button.setButtonText(t("binding-reset-all")).onClick(() => { this.choices.clear(); render(); }))
      .addButton(button => button.setButtonText(t("binding-recheck")).setCta().onClick(() => {
        if (!this.alive) return;
        const choices = Object.freeze([...this.choices.values()]); this.close(); this.submit(choices);
      }));
    render();
  }
  onClose(): void { this.alive = false; this.picker?.close(); this.picker = undefined; this.choices.clear(); this.contentEl.empty(); }
}
