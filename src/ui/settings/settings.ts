import { App, PluginSettingTab, Setting } from "obsidian";
import Projects from "src/ui/settings/Projects.svelte";
import Archives from "src/ui/settings/Archives.svelte";
import { settings } from "src/lib/stores/settings";
import { get } from "svelte/store";
import type ProjectsPlugin from "src/main";
import type {
  FirstDayOfWeek,
  ProjectId,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { i18n } from "src/lib/stores/i18n";
import { preferenceChoice, preferenceNumber } from "./preferenceFields";

/**
 * ProjectsSettingTab builds the plugin settings tab.
 */
export class ProjectsSettingTab extends PluginSettingTab {
  /** Svelte components mounted by display(); destroyed before the next display and on hide. */
  private mounted: Array<{ $destroy(): void }> = [];
  private displayRevision = 0;

  constructor(app: App, readonly plugin: ProjectsPlugin) {
    super(app, plugin);
  }

  private destroyMounted(): void {
    this.displayRevision += 1;
    for (const component of this.mounted) component.$destroy();
    this.mounted = [];
  }

  hide(): void {
    this.destroyMounted();
  }

  // display runs when the user opens the settings tab.
  display(): void {
    this.destroyMounted();
    const owner = this.displayRevision;
    let { preferences } = get(settings);

    const save = (prefs: ProjectsPluginPreferences) => {
      if (owner !== this.displayRevision) return;
      preferences = prefs;
      settings.updatePreferences(prefs);
    };

    const { containerEl } = this;

    containerEl.empty();

    const t = (key: string) => get(i18n).t(key);
    const preferenceBindings: Array<(prefs: ProjectsPluginPreferences) => void> = [];
    const choices = (prefix: string, values: readonly string[]) => values.map(value => ({ value, label: t(prefix + ".options." + value) }));
    const choice = (key: string, read: (prefs: ProjectsPluginPreferences) => string, options: readonly { value: string; label: string }[], write: (value: string) => void, description = false) => {
      const row = new Setting(containerEl).setName(t(key + ".name"));
      if (description) row.setDesc(t(key + ".desc"));
      const field = preferenceChoice(row.controlEl, t(key + ".name"), read(preferences), options, write);
      this.mounted.push(field);
      preferenceBindings.push(prefs => field.$set({ value: read(prefs) }));
    };
    const limitKey = "settings.general.size-limit";
    const limitRow = new Setting(containerEl).setName(t(limitKey + ".name")).setDesc(t(limitKey + ".desc"));
    const limitField = preferenceNumber(limitRow.controlEl, t(limitKey + ".name"), preferences.projectSizeLimit,
      value => save({ ...preferences, projectSizeLimit: value }));
    this.mounted.push(limitField);
    preferenceBindings.push(prefs => limitField.$set({ value: prefs.projectSizeLimit }));

    const weekKey = "settings.general.start-of-week";
    choice(weekKey, prefs => prefs.locale.firstDayOfWeek || "default", choices(weekKey, ["default", "sunday", "monday"]),
      value => save({ ...preferences, locale: { firstDayOfWeek: value as FirstDayOfWeek } }));
    const calendarKey = "settings.general.mobile-calendar";
    choice(calendarKey, prefs => prefs.mobileCalendarView || "month", choices(calendarKey, ["month", "week", "day"]),
      value => save({ ...preferences, mobileCalendarView: value as "month" | "week" | "day" }), true);
    const animationKey = "settings.general.animation-behavior";
    choice(animationKey, prefs => prefs.animationBehavior || "smooth", choices(animationKey, ["smooth", "instant"]),
      value => save({ ...preferences, animationBehavior: value as "smooth" | "instant" }), true);

    new Setting(containerEl)
      .setName(get(i18n).t("settings.general.disable-haptic.name"))
      .setDesc(get(i18n).t("settings.general.disable-haptic.desc") || "Turn off vibration feedback during drag-and-drop on mobile devices")
      .addToggle((toggle) =>
        toggle
          .setValue(preferences.disableHapticFeedback ?? false)
          .onChange((value) => {
            save({
              ...preferences,
              disableHapticFeedback: value,
            });
          })
      );

    new Setting(containerEl)
      .setName(get(i18n).t("settings.general.replace-properties.name"))
      .setDesc(get(i18n).t("settings.general.replace-properties.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(preferences.propertiesInNoteHeader ?? true)
          .onChange((value) => {
            save({
              ...preferences,
              propertiesInNoteHeader: value,
            });
          })
      );

    new Setting(containerEl).setName(t("project-files.title")).setDesc(t("project-files.description"))
      .addButton(button => button.setButtonText(t("project-files.open")).onClick(() => this.plugin.projectFiles?.open()));

    new Setting(containerEl)
      .setName(get(i18n).t("settings.front-matter.heading"))
      .setHeading();

    const quoteKey = "settings.front-matter.quote-strings";
    choice(quoteKey, prefs => prefs.frontmatter.quoteStrings, [
      { value: "PLAIN", label: t(quoteKey + ".options.plain") },
      { value: "QUOTE_DOUBLE", label: t(quoteKey + ".options.quote-double") },
    ], value => {
      if (value === "PLAIN" || value === "QUOTE_DOUBLE") save({ ...preferences, frontmatter: { quoteStrings: value } });
    });

    new Setting(containerEl)
      .setName(get(i18n).t("settings.commands.name"))
      .setDesc(get(i18n).t("settings.commands.desc"))
      .setHeading();

    const projectsManager = new Projects({
      target: containerEl,
      props: {
        save,
        preferences,
        projects: get(settings).projects,
      },
    });
    this.mounted.push(projectsManager);

    new Setting(containerEl)
      .setName(get(i18n).t("settings.archives.name"))
      .setDesc(get(i18n).t("settings.archives.desc"))
      .setHeading();

    const archivesManager = new Archives({
      target: containerEl,
      props: {
        archives: get(settings).archives,
        onRestore: (archiveId: ProjectId) => {
          settings.restoreArchive(archiveId);
          archivesManager.$set({ archives: get(settings).archives });
          projectsManager.$set({ projects: get(settings).projects });
        },
        onDelete: (archiveId: ProjectId) => {
          settings.deleteArchive(archiveId);
          archivesManager.$set({ archives: get(settings).archives });
        },
      },
    });
    this.mounted.push(archivesManager);
    const unsubscribePreferences = settings.subscribe(current => {
      if (owner !== this.displayRevision) return;
      preferences = current.preferences;
      for (const refresh of preferenceBindings) refresh(preferences);
      projectsManager.$set({ preferences });
    });
    // Unsubscribe before destroying controls, so a retiring child cannot refresh them.
    this.mounted.unshift({ $destroy: unsubscribePreferences });

    // About comes last, under the tab's only plugin-level heading.
    new Setting(containerEl)
      .setName(get(i18n).t("settings.about.title"))
      .setDesc(get(i18n).t("settings.about.description"))
      .setHeading();

    new Setting(containerEl)
      .setName(get(i18n).t("settings.about.author"))
      .setDesc(get(i18n).t("settings.about.author-name"))
      .addButton((button) => {
        button
          .setButtonText(get(i18n).t("settings.about.visit-website"))
          .setCta()
          .onClick(() => {
            window.open("https://parkpavel.github.io/park-pavel/", "_blank");
          });
      });

    new Setting(containerEl)
      .setName(get(i18n).t("settings.about.original-author"))
      .setDesc(get(i18n).t("settings.about.original-author-name"))
      .addButton((button) => {
        button
          .setButtonText(get(i18n).t("settings.about.original-repo"))
          .setCta()
          .onClick(() => {
            window.open("https://github.com/marcusolsson/obsidian-projects", "_blank");
          });
      });

    new Setting(containerEl)
      .setName(get(i18n).t("settings.about.credits"))
      .setDesc(get(i18n).t("settings.about.credits-desc"));

    new Setting(containerEl)
      .setName(get(i18n).t("settings.about.version"))
      .setDesc(this.plugin.manifest.version)
      .addButton((button) => {
        button
          .setButtonText(get(i18n).t("settings.about.github"))
          .setCta()
          .onClick(() => {
            window.open("https://github.com/ParkPavel/obs-projects-plus", "_blank");
          });
      });

    new Setting(containerEl)
      .setName(get(i18n).t("settings.about.languages"))
      .setDesc(get(i18n).t("settings.about.languages-desc"));

    new Setting(containerEl)
      .setName(get(i18n).t("settings.about.support"))
      .setDesc(get(i18n).t("settings.about.support-desc"))
      .addButton((button) => {
        button
          .setButtonText(get(i18n).t("settings.about.star-github"))
          .setCta()
          .onClick(() => {
            window.open("https://github.com/ParkPavel/obs-projects-plus", "_blank");
          });
      });
  }
}
