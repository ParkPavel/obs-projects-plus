import { Notice, type Plugin } from "obsidian";
import { get, writable } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import { i18n } from "src/lib/stores/i18n";
import { canonical } from "src/lib/settings/settingsVerify";
import { settingsFilePath } from "src/lib/settings/brokenBackup";
import type { LatestProjectsPluginSettings } from "src/settings/settings";
import { syncProjectCopies, type MirrorReceipt } from "src/lib/projectFiles/mirror";
import { projectVaultStorage } from "src/lib/projectFiles/vaultStorage";
import { projectFileError } from "src/lib/projectFiles/document";
import { projectFilesRoot } from "src/lib/projectFiles/paths";
import { ProjectFilesModal } from "./modal";

export interface ProjectFilesStatus {
  kind: "idle" | "pending" | "waiting" | "copying" | "saved" | "failed";
  receipt?: MirrorReceipt;
}
class UnconfirmedProjectSettings extends Error {}

/** One coalesced outbound queue. No incoming file event can mutate active settings. */
export class ProjectFilesController {
  readonly status = writable<ProjectFilesStatus>({ kind: "idle" });
  private alive = true;
  private timer: number | undefined;
  private pending = false;
  private running: Promise<MirrorReceipt> | undefined;
  private modal?: ProjectFilesModal;
  private packageModal?: { open(): void; close(): void };
  private failureReported = false;
  private observedCopyPreferences: LatestProjectsPluginSettings["preferences"]["projectFiles"];
  private initializeRoot: string | undefined;

  constructor(private readonly host: Plugin, private readonly flush: () => Promise<void>, private readonly confirmed: () => string | null) {
    host.addCommand({ id: "project-files", name: get(i18n).t("project-files.title"), callback: () => this.open() });
    host.addCommand({ id: "project-package", name: get(i18n).t("project-package.title"), callback: () => { void this.openPackages(); } });
    host.register(() => this.dispose());
    this.observedCopyPreferences = get(settings).preferences.projectFiles;
    this.onConfirmed(get(settings));
  }

  open(): void {
    if (!this.alive) return;
    this.packageModal?.close();
    this.modal?.close();
    this.modal = new ProjectFilesModal(this.host.app, this);
    this.modal.open();
  }

  async openPackages(): Promise<void> {
    if (!get(settings).preferences.projectFiles) { this.open(); return; }
    const [{ ProjectPackageModal }, { ProjectPackageService }] = await Promise.all([import("./packageModal"), import("./packageService")]);
    if (!this.alive) return;
    this.modal?.close();
    this.packageModal?.close();
    this.packageModal = new ProjectPackageModal(this.host.app, new ProjectPackageService(this.host, this.flush, this.confirmed, () => this.alive));
    this.packageModal.open();
  }

  onConfirmed(value: LatestProjectsPluginSettings): void {
    if (!this.alive) return;
    const next = value.preferences.projectFiles, before = this.observedCopyPreferences;
    this.observedCopyPreferences = next;
    if (!next?.autoSync) {
      this.initializeRoot = undefined;
      this.pending = false;
      window.clearTimeout(this.timer);
      return;
    }
    if (!before?.autoSync || before.root !== next.root) this.initializeRoot = next.root;
    this.pending = true;
    if (!this.running) this.schedule();
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    this.status.set({ kind: "pending" });
    this.timer = window.setTimeout(() => {
      if (!this.alive || !this.pending) return;
      this.pending = false;
      void this.start(false).catch(() => { /* Standing status exposes the failed copy; primary save remains intact. */ });
    }, 800);
  }

  sync(): Promise<MirrorReceipt> {
    return this.start(true);
  }

  private start(manual: boolean): Promise<MirrorReceipt> {
    if (!this.alive) return Promise.reject(projectFileError("operation retired"));
    if (this.running) return this.running;
    window.clearTimeout(this.timer);
    this.pending = false;
    this.status.set({ kind: "copying" });
    this.running = this.copy(manual).then(receipt => {
      this.failureReported = false;
      if (this.alive) this.status.set({ kind: "saved", receipt });
      return receipt;
    }, error => {
      if (this.alive && error instanceof UnconfirmedProjectSettings) {
        this.status.set({ kind: "waiting" });
      } else if (this.alive) {
        this.status.set({ kind: "failed" });
        if (!this.failureReported) new Notice(get(i18n).t("project-files.failed"), 10000);
        this.failureReported = true;
      }
      throw error;
    }).finally(() => {
      this.running = undefined;
      if (this.alive && this.pending) this.schedule();
    });
    return this.running;
  }

  private async copy(manual: boolean): Promise<MirrorReceipt> {
    await this.flush();
    const path = settingsFilePath(this.host.manifest.dir);
    if (!path || !this.alive) throw projectFileError("settings unavailable");
    const raw: unknown = JSON.parse(await this.host.app.vault.adapter.read(path));
    const value = get(settings);
    if (canonical(raw) !== this.confirmed() || canonical(raw) !== canonical(value)) {
      throw new UnconfirmedProjectSettings("settings not confirmed on disk");
    }
    const input = value.preferences.projectFiles?.root;
    if (!input) throw projectFileError("destination not configured");
    const root = projectFilesRoot(input, this.host.app.vault.configDir);
    const allowInitialize = manual || this.initializeRoot === root;
    if (this.initializeRoot === root) this.initializeRoot = undefined;
    const storage = projectVaultStorage(this.host.app.vault, () => this.alive);
    if (!allowInitialize && await storage.read(root + "/sync-index.json") === null) throw projectFileError("copy folder binding missing");
    const receipt = await syncProjectCopies(storage, root,
      JSON.parse(JSON.stringify(value)) as LatestProjectsPluginSettings, this.host.app.vault.configDir);
    if (canonical(raw) === this.confirmed()) this.pending = false;
    return receipt;
  }

  async runWithNotice(): Promise<void> {
    try { await this.sync(); }
    catch { /* The standing status and one notice per failure episode already explain it. */ }
  }

  dispose(): void {
    this.alive = false;
    this.pending = false;
    window.clearTimeout(this.timer);
    this.modal?.close();
    this.packageModal?.close();
  }
}
