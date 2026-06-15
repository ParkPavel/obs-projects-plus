import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import localizedFormat from "dayjs/plugin/localizedFormat";

// Импорт локалей dayjs - должен быть до i18n
import "dayjs/locale/ru";
import "dayjs/locale/uk";
import "dayjs/locale/zh-cn";

// Design tokens CSS
import "./ui/tokens/tokens.css";
import "./ui/views/Dashboard/tokens/dashboardTokens.css";

import { either } from "fp-ts";
import { Plugin, TFile, TFolder, WorkspaceLeaf, addIcon, Notice } from "obsidian";
import "obsidian-dataview";
import { createDataRecord, createProject } from "src/lib/dataApi";
import { api } from "src/lib/stores/api";
import { i18n, syncLocale } from "src/lib/stores/i18n";
import { app, plugin } from "src/lib/stores/obsidian";
import { settings } from "src/lib/stores/settings";
import { CreateNoteModal } from "src/ui/modals/createNoteModal";
import { CreateProjectModal } from "src/ui/modals/createProjectModal";
import { createDemoProject } from "src/ui/app/onboarding/demoProject";
import { commandBus, emitCommand } from "src/lib/stores/commandBus";
import {
  VIEW_TYPE_VISUALIZER_PANE,
  VisualizerPaneView,
} from "src/ui/views/VisualizerPane/visualizerPaneView";
import {
  RelationPickerModal,
  pathFromFile,
} from "src/ui/views/VisualizerPane/RelationPickerModal";
import { appendRelationToFile } from "src/lib/visualizer/relationsWriter";
import { CommandManager } from "src/managers/CommandManager";
import {
  createInverseIndexStore,
  type InverseIndexStore,
} from "src/lib/relations/inverseIndexStore";
import { get, type Unsubscriber } from "svelte/store";
import { registerFileEvents } from "./events";
import { ObsidianFileSystemWatcher } from "./lib/filesystem/obsidian/filesystem";
import { ProjectsSettingTab } from "./ui/settings/settings";
import {
  DEFAULT_SETTINGS,
  migrateSettings,
  type ProjectDefinition,
  type ProjectId,
  type ShowCommand,
  type ViewId,
} from "./settings/settings";
import { ProjectsView, VIEW_TYPE_PROJECTS } from "./view";

dayjs.extend(isoWeek);
dayjs.extend(localizedFormat);

export default class ProjectsPlusPlugin extends Plugin {
  unsubscribeSettings?: Unsubscriber;
  unsubscribeCommandBus?: Unsubscriber;
  inverseIndexStore?: InverseIndexStore;
  /** REFACTOR-008: command registration is delegated to a dedicated manager. */
  private commandManager?: CommandManager;
  /** REFACTOR-205: stored so the lifecycle is explicit and reload-safe. */
  private fileSystemWatcher?: ObsidianFileSystemWatcher;

  /**
   * onload runs when the plugin is enabled.
   */
  async onload(): Promise<void> {
    await this.loadSettings();

    // Re-detect locale now that Obsidian app is fully initialized
    syncLocale();

    // Helper function for translation.
    const { t } = get(i18n);

    this.addSettingTab(new ProjectsSettingTab(this.app, this));

    addIcon(
      "projects-icon",
      `
      <g>
        <path d="m84.42478,20.01081l10.10281,0l0,74.55223l-74.55082,0l0,-10.17944l10.14538,0l0,0.03689l54.26005,0l0,-0.03689l0.04257,0l0,-64.37279zm-18.92858,10.14255l-35.37403,0l0,35.29883l-10.10281,0l0,-45.44137l45.47685,0l0,10.14255l0,-0.00001z" fill="currentColor"/>
          <g transform="matrix(0.676126 0 0 0.676126 -406.678 -7.59132)">
            <path d="m719.83653,129.53201l-110.26,0l0,-110.263l110.26,0l0,110.263zm-15,-95.263l-80.26,0l0,80.263l80.26,0l0,-80.263z" fill="currentColor"/>
          </g>
      </g>
      `
    );

    this.addRibbonIcon("projects-icon", t("obsidian.ribbon-tooltip"), () => {
      void this.activateView();
    });

    this.registerView(
      VIEW_TYPE_PROJECTS,
      (leaf) => new ProjectsView(leaf, this)
    );

    // R1.1 — Visualizer sidebar leaf. Default OFF (per Revision 3 §5.6),
    // available via command palette (`toggle-visualizer-pane`) and file menu
    // (`Open in YAML Visualizer`).
    this.registerView(
      VIEW_TYPE_VISUALIZER_PANE,
      (leaf) => new VisualizerPaneView(leaf, this),
    );

    // R2.4 — single shared inverse-relation index for all Visualizer panes
    // and (future) Database widgets. Lifecycle is bound to the plugin so
    // we never duplicate event handlers.
    this.inverseIndexStore = createInverseIndexStore(this.app);

    this.registerHoverLinkSource(VIEW_TYPE_PROJECTS, {
      defaultMod: true,
      display: t("obsidian.hover-link-settings"),
    });

    // Allow the user to create a project by right-clicking a folder in the
    // File explorer. R0.4a: also expose Visualizer / relation entry points
    // for individual files. Concrete handlers live in subscribers (Visualizer
    // leaf — R1, Database canvas — Stage A.10) reached through the command bus.
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle(t("menus.project.create.title"))
              .setIcon("folder-plus")
              .onClick(() => {
                const project = createProject();

                new CreateProjectModal(
                  this.app,
                  t("modals.project.create.title"),
                  t("modals.project.create.cta"),
                  (project) => settings.addProject(project),
                  {
                    ...project,
                    name: file.name,
                    dataSource: {
                      kind: "folder",
                      config: {
                        path: file.path,
                        recursive: false,
                      },
                    },
                  }
                ).open();
              });
          });
        } else if (file instanceof TFile && file.extension === "md") {
          menu.addItem((item) => {
            item
              .setTitle(t("menus.file.open-in-visualizer.title"))
              .setIcon("layout-list")
              .onClick(() => {
                emitCommand("open-visualizer-for-file", { filePath: file.path });
              });
          });
          menu.addItem((item) => {
            item
              .setTitle(t("menus.file.add-relation.title"))
              .setIcon("link")
              .onClick(() => {
                emitCommand("add-relation", { filePath: file.path });
              });
          });
        }
      })
    );

    // Command to show the Projects view.
    this.addCommand({
      id: "show-projects",
      name: t("commands.show-projects.name"),
      callback: () => {
        void this.activateView();
      },
    });

    // Command to create a new project.
    this.addCommand({
      id: "create-project",
      name: t("commands.create-project.name"),
      callback: () => {
        new CreateProjectModal(
          this.app,
          t("modals.project.create.title"),
          t("modals.project.create.cta"),
          (project) => settings.addProject(project),
          createProject()
        ).open();
      },
    });

    // Command to create a new note.
    this.addCommand({
      id: "create-note",
      name: t("commands.create-note.name"),
      // checkCallback because we don't want to create notes if there are no
      // projects.
      checkCallback: (checking) => {
        const project = get(settings).projects[0];

        if (project) {
          if (!checking) {
            new CreateNoteModal(
              this.app,
              project,
              (name, templatePath, project) => {
                const record = createDataRecord(name, project);
                get(api).createNote(record, [], templatePath).catch(console.error);
              }
            ).open();
          }

          return true;
        }

        return false;
      },
    });

    // ── Stage A.10 — Database schema commands ─────────────────
    // These dispatch into whichever Database view is currently active via
    // the global command-bus. checkCallback gates visibility on the
    // presence of a Projects leaf so the palette stays clean when no
    // project is open.
    this.addCommand({
      id: "open-schema",
      name: t("commands.open-schema.name"),
      checkCallback: (checking) => {
        const hasProjectLeaf =
          this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECTS).length > 0;
        if (!hasProjectLeaf) return false;
        if (!checking) emitCommand("open-schema");
        return true;
      },
    });

    this.addCommand({
      id: "add-field",
      name: t("commands.add-field.name"),
      checkCallback: (checking) => {
        const hasProjectLeaf =
          this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECTS).length > 0;
        if (!hasProjectLeaf) return false;
        if (!checking) emitCommand("add-field");
        return true;
      },
    });

    // ── R0.4a — Visualizer / Formula / Relation skeleton commands ────────
    // Always-available palette entries. Concrete handlers (Visualizer leaf,
    // Formula editor modal, sub-base canvas) attach in later R-phases.
    // Until then these emit no-op messages so palette discoverability is in
    // place without partial UX.
    this.addCommand({
      id: "toggle-visualizer-pane",
      name: t("commands.toggle-visualizer-pane.name"),
      callback: () => {
        emitCommand("toggle-visualizer-pane");
      },
    });

    this.addCommand({
      id: "open-visualizer-for-file",
      name: t("commands.open-visualizer-for-file.name"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) emitCommand("open-visualizer-for-file", { filePath: file.path });
        return true;
      },
    });

    this.addCommand({
      id: "add-relation",
      name: t("commands.add-relation.name"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) emitCommand("add-relation", { filePath: file.path });
        return true;
      },
    });

    this.addCommand({
      id: "open-formula-editor",
      name: t("commands.open-formula-editor.name"),
      callback: () => {
        emitCommand("open-formula-editor");
      },
    });

    this.addCommand({
      id: "add-sub-base",
      name: t("commands.add-sub-base.name"),
      checkCallback: (checking) => {
        const hasProjectLeaf =
          this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECTS).length > 0;
        if (!hasProjectLeaf) return false;
        if (!checking) emitCommand("add-sub-base");
        return true;
      },
    });

    // #043 / feedback-demo-api-bridge — programmatic demo regen so REST API
    // automation and QA scripts can rebuild the onboarding demo without the
    // welcome modal. The underlying `createDemoProject` is idempotent on
    // files (vault.create catches "already exists"), but it always calls
    // `settings.addProject`, so re-running on a vault that already has a
    // "Демо-проект" entry will produce a second project with a fresh UUID.
    // Caller is responsible for deleting the prior copy first if they want
    // a clean slate; the command surfaces this as a Notice rather than
    // silently duplicating state.
    this.addCommand({
      id: "create-demo-project",
      name: t("commands.create-demo-project.name"),
      callback: () => {
        const existing = get(settings).projects.find((p) => p.name === "Демо-проект");
        if (existing) {
          new Notice(
            t("commands.create-demo-project.duplicate-warning", {
              defaultValue:
                "Demo project already exists — delete it first to regenerate.",
            }),
            6000,
          );
          return;
        }
        void createDemoProject(this.app.vault).then(() => {
          new Notice(
            t("commands.create-demo-project.created", {
              defaultValue: "Demo project created.",
            }),
            4000,
          );
        });
      },
    });

    // Initialize Svelte stores so that Svelte components can access the App and
    // Plugin objects.
    app.set(this.app);
    plugin.set(this);

    // REFACTOR-008: instantiate the command manager and wire the activate-view
    // callback before settings drive the first sync cycle below.
    this.commandManager = new CommandManager(this.app);
    this.commandManager.setActivateViewFunction((projectId, viewId) => {
      this.activateView(projectId, viewId);
    });

    // Save settings to disk whenever settings has been updated.
    this.unsubscribeSettings = settings.subscribe((value) => {
      this.ensureCommands(value.preferences.commands, value.projects);
      void this.saveData(value).catch((err) => console.error('Failed to save settings:', err));
    });

    // R1.1 — subscribe to global command-bus for Visualizer-pane lifecycle.
    // The bus carries actions emitted from palette / file-menu / toolbar;
    // here we react to the ones that need plugin-level workspace access
    // (creating/revealing the right sidebar leaf). View-scoped actions
    // continue to be handled by their own subscribers (e.g. DatabaseViewCanvas
    // for `open-schema` / `add-field`).
    let lastBusTs = 0;
    this.unsubscribeCommandBus = commandBus.subscribe((msg) => {
      if (!msg || msg.ts <= lastBusTs) return;
      lastBusTs = msg.ts;
      if (msg.action === "toggle-visualizer-pane") {
        void this.toggleVisualizerPane();
      } else if (msg.action === "open-visualizer-for-file") {
        const payload = msg.payload as { filePath?: string } | undefined;
        void this.revealVisualizerPane(payload?.filePath);
      } else if (msg.action === "add-relation") {
        const payload = msg.payload as { filePath?: string } | undefined;
        void this.openRelationPicker(payload?.filePath);
      }
    });

    this.fileSystemWatcher = new ObsidianFileSystemWatcher(this);

    registerFileEvents(this.fileSystemWatcher);

    // R5-012 — When the user has opted to replace Obsidian's built-in
    // Properties pane, detach any `file-properties` leaves on every
    // active-leaf-change and surface our YAML Visualizer pane in the
    // right sidebar instead. Default flag is false; toggling lives in
    // the plugin Settings tab.
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        void this.maybeReplacePropertiesPane();
      }),
    );
  }

  /**
   * onunload runs when the plugin is disabled. Use it to clean up any resources
   * you've allocated in the onload method.
   */
  onunload(): void {
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
    }
    if (this.unsubscribeCommandBus) {
      this.unsubscribeCommandBus();
    }
    if (this.inverseIndexStore) {
      this.inverseIndexStore.destroy();
      delete this.inverseIndexStore;
    }
    // REFACTOR-205: drop the watcher reference. Obsidian's plugin
    // lifecycle auto-disposes events registered via `registerEvent`,
    // but releasing the closure-holding instance lets GC reclaim
    // anything captured by datasource callbacks across reload cycles.
    if (this.fileSystemWatcher) {
      delete this.fileSystemWatcher;
    }
  }

  /**
   * R5-012 — Hide Obsidian's built-in Properties pane (`file-properties`
   * leaves) and reveal the YAML Visualizer pane when the
   * `replaceObsidianProperties` preference is on. No-op when the
   * preference is off, so users can switch the behavior at runtime
   * without restarting the plugin.
   */
  async maybeReplacePropertiesPane(): Promise<void> {
    const prefs = get(settings).preferences;
    if (!prefs.replaceObsidianProperties) return;
    const propsLeaves = this.app.workspace.getLeavesOfType("file-properties");
    if (propsLeaves.length === 0) return;
    for (const leaf of propsLeaves) {
      leaf.detach();
    }
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_VISUALIZER_PANE).length === 0) {
      await this.revealVisualizerPane();
    }
  }

  /**
   * R1.1 — Toggle the Visualizer sidebar pane. Reveals when hidden,
   * detaches when already open. Bound to `toggle-visualizer-pane` action.
   */
  async toggleVisualizerPane(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_VISUALIZER_PANE);
    if (existing.length > 0) {
      // Already open — hide all and return.
      for (const leaf of existing) {
        leaf.detach();
      }
      return;
    }
    await this.revealVisualizerPane();
  }

  /**
   * R1.1 — Reveal the Visualizer pane in the right sidebar, optionally
   * focusing the workspace on a given file first so the pane reflects it.
   */
  async revealVisualizerPane(filePath?: string): Promise<void> {
    if (filePath) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf("tab").openFile(file);
      }
    }
    const right = this.app.workspace.getRightLeaf(false);
    if (!right) return;
    await right.setViewState({
      type: VIEW_TYPE_VISUALIZER_PANE,
      active: true,
    });
    this.app.workspace.revealLeaf(right);
  }

  /**
   * R1.3 — Open the relation-picker modal for the given (or active) file.
   * On choice, appends a wikilink under the default relation key.
   */
  async openRelationPicker(filePath?: string): Promise<void> {
    const target = filePath
      ? this.app.vault.getAbstractFileByPath(filePath)
      : this.app.workspace.getActiveFile();
    if (!(target instanceof TFile) || target.extension !== "md") return;

    const modal = new RelationPickerModal(
      this.app,
      (chosen) => {
        void appendRelationToFile(this.app, target, {
          path: pathFromFile(chosen),
        });
      },
      { excludePath: target.path },
    );
    modal.open();
  }

  /**
   * loadSettings loads settings from disk, migrates it to the latest version,
   * and updates the Svelte store for settings.
   *
   * P0 safety: a migration failure (corrupted JSON, unknown version, partial
   * data mutated by another plugin) MUST NOT crash plugin onload. Fall back
   * to DEFAULT_SETTINGS, surface a Notice, and persist a backup of the raw
   * payload for forensic recovery.
   */
  async loadSettings(): Promise<void> {
    let raw: unknown = null;
    try {
      raw = await this.loadData();
    } catch (err) {
      console.error("[Projects+] Failed to read settings from disk:", err);
      new Notice(
        "Projects+: failed to load settings — using defaults. Check console for details.",
        10000
      );
      settings.set(Object.assign({}, DEFAULT_SETTINGS));
      return;
    }

    const result = migrateSettings(raw);
    if (either.isLeft(result)) {
      console.error(
        "[Projects+] Settings migration failed:",
        result.left,
        "raw payload:",
        raw
      );
      // Persist a backup of the broken payload so the user can recover manually.
      try {
        await this.saveData({
          __broken_backup: raw,
          __broken_backup_reason: result.left.message,
          __broken_backup_at: new Date().toISOString(),
          ...DEFAULT_SETTINGS,
        });
      } catch (saveErr) {
        console.error("[Projects+] Failed to persist broken-payload backup:", saveErr);
      }
      new Notice(
        `Projects+: settings file is corrupted (${result.left.message}). Defaults restored; original payload backed up inside data.json under "__broken_backup".`,
        15000
      );
      settings.set(Object.assign({}, DEFAULT_SETTINGS));
      return;
    }

    settings.set(result.right);
  }

  /**
   * activateView opens the main Projects view in a new workspace leaf.
   * */
  activateView(projectId?: ProjectId, viewId?: ViewId): void {
    const leaf = this.getOrCreateLeaf();

    void leaf.setViewState({
      type: VIEW_TYPE_PROJECTS,
      active: true,
      state: {
        projectId,
        viewId,
      },
    });
  }

  /**
   * getOrCreateLeaf returns a new leaf, or returns an existing leaf if
   * Projects is already open.
   */
  getOrCreateLeaf(): WorkspaceLeaf {
    const existingLeaves =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECTS);

    if (existingLeaves[0]) {
      return existingLeaves[0];
    }

    return this.app.workspace.getLeaf("tab");
  }

  /**
   * ensureCommands syncs enabled and registered show commands for individual
   * views and projects.
   *
   * REFACTOR-008: this is a thin facade over `managers/CommandManager`.
   * Behavior contract is preserved — settings.subscribe still calls this
   * — but the diff/registration logic now lives in a single class that
   * is independently unit-tested.
   */
  ensureCommands(
    enabledCommands: ShowCommand[],
    projects: ProjectDefinition[]
  ): void {
    if (!this.commandManager) {
      // Defensive: settings store can fire synchronously during onload
      // before commandManager is constructed in some test harnesses.
      this.commandManager = new CommandManager(this.app);
      this.commandManager.setActivateViewFunction((projectId, viewId) => {
        this.activateView(projectId, viewId);
      });
    }
    this.commandManager.ensureCommands(enabledCommands, projects);
    this.commandManager.finalizeRegistrations(this);
  }
}

