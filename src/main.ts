import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import localizedFormat from "dayjs/plugin/localizedFormat";

// Импорт локалей dayjs - должен быть до i18n
import "dayjs/locale/ru";
import "dayjs/locale/uk";
import "dayjs/locale/zh-cn";

// Design tokens CSS — the single source (#165). R0.13 asserts this import.
import "./ui/tokens/tokens.css";

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
import {
  createDemoProject,
  seedDemoNotes,
} from "src/ui/app/onboarding/demoProject";
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
import {
  createSettingsWriter,
  type SettingsWriter,
} from "src/lib/settings/settingsWriter";
import {
  onSaveFailureEpisode,
  saveStatus,
  setSaveRetryHandler,
} from "src/lib/settings/saveStatus";
import { versionOnDisk } from "src/lib/settings/settingsVersion";
import {
  readRawSettings,
  settingsFilePath,
  writeBrokenCopy,
  writeConflictCopy,
} from "src/lib/settings/brokenBackup";
import { reconcileSettings } from "src/lib/settings/settingsReconcile";
import { canonical, classifyDisk } from "src/lib/settings/settingsVerify";
import type { WriteVerdict } from "src/lib/settings/settingsWriter";
import { noticeFor, withCode } from "src/lib/errors/errorText";
import { logError, logWarning } from "src/lib/errors/errorLog";
import { registerFileEvents } from "./events";
import { ObsidianFileSystemWatcher } from "./lib/filesystem/obsidian/filesystem";
import { ProjectsSettingTab } from "./ui/settings/settings";
import {
  DEFAULT_SETTINGS,
  migrateSettings,
  type LatestProjectsPluginSettings,
  type ProjectDefinition,
  type ProjectId,
  type ShowCommand,
  type ViewId,
} from "./settings/settings";
import { ProjectsView, VIEW_TYPE_PROJECTS } from "./view";

dayjs.extend(isoWeek);
dayjs.extend(localizedFormat);

/**
 * #202 — the settings events this file can report. Written as literals so the
 * number a user quotes from their console can be grepped straight to the line
 * that raised it; R0.21 refuses a `PPP-nnn` that is not in the registry, so a
 * typo fails a gate instead of reaching a screen.
 */
const SETTINGS_SUPERSEDED = "PPP-102";
const SETTINGS_UNREADABLE = "PPP-103";
const SETTINGS_CORRUPTED = "PPP-104";
/** #200 — the file was replaced and the two versions could not be reconciled. */
const SETTINGS_CONFLICT = "PPP-105";
/** #200 — the same, with the copy of the other version refused. */
const SETTINGS_CONFLICT_UNCOPIED = "PPP-106";
/**
 * #200 — how long a settings file is allowed to be mid-write before the bytes
 * are treated as somebody's real version rather than as a synchroniser caught
 * between two writes. Long enough that an ordinary write completes, short
 * enough to beat the user's next change to the file.
 */
const SETTINGS_UNPARSABLE_RECHECK_MS = 2000;
/** #202 — the demo repair path; the demo itself raises 601/602 in its own module. */
const DEMO_REPAIR_FAILED = "PPP-603";

export default class ProjectsPlusPlugin extends Plugin {
  unsubscribeSettings?: Unsubscriber;
  unsubscribeCommandBus?: Unsubscriber;
  unsubscribeSaveStatus?: Unsubscriber;
  inverseIndexStore?: InverseIndexStore;
  /** REFACTOR-008: command registration is delegated to a dedicated manager. */
  private commandManager?: CommandManager;
  /** REFACTOR-205: stored so the lifecycle is explicit and reload-safe. */
  private fileSystemWatcher?: ObsidianFileSystemWatcher;
  /** #185: the only thing in the plugin that writes `data.json`. */
  private settingsWriter?: SettingsWriter<LatestProjectsPluginSettings>;
  /**
   * #185: the exact object `loadSettings` put into the store. The writer is
   * primed with THIS reference, so the echo firing is recognised by identity
   * rather than by assuming nothing mutates the store in between.
   */
  private loadedSettings?: LatestProjectsPluginSettings;
  /** #185: version found on disk when it differed from the current one. */
  private migratedFromVersion: number | null = null;
  /**
   * #199: the canonical form of what `data.json` last held, as far as this
   * plugin knows. It is what separates "our write did not land" from "someone
   * else wrote something else" when the read-back does not match.
   */
  private confirmedOnDisk: string | null = null;
  /**
   * #200: the pending re-read of a settings file that did not parse. One at a
   * time — a synchroniser writing in bursts fires the hook repeatedly, and a
   * timer per firing would queue a crowd of them for one event.
   */
  private unparsableRecheck: number | null = null;

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
          // #198: a user who hit the illegal filename has this project already,
          // with a note missing — and returning early here is exactly what kept
          // them from ever getting it. Seeding is idempotent, so re-run it and
          // say what it found rather than refusing outright.
          void seedDemoNotes(this.app.vault).then((failed) => {
            new Notice(
              failed.length > 0
                ? noticeFor(DEMO_REPAIR_FAILED, { count: failed.length })
                : t("commands.create-demo-project.repaired", {
                    defaultValue:
                      "Demo project already exists; any missing notes have been restored.",
                  }),
              6000,
            );
          });
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

    // #185 — one writer owns `data.json`. `saveData` is handed to it rather
    // than imported, which is what makes a failing write expressible in a test
    // at all; the outcome leaves through `saveStatus` instead of being returned,
    // because under coalescing a per-call promise describes no single write.
    const writer = createSettingsWriter<LatestProjectsPluginSettings>({
      save: (value) => this.saveData(value),
      // #199: `saveData` resolving is a claim, not a fact. A live run with
      // `data.json` made read-only had it report success while the file did
      // not change — and #185's whole visibility hangs off a rejection that
      // never arrived. So the file is read back and compared.
      verify: (value) => this.settingsAreOnDisk(value),
      onStatus: (status) => saveStatus.set(status),
    });
    this.settingsWriter = writer;
    setSaveRetryHandler(() => writer.retry());

    // The chip lives in `CompactNavBar`, which exists only inside the Projects
    // view — settings also change from Obsidian's own settings tab. One Notice
    // per episode covers that; the chip is what remains visible afterwards.
    // #202: the code the status carries, not one fixed here — so the notice,
    // the standing mark and the console line are the same event by
    // construction rather than by three call sites agreeing.
    this.unsubscribeSaveStatus = onSaveFailureEpisode((status) => {
      new Notice(noticeFor(status.code), 15000);
    });

    // The store fires immediately on subscribe, with the value `loadSettings`
    // just read from disk. That echo used to be written straight back — and on
    // the corruption path it overwrote the `__broken_backup` keys the Notice
    // had just told the user to look for. Priming with the same object makes
    // the first firing a no-op.
    if (this.loadedSettings) {
      writer.prime(this.loadedSettings);
      if (this.migratedFromVersion !== null) {
        // …but that echo was also the ONLY thing persisting a migration.
        // Skipping it alone would leave a v1 file on disk indefinitely, so the
        // migration is written here by name: because the version changed, not
        // because the plugin was opened.
        writer.pushImmediate(this.loadedSettings);
      }
    }

    // Save settings to disk whenever settings has been updated.
    this.unsubscribeSettings = settings.subscribe((value) => {
      this.ensureCommands(value.preferences.commands, value.projects);
      writer.push(value);
    });

    // Best effort on shutdown: the last coalesced write is torn off the
    // debounce. Obsidian documents this event as "not guaranteed to actually
    // run", so it closes the common case and nothing more — a change that is
    // still failing to write when the window closes is lost, and the standing
    // indicator is what warns the user before that happens.
    this.registerEvent(
      this.app.workspace.on("quit", (tasks) => {
        tasks.addPromise(writer.flush());
      })
    );

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
    if (this.unsubscribeSaveStatus) {
      this.unsubscribeSaveStatus();
    }
    setSaveRetryHandler(null);
    if (this.unparsableRecheck !== null) {
      // #200: it would fire into a disposed writer and a reset status store.
      window.clearTimeout(this.unparsableRecheck);
      this.unparsableRecheck = null;
    }
    // #185, second pass: the status store is module-global and outlives the
    // plugin instance if the host keeps the module cached across a
    // disable/enable. Left standing, the chip would survive into a session
    // whose writer knows nothing about it — its retry reaching a clean writer
    // and doing nothing, which is a control that lies. Reset with the handler
    // it belongs to.
    saveStatus.set({ kind: "idle" });
    if (this.settingsWriter) {
      // Order is load-bearing, and `flush` is deliberately allowed to outlive
      // `dispose`: it starts the pending write synchronously and keeps its
      // licence to run the one follow-up write queued behind an in-flight one,
      // while `dispose` stops the writer from scheduling anything new. What it
      // does not do is wait out a retry delay — a change made while the disk is
      // refusing writes is still lost on quit, and #185 promises only that the
      // user was warned by something that does not fade before they got here.
      void this.settingsWriter.flush();
      this.settingsWriter.dispose();
      delete this.settingsWriter;
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
   * #200 — somebody else wrote `data.json`.
   *
   * Obsidian calls this when the file changes on disk from outside the app: a
   * second window, a synchroniser, a hand edit. It exists on every host this
   * plugin claims (`Plugin#onExternalSettingsChange`, v1.5.7; `minAppVersion`
   * is v1.5.7), and the step-0 spike confirmed in a live vault both that an
   * external write fires it with the NEW contents already readable, and that
   * our own `saveData` does not fire it.
   *
   * Every judgement is in `settingsReconcile.ts`, on purpose: this method
   * cannot be unit-tested in this tree at all, so it holds only the wiring —
   * read, decide, apply. What it does with each decision is the thing to keep
   * honest, and each branch is one statement.
   */
  async onExternalSettingsChange(): Promise<void> {
    const path = settingsFilePath(this.manifest.dir);
    // Same blind spot as the write verification: `manifest.dir` is optional in
    // Obsidian's own typing, and without it there is no file to read. Recorded
    // in the plan's risks rather than papered over.
    if (path === null || this.settingsWriter === undefined) return;

    let raw: string;
    try {
      raw = await this.app.vault.adapter.read(path);
    } catch (err) {
      console.warn("[Projects+] settings changed on disk but could not be read:", err);
      return;
    }

    const decision = reconcileSettings<LatestProjectsPluginSettings>({
      diskRaw: raw,
      memory: get(settings),
      base: this.confirmedOnDisk,
      // Not the status: `push` schedules a write and leaves the status `idle`
      // until it starts, so a status-based check would adopt the disk over a
      // change made half a second ago.
      pending: this.settingsWriter.hasPending(),
      expectedVersion: DEFAULT_SETTINGS.version,
    });

    if (decision.kind === "ignore") {
      console.debug(`[Projects+] settings file changed; ${decision.reason}`);
      return;
    }
    if (decision.kind === "keep") {
      // A half-written file is what a synchroniser looks like from here, and
      // the completed write usually fires this again a moment later. Memory
      // stays: at load an unreadable file yields defaults, and doing that HERE
      // would put defaults over live working state — data loss created by the
      // mechanism meant to prevent it.
      //
      // But "usually" is not "always", and the adversarial review named the
      // gap: if the file STAYS truncated, our own next ordinary write erases
      // it, and those bytes were the only copy of what the other writer meant.
      // So the silence is bounded — one delayed re-read, and if it still does
      // not parse the bytes are preserved like any other conflict.
      console.warn("[Projects+] settings file changed but does not parse; keeping memory");
      this.recheckUnparsableSettings();
      return;
    }
    if (decision.kind === "conflict") {
      const preserved = await this.preserveConflicting(raw, decision.reason);
      // Only once the other version is safely beside the file does memory
      // become the file. Without this the disk keeps the other version and the
      // next ordinary save overwrites it anyway — the defect #200 opened with,
      // minus the loss. With the copy refused, the disk is the ONLY place that
      // version exists, so nothing is written and the user is told to copy it.
      if (preserved) this.settingsWriter.pushImmediate(get(settings));
      return;
    }

    // Adoption goes through the SAME resolver the load path uses. The
    // adversarial review found the hole: a payload can carry `version: 4` and
    // nothing else, and putting that raw object into the store hands every
    // consumer a shape it does not expect. `reconcileSettings` now refuses a
    // payload with no project list, and this refuses everything else the
    // resolver refuses — one gate for the shape, one for the semantics.
    const resolved = migrateSettings(decision.settings);
    if (either.isLeft(resolved)) {
      logWarning(SETTINGS_CONFLICT, "external payload did not resolve:", resolved.left);
      const preserved = await this.preserveConflicting(raw, "unresolvable");
      if (preserved) this.settingsWriter.pushImmediate(get(settings));
      return;
    }

    // `prime` BEFORE `set`, because the store subscription writes whatever it
    // is handed — the same echo #185 removed at load, arriving by a second
    // route. Primed first, the subscription's firing is a no-op.
    const adopted = resolved.right;
    this.settingsWriter.prime(adopted);
    this.loadedSettings = adopted;
    // The FILE's canonical form, not the resolved one: this is the record of
    // what is on disk, and normalisation happens only in memory — exactly as
    // at load, which does not rewrite the file for filling in a default.
    this.confirmedOnDisk = canonical(JSON.parse(raw));
    settings.set(adopted);
    if (decision.carried) {
      // The one merged field (user's decision, 2026-09-07): a project's
      // `uniqueIdCounter` was higher here than on disk. Memory now holds the
      // higher one, and the file must too — otherwise the next window to adopt
      // this file reissues identifiers that are already in notes.
      this.settingsWriter.pushImmediate(adopted);
    }
    console.debug("[Projects+] settings adopted from disk");
  }

  /**
   * #200, from the adversarial review — the bound on the silence above.
   *
   * A file that does not parse is almost always a synchroniser caught between
   * two writes, and the completed write fires the hook again. "Almost always"
   * is the problem: if it stays truncated, nothing here ever looks at it again
   * and this plugin's next ordinary save erases it. One delayed re-read closes
   * that without turning every half-written moment into a notice.
   *
   * Writes are deliberately NOT blocked meanwhile. Blocking is what the plan
   * rejected in model (в): it turns a rare event into a session where nothing
   * saves and there is no way out but a restart.
   */
  private recheckUnparsableSettings(): void {
    if (this.unparsableRecheck !== null) return;
    this.unparsableRecheck = window.setTimeout(() => {
      this.unparsableRecheck = null;
      void this.onUnparsableSettlement();
    }, SETTINGS_UNPARSABLE_RECHECK_MS);
  }

  private async onUnparsableSettlement(): Promise<void> {
    const path = settingsFilePath(this.manifest.dir);
    if (path === null) return;
    let raw: string;
    try {
      raw = await this.app.vault.adapter.read(path);
    } catch {
      return;
    }
    try {
      JSON.parse(raw);
    } catch {
      // Still not settings after the delay. Whatever those bytes are, they are
      // the only copy of what somebody else wrote, and our next save will take
      // the file. Preserve them and say so — the same two codes as any other
      // conflict, because from the user's side it is the same event.
      await this.preserveConflicting(raw, "unparsable");
      return;
    }
    // It settled into something readable: run the ordinary decision on it,
    // rather than adopting here by a second, less careful path.
    await this.onExternalSettingsChange();
  }

  /**
   * #200 — keep the version this session refused, and say where it is.
   *
   * The copy is what makes the conflict branch non-destructive, so whether it
   * was actually written decides which message the user gets. #195 learned that
   * one level down: a notice naming a backup that was never written sends the
   * user to look for a file that does not exist.
   */
  private async preserveConflicting(raw: string, reason: string): Promise<boolean> {
    const copiedTo = await writeConflictCopy(
      this.app.vault.adapter,
      this.manifest.dir,
      raw,
      new Date()
    );
    if (copiedTo === null) {
      logError(SETTINGS_CONFLICT_UNCOPIED, `reason: ${reason}`);
      new Notice(noticeFor(SETTINGS_CONFLICT_UNCOPIED), 15000);
      return false;
    }
    logWarning(SETTINGS_CONFLICT, `reason: ${reason}; other version kept at ${copiedTo}`);
    new Notice(noticeFor(SETTINGS_CONFLICT, { path: copiedTo }), 15000);
    return true;
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
  /**
   * #199 — is `value` what `data.json` now holds?
   *
   * `true` when the plugin folder is unknown: without it there is nothing to
   * read back, and a permanent false alarm would be worse than the weaker
   * guarantee. Any other doubt — unreadable file, mismatch, unparseable text —
   * is reported as a failed write, because a half-written file is exactly the
   * case worth catching.
   */
  private async settingsAreOnDisk(
    value: LatestProjectsPluginSettings
  ): Promise<WriteVerdict> {
    const path = settingsFilePath(this.manifest.dir);
    if (path === null) return "confirmed";
    // A mismatch is looked at more than once before it is believed. The host
    // may resolve its write before the bytes land, and a check that raced it
    // would raise the "not saved" chip on perfectly good saves — a control
    // that cries wolf is worse than the silence it replaces, because the user
    // learns to ignore it.
    for (const delayMs of [0, 250, 750]) {
      if (delayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }
      let raw: string;
      try {
        raw = await this.app.vault.adapter.read(path);
      } catch (err) {
        console.error("[Projects+] Could not read settings back to verify:", err);
        continue;
      }
      const verdict = classifyDisk(value, raw, this.confirmedOnDisk);
      if (verdict === "confirmed") {
        this.confirmedOnDisk = canonical(value);
        return "confirmed";
      }
      if (verdict === "superseded") {
        // Someone else — a second window, a synchroniser — replaced the file.
        // Retrying would overwrite their change with a value they never asked
        // for, so this writer stops here. It does NOT report success quietly:
        // a silent host failure can hide inside this case (write refused, then
        // an external write lands), and the honest thing is to say the state
        // is unknown rather than to pick a side. #200 covers reconciling it.
        logWarning(SETTINGS_SUPERSEDED, "not retrying");
        this.confirmedOnDisk = null;
        new Notice(noticeFor(SETTINGS_SUPERSEDED), 15000);
        // #200 step 1: this used to return `true` — the writer filed a write it
        // could not confirm as a success. Every argument about who owns the
        // file rested on that status, so it stops saying something untrue
        // before anything is built on top of it.
        return "diverged";
      }
    }
    return "not-written";
  }

  /**
   * #195 — copy the unreadable settings file next to itself, and say where.
   *
   * Returns the path written or `null`. The caller MUST branch on that: a notice
   * naming a file that was never written is the same broken promise the copy
   * exists to prevent, one level down.
   */
  private async copyBrokenSettings(reason: string): Promise<string | null> {
    const adapter = this.app.vault.adapter;
    const dir = this.manifest.dir;
    const raw = await readRawSettings(adapter, dir);
    if (raw === null) {
      console.error(
        "[Projects+] Could not read the settings file back for a forensic copy"
      );
      return null;
    }
    const path = await writeBrokenCopy(adapter, dir, raw, reason, new Date());
    if (path === null) {
      console.error("[Projects+] Failed to write the forensic copy of settings");
    }
    return path;
  }

  async loadSettings(): Promise<void> {
    let raw: unknown = null;
    try {
      raw = await this.loadData();
    } catch (err) {
      logError(SETTINGS_UNREADABLE, err);
      // #195: this is the COMMONEST corruption — a truncated write leaves JSON
      // that Obsidian's own parse rejects, so there is no object to migrate and
      // the previous version made no copy at all. The bytes on disk are the only
      // evidence, and the first settings change the user makes overwrites them.
      const copiedTo = await this.copyBrokenSettings(
        err instanceof Error ? err.message : String(err)
      );
      // #202 adds the token and leaves the sentences alone. Both branches are
      // the same event with different outcomes for the forensic copy — one
      // code, and which branch ran is what the words already say. The warning
      // about the next save overwriting the evidence is load-bearing and stays
      // in the Notice rather than moving to a tooltip nothing raises here.
      new Notice(
        withCode(
          copiedTo === null
            ? "Projects+: failed to load settings — using defaults. The file on disk was left untouched but could NOT be copied: back it up before changing anything, or the next save overwrites it. See the console."
            : `Projects+: failed to load settings — using defaults. The unreadable file was copied to "${copiedTo}".`,
          SETTINGS_UNREADABLE
        ),
        15000
      );
      this.publishSettings(Object.assign({}, DEFAULT_SETTINGS));
      return;
    }

    const result = migrateSettings(raw);
    if (either.isLeft(result)) {
      logError(SETTINGS_CORRUPTED, result.left, "raw payload:", raw);
      // Persist a backup of the broken payload so the user can recover manually.
      // #185, second pass: whether this SUCCEEDED decides what the notice may
      // claim. The previous version swallowed the rejection and promised a
      // backup regardless — sending the user to look for keys that were never
      // written, which is the same defect this ticket exists to close, one
      // level down.
      // #195: and the copy no longer goes INSIDE data.json. That file is
      // rewritten whole by every ordinary save, so the copy used to survive only
      // until the next one — which a live run showed arriving immediately, since
      // an empty project list sends the user through onboarding and creating the
      // demo project saves settings over it.
      const copiedTo = await this.copyBrokenSettings(result.left.message);
      new Notice(
        withCode(
          copiedTo !== null
            ? `Projects+: settings file is corrupted (${result.left.message}). Defaults restored; the original payload was copied to "${copiedTo}".`
            : `Projects+: settings file is corrupted (${result.left.message}). Defaults restored, but the original payload could NOT be copied — do not change any setting if you want to recover it, because the next save rewrites data.json. See the console.`,
          SETTINGS_CORRUPTED
        ),
        15000
      );
      // #185: the defaults must NOT be written back here — the file on disk is
      // the forensic copy, and rewriting it is what used to delete the backup
      // the Notice above points at.
      this.publishSettings(Object.assign({}, DEFAULT_SETTINGS));
      return;
    }

    this.migratedFromVersion = versionOnDisk(raw, DEFAULT_SETTINGS.version);
    // #199: the file's own content is the starting point for telling "our write
    // did not land" from "someone else replaced the file". Only set on the path
    // where `raw` really is what is on disk — the corruption paths publish
    // defaults, which the file does NOT hold.
    this.confirmedOnDisk = canonical(raw);
    this.publishSettings(result.right);
  }

  /**
   * #185 — put `value` into the store and remember the exact object, so the
   * writer can be primed with the reference that is already on disk.
   */
  private publishSettings(value: LatestProjectsPluginSettings): void {
    this.loadedSettings = value;
    settings.set(value);
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

