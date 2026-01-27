import { App, Platform, PluginSettingTab, Setting } from "obsidian";
import Projects from "src/ui/settings/Projects.svelte";
import Archives from "src/ui/settings/Archives.svelte";
import { settings } from "src/lib/stores/settings";
import { get } from "svelte/store";
import type ProjectsPlugin from "src/main";
import type {
  FirstDayOfWeek,
  LinkBehavior,
  ProjectId,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { i18n } from "src/lib/stores/i18n";

/**
 * ProjectsSettingTab builds the plugin settings tab.
 */
export class ProjectsSettingTab extends PluginSettingTab {
  constructor(app: App, readonly plugin: ProjectsPlugin) {
    super(app, plugin);
  }

  // display runs when the user opens the settings tab.
  display(): void {
    let { preferences } = get(settings);

    const save = (prefs: ProjectsPluginPreferences) => {
      preferences = prefs;
      settings.updatePreferences(prefs);
    };

    const { containerEl } = this;

    containerEl.empty();

    // Add About section
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
      .setDesc(get(i18n).t("settings.about.credits-desc"))
      .setHeading();

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
      .setDesc(get(i18n).t("settings.about.languages-desc"))
      .setHeading();

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

    new Setting(containerEl)
      .setName(get(i18n).t("settings.general.size-limit.name"))
      .setDesc(get(i18n).t("settings.general.size-limit.desc"))
      .addText((text) =>
        text
          .setValue(preferences.projectSizeLimit.toString())
          .setPlaceholder("1000")
          .onChange((value) => {
            save({
              ...preferences,
              projectSizeLimit: parseInt(value) || 1000,
            });
          })
      );

    new Setting(containerEl)
      .setName(get(i18n).t("settings.general.link-behavior.name"))
      .setDesc(
        get(i18n).t("settings.general.link-behavior.desc", {
          modifier: Platform.isMacOS ? "Cmd" : "Ctrl",
        })
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOptions({
            "open-editor": get(i18n).t(
              "settings.general.link-behavior.options.open-editor"
            ),
            "open-note": get(i18n).t(
              "settings.general.link-behavior.options.open-note"
            ),
          })
          .setValue(preferences.linkBehavior)
          .onChange((value) => {
            save({
              ...preferences,
              linkBehavior: value as LinkBehavior,
            });
          });
      });

    new Setting(containerEl)
      .setName(get(i18n).t("settings.general.start-of-week.name"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption(
            "default",
            get(i18n).t("settings.general.start-of-week.options.default")
          )
          .addOption(
            "sunday",
            get(i18n).t("settings.general.start-of-week.options.sunday")
          )
          .addOption(
            "monday",
            get(i18n).t("settings.general.start-of-week.options.monday")
          )
          .setValue(
            preferences.locale.firstDayOfWeek
              ? preferences.locale.firstDayOfWeek.toString()
              : "default"
          )
          .onChange((value) => {
            save({
              ...preferences,
              locale: {
                firstDayOfWeek: value as FirstDayOfWeek,
              },
            });
          })
      );

    new Setting(containerEl)
      .setName(get(i18n).t("settings.general.mobile-calendar.name"))
      .setDesc(get(i18n).t("settings.general.mobile-calendar.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption(
            "month",
            get(i18n).t("settings.general.mobile-calendar.options.month")
          )
          .addOption(
            "week",
            get(i18n).t("settings.general.mobile-calendar.options.week")
          )
          .addOption(
            "day",
            get(i18n).t("settings.general.mobile-calendar.options.day")
          )
          .setValue(preferences.mobileCalendarView || "month")
          .onChange((value) => {
            save({
              ...preferences,
              mobileCalendarView: value as "month" | "week" | "day",
            });
          })
      );

    new Setting(containerEl)
      .setName(get(i18n).t("settings.general.animation-behavior.name") || "Animation Behavior")
      .setDesc(get(i18n).t("settings.general.animation-behavior.desc") || "Control scrolling animations throughout the plugin")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("smooth", get(i18n).t("settings.general.animation-behavior.options.smooth") || "Smooth (animated)")
          .addOption("instant", get(i18n).t("settings.general.animation-behavior.options.instant") || "Instant (no animation)")
          .setValue(preferences.animationBehavior || "smooth")
          .onChange((value) => {
            save({
              ...preferences,
              animationBehavior: value as "smooth" | "instant",
            });
          })
      );

    new Setting(containerEl)
      .setName(get(i18n).t("settings.front-matter.heading"))
      .setHeading();

    new Setting(containerEl)
      .setName(get(i18n).t("settings.front-matter.quote-strings.name"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption(
            "PLAIN",
            get(i18n).t("settings.front-matter.quote-strings.options.plain")
          )
          .addOption(
            "QUOTE_DOUBLE",
            get(i18n).t(
              "settings.front-matter.quote-strings.options.quote-double"
            )
          )
          .setValue(preferences.frontmatter.quoteStrings)
          .onChange((value) => {
            if (value === "PLAIN" || value === "QUOTE_DOUBLE") {
              save({
                ...preferences,
                frontmatter: {
                  quoteStrings: value,
                },
              });
            }
          })
      );

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
  }
}
