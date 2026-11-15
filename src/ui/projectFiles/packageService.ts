import { TFile, TFolder, type Plugin } from "obsidian";
import { get } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import { settingsFilePath } from "src/lib/settings/brokenBackup";
import { canonical } from "src/lib/settings/settingsVerify";
import { textDigest, projectFileError } from "src/lib/projectFiles/document";
import { binaryDigest, packageFilePath, PACKAGE_LIMITS, prepareProjectPackage, type PreparedProjectPackage } from "src/lib/projectFiles/package";
import { configuredCopyRoots, isProjectCopyPath, nextCopyPreferences, projectFilesRoot } from "src/lib/projectFiles/paths";
import { createProjectZip } from "src/lib/projectFiles/packageZip";
import { projectVaultStorage } from "src/lib/projectFiles/vaultStorage";
import { ensureProjectFolders } from "src/lib/projectFiles/storage";
import type { LatestProjectsPluginSettings } from "src/settings/settings";
import { inspectProjectPackage, type InspectedProjectPackage } from "src/lib/projectFiles/packageInspect";
import { PackageInspectionError } from "src/lib/projectFiles/packagePolicy";
import { stageProjectPackage, type StageReceipt } from "src/lib/projectFiles/packageStage";
import { stageVaultStorage } from "src/lib/projectFiles/stageVaultStorage";
import type { PackageFilePlan, VaultPathEntry } from "src/lib/projectFiles/packageFilePlan";
import { previewPackageConfigPaths, type PackageConfigPathPreview } from "src/lib/projectFiles/packageConfigPaths";
import { captureConfigPathChoices, type ConfigPathChoice } from "src/lib/projectFiles/packagePathBindings";
import { capturePackageScopeChoices, reviewPackageScopes, type PackageScopeChoice, type PackageScopeReview } from "src/lib/projectFiles/packageScopeChoices";
import type { ProjectCoreCheck } from "src/lib/projectFiles/projectCoreCheck";
import { checkPackageGraph } from "src/lib/projectFiles/packageGraphCheck";

export interface PackageDestinationPreview extends PackageFilePlan { readonly configuration: PackageConfigPathPreview; readonly scopeReview: PackageScopeReview; readonly coreChecks: readonly { readonly projectId: string; readonly name: string; readonly check: ProjectCoreCheck }[] }

/** Metadata only, never query results. Stable ordering avoids unnecessary reconfirmation. */
function scopeInventoryStamp(loaded: readonly import("obsidian").TAbstractFile[]): string {
  if (loaded.length > 100000) throw projectFileError("file preview inventory too large");
  let characters = 0;
  const items = loaded.map(file => {
    if (!(file instanceof TFile) && !(file instanceof TFolder)) throw projectFileError("unknown vault entry");
    if (typeof file.path !== "string" || file.path.length > 4096 || (characters += file.path.length) > 16 * 1024 * 1024) throw projectFileError("file preview inventory too large");
    return file instanceof TFile ? { path: file.path, kind: "file", size: file.stat.size, mtime: file.stat.mtime } : { path: file.path, kind: "folder" };
  });
  items.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0);
  return JSON.stringify(items);
}

export class ProjectPackageService {
  private busy = false;
  private retired = false;
  constructor(private readonly host: Plugin, private readonly flush: () => Promise<void>, private readonly confirmed: () => string | null,
    private readonly alive: () => boolean) {}

  dispose(): void { this.retired = true; }
  private check = () => { if (this.retired || !this.alive()) throw projectFileError("operation retired"); };

  private async snapshot(): Promise<LatestProjectsPluginSettings> {
    this.check(); await this.flush(); this.check();
    const path = settingsFilePath(this.host.manifest.dir);
    if (!path) throw projectFileError("settings unavailable");
    const raw: unknown = JSON.parse(await this.host.app.vault.adapter.read(path));
    this.check();
    if (canonical(raw) !== this.confirmed() || canonical(raw) !== canonical(get(settings))) throw projectFileError("settings not confirmed on disk");
    return JSON.parse(JSON.stringify(raw)) as LatestProjectsPluginSettings;
  }

  eligible(path: string): boolean {
    try { packageFilePath(path, this.host.app.vault.configDir); }
    catch { return false; }
    return !isProjectCopyPath(path, configuredCopyRoots(get(settings).preferences.projectFiles)) && !/\.zip$/i.test(path);
  }

  /** Read-only entry point: no primary flush/save, folders, extraction or config application. */
  async inspect(path: string): Promise<InspectedProjectPackage> {
    if (this.busy) throw projectFileError("package operation busy");
    this.busy = true;
    try { return await this.readPackage(path); } finally { this.busy = false; }
  }

  /** Fresh integrity check and placement preview only: never flushes settings or creates folders. */
  async previewFiles(path: string, expectedHash: string, destination: string, inputChoices: readonly ConfigPathChoice[] = [], inputScopes: readonly PackageScopeChoice[] = []): Promise<PackageDestinationPreview> {
    if (this.busy) throw projectFileError("package operation busy");
    const choices = captureConfigPathChoices(inputChoices);
    const scopes = capturePackageScopeChoices(inputScopes);
    this.busy = true;
    try {
      const inspected = await this.readPackage(path);
      if (inspected.archiveHash !== expectedHash) throw projectFileError("archive preview is stale");
      this.check();
      const loaded = this.host.app.vault.getAllLoadedFiles();
      if (loaded.length > 100000) throw projectFileError("file preview inventory too large");
      const inventory: VaultPathEntry[] = loaded.map(file => {
        if (!(file instanceof TFile) && !(file instanceof TFolder)) throw projectFileError("unknown vault entry");
        return { path: file.path, kind: file instanceof TFile ? "file" : "folder" };
      });
      const roots = configuredCopyRoots(get(settings).preferences.projectFiles);
      const graph = checkPackageGraph(inspected.documents.map(document => document.project));
      const coreChecks = graph.coreChecks;
      const pathConfiguration = previewPackageConfigPaths(inspected.documents.map(document => document.project), inspected.manifest, destination, inventory, this.host.app.vault.configDir, roots, choices);
      const issues = [...pathConfiguration.issues];
      for (const item of coreChecks) for (const issue of item.check.issues) if (issue.code !== "section-unchecked") {
        if (issues.length >= PACKAGE_LIMITS.dependencies) throw projectFileError("too many configuration diagnostics");
        issues.push(Object.freeze({ projectId: item.projectId, location: issue.location, code: issue.code === "unknown-field" || issue.code === "unknown-kind" ? "schema-unsupported" : "schema-invalid" }));
      }
      for (const issue of graph.issues) {
        if (issues.length >= PACKAGE_LIMITS.dependencies) throw projectFileError("too many configuration diagnostics");
        issues.push(Object.freeze({ projectId: issue.projectId, location: issue.location, code: issue.code === "unsupported-config" || issue.code === "unsupported-context" ? "schema-unsupported" : "schema-invalid" }));
      }
      const configuration = Object.freeze({ ...pathConfiguration, issues: Object.freeze(issues) });
      const stamp = scopeInventoryStamp(loaded), policy = JSON.stringify([this.host.app.vault.configDir, roots]);
      const inventoryRevision = await textDigest(stamp); this.check();
      const basis = await textDigest(JSON.stringify({ archiveHash: inspected.archiveHash, destination, inventoryRevision, policy, choices })); this.check();
      const scopeReview = await reviewPackageScopes(configuration, basis, scopes, this.check);
      if (scopeInventoryStamp(this.host.app.vault.getAllLoadedFiles()) !== stamp || JSON.stringify([this.host.app.vault.configDir, configuredCopyRoots(get(settings).preferences.projectFiles)]) !== policy) throw projectFileError("source scope preview changed");
      this.check(); return Object.freeze({ ...configuration.files, configuration: Object.freeze({ ...configuration, issues: scopeReview.issues }), scopeReview, coreChecks });
    } finally { this.busy = false; }
  }

  private async readPackage(path: string): Promise<InspectedProjectPackage> {
    this.check(); packageFilePath(path, this.host.app.vault.configDir);
    const file = this.host.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw projectFileError("archive missing");
    if (file.stat.size > PACKAGE_LIMITS.archiveBytes) throw new PackageInspectionError("size-limit");
    const before = { ...file.stat };
    const bytes = new Uint8Array(await this.host.app.vault.readBinary(file));
    this.check();
    if (this.host.app.vault.getAbstractFileByPath(path) !== file || before.size !== file.stat.size || before.mtime !== file.stat.mtime || bytes.length !== before.size) throw projectFileError("archive changed during capture");
    return inspectProjectPackage(bytes, this.host.app.vault.configDir, this.check);
  }

  async stage(path: string, expectedHash: string, expectedRoot: string): Promise<StageReceipt> {
    if (this.busy) throw projectFileError("package operation busy");
    this.busy = true;
    try {
      // Re-read the original ZIP: displayed mutable objects are not write authority.
      const inspected = await this.readPackage(path);
      if (inspected.archiveHash !== expectedHash) throw projectFileError("archive preview is stale");
      const root = projectFilesRoot(expectedRoot, this.host.app.vault.configDir);
      const current = get(settings);
      if (this.confirmed() !== null && !current.preferences.projectFiles) {
        // A known fresh or resolved/defaulted base may have no dirty settings
        // for the primed writer to flush yet. Queue the explicit first binding
        // through that ordinary checked writer, never through a direct save.
        // Unknown/corrupt bases do not authorize this initialization.
        if (root !== "Projects Plus") throw projectFileError("staging destination changed");
        this.check();
        settings.updatePreferences({ ...current.preferences, projectFiles: nextCopyPreferences(undefined, root, false, this.host.app.vault.configDir) });
      }
      let value = await this.snapshot();
      if ((value.preferences.projectFiles?.root ?? "Projects Plus") !== root) throw projectFileError("staging destination changed");
      if (!value.preferences.projectFiles) {
        const expected = canonical(value);
        this.check();
        if (canonical(get(settings)) !== expected || this.confirmed() !== expected) throw projectFileError("settings changed before staging");
        // The explicit first staging action binds its visible namespace so live
        // data sources exclude reserved entries before Vault events arrive.
        settings.updatePreferences({ ...value.preferences, projectFiles: nextCopyPreferences(undefined, root, false, this.host.app.vault.configDir) });
        value = await this.snapshot();
      }
      if (value.preferences.projectFiles?.root !== root) throw projectFileError("staging destination changed");
      const expected = canonical(value);
      const check = () => {
        this.check();
        if (canonical(get(settings)) !== expected || this.confirmed() !== expected) throw projectFileError("settings changed during staging");
      };
      const receipt = await stageProjectPackage(stageVaultStorage(this.host.app.vault, check), root, inspected, this.host.app.vault.configDir, check);
      check(); return receipt;
    } finally { this.busy = false; }
  }

  async prepare(projectId: string, paths: readonly string[]): Promise<PreparedProjectPackage> {
    if (this.busy) throw projectFileError("package operation busy");
    this.busy = true;
    try {
      const value = await this.snapshot();
      const result = await prepareProjectPackage(value, projectId, paths, async path => {
        this.check();
        if (!this.eligible(path)) throw projectFileError("file excluded from package");
        const file = this.host.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile) || file.stat.size > PACKAGE_LIMITS.fileBytes) throw projectFileError("file missing or too large");
        const before = { ...file.stat };
        const bytes = new Uint8Array(await this.host.app.vault.readBinary(file));
        this.check();
        if (this.host.app.vault.getAbstractFileByPath(path) !== file || before.size !== file.stat.size || before.mtime !== file.stat.mtime || bytes.length !== before.size) throw projectFileError("file changed during capture");
        return bytes;
      }, this.host.app.vault.configDir);
      const current = await this.snapshot();
      if (await textDigest(JSON.stringify(current)) !== result.settingsRevision) throw projectFileError("settings changed during package preview");
      return result;
    } finally { this.busy = false; }
  }

  async save(prepared: PreparedProjectPackage): Promise<{ path: string; bytes: number; sha256: string }> {
    if (this.busy) throw projectFileError("package operation busy");
    this.busy = true;
    try {
      const value = await this.snapshot();
      if (await textDigest(JSON.stringify(value)) !== prepared.settingsRevision) throw projectFileError("package preview is stale");
      const input = value.preferences.projectFiles?.root;
      if (!input) throw projectFileError("destination not configured");
      const root = projectFilesRoot(input, this.host.app.vault.configDir);
      const zip = await createProjectZip(prepared, this.check);
      const hash = await binaryDigest(zip);
      // Reconfirm after encoding; a changed configuration requires a new preview.
      if (await textDigest(JSON.stringify(await this.snapshot())) !== prepared.settingsRevision) throw projectFileError("package preview is stale");
      const folder = root + "/Packages";
      await ensureProjectFolders(projectVaultStorage(this.host.app.vault, () => !this.retired && this.alive()), folder);
      this.check();
      const path = `${folder}/${await textDigest(prepared.manifest.rootProjectId)}-${hash}.zip`;
      const latest = await this.snapshot();
      if (await textDigest(JSON.stringify(latest)) !== prepared.settingsRevision) throw projectFileError("package preview is stale");
      // The final asynchronous preparation is complete. Keep this synchronous
      // guard adjacent to the host write; a UI/confirmed update during mkdir or
      // digest must not authorize writing into the previous destination.
      const expected = canonical(value);
      const checkCurrent = () => {
        this.check();
        if (canonical(get(settings)) !== expected || this.confirmed() !== expected) throw projectFileError("package preview is stale");
      };
      checkCurrent();
      let file = this.host.app.vault.getAbstractFileByPath(path);
      if (!file) {
        checkCurrent();
        file = await this.host.app.vault.createBinary(path, new Uint8Array(zip).buffer);
      }
      if (!(file instanceof TFile) || file.stat.size !== zip.length) throw projectFileError("package destination conflict");
      const before = { ...file.stat };
      const saved = new Uint8Array(await this.host.app.vault.readBinary(file));
      this.check();
      if (await binaryDigest(saved) !== hash || this.host.app.vault.getAbstractFileByPath(path) !== file || before.size !== file.stat.size || before.mtime !== file.stat.mtime) throw projectFileError("package read-back failed");
      checkCurrent();
      return { path, bytes: zip.length, sha256: hash };
    } finally { this.busy = false; }
  }
}
