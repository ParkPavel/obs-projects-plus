import { TFile, type Plugin } from "obsidian";
import type { ProjectDefinition, LatestProjectsPluginSettings } from "src/settings/settings";
import type { InstallationPrimary, InstalledProjectConfiguration } from "src/lib/projectFiles/packageInstallation";
import { createProjectConfiguration, parseProjectConfiguration } from "src/lib/projectFiles/projectConfiguration";
import { createProjectDocument, printProjectDocument, parseProjectDocument, projectFileError, textDigest, MAX_PROJECT_DOCUMENT_BYTES } from "src/lib/projectFiles/document";
import { configuredCopyRoots, projectFilesRoot } from "src/lib/projectFiles/paths";
import { checkPackageGraph } from "src/lib/projectFiles/packageGraphCheck";
import { directPackageReferences, packageDependencies } from "src/lib/projectFiles/packageDependencies";
import { parseBaseRef } from "src/lib/relations/baseRef";
import { projectVaultStorage } from "src/lib/projectFiles/vaultStorage";
import { ensureProjectFolders, writeProjectSnapshot, checkedProjectWrite } from "src/lib/projectFiles/storage";
import { canonical } from "src/lib/settings/settingsVerify";
import { checkProjectCoreJson } from "src/lib/projectFiles/projectCoreCheck";
import { syncProjectCopies } from "src/lib/projectFiles/mirror";
import { canonicalPackageProject } from "src/lib/projectFiles/packageCanonical";

export type ConfigurationApplyMode = "draft" | "restore";
export interface ConfigurationChange { readonly location: readonly (string | number)[]; readonly before: string; readonly after: string }
export interface ConfigurationApplyPreview {
  readonly path: string; readonly mode: ConfigurationApplyMode; readonly projectId: string; readonly name: string;
  readonly sourceHash: string; readonly settingsRevision: string; readonly changes: readonly ConfigurationChange[];
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const allProjects = (value: LatestProjectsPluginSettings) => [...value.projects, ...value.archives];
const settingsRevision = (value: LatestProjectsPluginSettings) => textDigest(JSON.stringify(value));
function replaceProject(value: LatestProjectsPluginSettings, project: ProjectDefinition): LatestProjectsPluginSettings {
  return { ...value, projects: value.projects.map(item => item.id === project.id ? project : item), archives: value.archives.map(item => item.id === project.id ? project : item) };
}
function changes(before: unknown, after: unknown): readonly ConfigurationChange[] {
  const result: ConfigurationChange[] = []; let work = 0;
  const describe = (value: unknown) => value === undefined ? "—" : JSON.stringify(value).slice(0, 1000);
  const visit = (a: unknown, b: unknown, at: readonly (string | number)[], depth: number) => {
    if (++work > 32768 || depth > 32 || result.length > 4096) throw projectFileError("configuration diff too complex");
    if (a === b) return;
    if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
      const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
      const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
      if (!Array.isArray(a) && leftKeys.length === rightKeys.length && leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key)) && JSON.stringify(leftKeys) !== JSON.stringify(rightKeys)) result.push(Object.freeze({ location: Object.freeze([...at, "$key-order"]), before: describe(leftKeys), after: describe(rightKeys) }));
      // coercion-exempt: Class B - structural array-index token from Object.keys, never record data.
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) visit(Object.prototype.hasOwnProperty.call(left, key) ? left[key] : undefined, Object.prototype.hasOwnProperty.call(right, key) ? right[key] : undefined, [...at, Array.isArray(a) ? Number(key) : key], depth + 1);
    } else result.push(Object.freeze({ location: Object.freeze([...at]), before: describe(a), after: describe(b) }));
  };
  visit(before, after, [], 0); return Object.freeze(result);
}

/** Explicit incoming edits use the same confirmed writer as import; outbound conflicts preserve drafts. */
export class ProjectConfigurationService {
  private retired = false;
  constructor(private readonly host: Plugin, private readonly primary: InstallationPrimary, private readonly alive: () => boolean) {}
  dispose(): void { this.retired = true; }
  private active = () => !this.retired && this.alive();
  private check = () => { if (!this.active()) throw projectFileError("configuration operation retired"); };
  private async read(path: string) {
    this.check(); projectFilesRoot(path, this.host.app.vault.configDir);
    const file = this.host.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.stat.size > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("configuration file unavailable");
    const before = { ...file.stat }, text = await this.host.app.vault.read(file); this.check();
    if (new TextEncoder().encode(text).length > MAX_PROJECT_DOCUMENT_BYTES || this.host.app.vault.getAbstractFileByPath(path) !== file || file.stat.size !== before.size || file.stat.mtime !== before.mtime) throw projectFileError("configuration changed during capture");
    return text;
  }
  private descriptors(value: LatestProjectsPluginSettings): readonly InstalledProjectConfiguration[] {
    return value.preferences.projectFiles?.installations?.flatMap(item => item.configurations) ?? [];
  }
  eligible(path: string, mode: ConfigurationApplyMode, value: LatestProjectsPluginSettings): boolean {
    if (mode === "draft" && this.descriptors(value).some(item => item.path === path)) return true;
    return configuredCopyRoots(value.preferences.projectFiles).some(root => path.startsWith(root + "/") &&
      (mode === "restore" ? /^Backups\/[a-f0-9]{64}\/[a-f0-9]{64}\.md$/.test(path.slice(root.length + 1)) : /^Projects\/[a-f0-9]{64}\/Project\.md$/.test(path.slice(root.length + 1))));
  }
  private async inspect(path: string, mode: ConfigurationApplyMode) {
    const value = await this.primary.read(); this.check();
    if (!this.eligible(path, mode, value)) throw projectFileError("configuration is not owned or a snapshot");
    const text = await this.read(path), sourceHash = await textDigest(text);
    const owned = path.endsWith(".json"), document = owned ? parseProjectConfiguration(text) : parseProjectDocument(text);
    const original = allProjects(value).find(item => item.id === document.project.id);
    if (!original) throw projectFileError("configuration project no longer exists");
    if (owned) {
      const descriptor = this.descriptors(value).find(item => item.projectId === original.id && item.path === path);
      if (!descriptor || descriptor.pendingWrite || !("owner" in document) || document.owner !== descriptor.owner) throw projectFileError("configuration owner mismatch or pending sync");
    } else if (mode === "draft" && !path.endsWith(`/Projects/${await textDigest(original.id)}/Project.md`)) throw projectFileError("configuration project path mismatch");
    const revision = await textDigest(JSON.stringify(original));
    if (checkProjectCoreJson(JSON.stringify(document.project)).issues.length) throw projectFileError("configuration schema unsupported");
    if (mode === "draft" && document.baseRevision !== revision) throw projectFileError("configuration draft has a stale base");
    if (mode === "restore") {
      if (!path.endsWith(`/${await textDigest(original.id)}/${sourceHash}.md`) || document.baseRevision !== await textDigest(JSON.stringify(document.project))) throw projectFileError("snapshot changed");
    }
    const project = { ...canonicalPackageProject(document.project), isDefault: original.isDefault,
      ...(original.uniqueIdCounter !== undefined || document.project.uniqueIdCounter !== undefined ? { uniqueIdCounter: Math.max(original.uniqueIdCounter ?? 0, document.project.uniqueIdCounter ?? 0) } : {}) };
    const candidate = replaceProject(value, project), affected = new Map<string, ProjectDefinition>();
    // Include incoming readers as well as outgoing dependencies: removing a
    // published block/source must not break an otherwise unrelated project.
    const incoming = new Map<string, Set<string>>();
    for (const item of allProjects(candidate)) for (const reference of directPackageReferences(item)) {
      const target = parseBaseRef(reference).projectId, readers = incoming.get(target) ?? new Set<string>();
      readers.add(item.id); incoming.set(target, readers);
    }
    const readers = new Set([project.id]), pending = [project.id];
    while (pending.length) for (const reader of incoming.get(pending.shift()!) ?? []) if (!readers.has(reader)) { readers.add(reader); pending.push(reader); }
    for (const reader of readers) for (const dependency of packageDependencies(candidate, reader).projects) affected.set(dependency.project.id, dependency.project);
    const graph = checkPackageGraph([...affected.values()]);
    if (!graph.referencesChecked || graph.issues.length || graph.coreChecks.some(item => item.check.issues.length)) throw projectFileError("configuration schema or references unsupported");
    const preview: ConfigurationApplyPreview = Object.freeze({ path, mode, projectId: project.id, name: project.name, sourceHash,
      settingsRevision: await settingsRevision(value), changes: changes(original, project) });
    this.check(); return { value, project, original, document, preview };
  }
  async preview(path: string, mode: ConfigurationApplyMode): Promise<ConfigurationApplyPreview> { return (await this.inspect(path, mode)).preview; }
  async apply(expected: ConfigurationApplyPreview): Promise<{ backup: string; draft: string; copyUpdated: boolean }> {
    const inspected = await this.inspect(expected.path, expected.mode), { value, project, original, preview } = inspected;
    if (preview.sourceHash !== expected.sourceHash || preview.settingsRevision !== expected.settingsRevision || preview.projectId !== expected.projectId) throw projectFileError("configuration preview stale");
    const root = value.preferences.projectFiles?.root;
    if (!root) throw projectFileError("copy destination unavailable");
    const text = printProjectDocument(await createProjectDocument(original)), backup = `${root}/Backups/${await textDigest(original.id)}/${await textDigest(text)}.md`;
    const storage = projectVaultStorage(this.host.app.vault, this.active);
    await ensureProjectFolders(storage, backup.slice(0, backup.lastIndexOf("/"))); this.check();
    await writeProjectSnapshot(storage, backup, text);
    const source = await this.read(expected.path);
    if (await textDigest(source) !== expected.sourceHash) throw projectFileError("configuration source changed");
    const draft = `${root}/Incoming/Configuration drafts/${await textDigest(project.id)}/${expected.sourceHash}.${expected.path.endsWith(".json") ? "json" : "md"}`;
    await ensureProjectFolders(storage, draft.slice(0, draft.lastIndexOf("/"))); this.check();
    await writeProjectSnapshot(storage, draft, source);
    const current = await this.primary.read(); this.check();
    if (await settingsRevision(current) !== expected.settingsRevision || await textDigest(await this.read(expected.path)) !== expected.sourceHash) throw projectFileError("configuration changed before application");
    let candidate = replaceProject(copy(current), project);
    if (expected.path.endsWith(".json")) {
      const preferences = candidate.preferences.projectFiles!;
      candidate = { ...candidate, preferences: { ...candidate.preferences, projectFiles: { ...preferences, installations: preferences.installations?.map(item => ({ ...item,
        configurations: item.configurations.map(config => config.path === expected.path ? { ...config, sha256: expected.sourceHash } : config) })) ?? [] } } };
    }
    if (await this.primary.commit(current, candidate, this.active) !== "confirmed") throw projectFileError("configuration publication unconfirmed");
    let copyUpdated = true;
    try {
      const latest = await this.primary.read(); this.check();
      if (JSON.stringify(allProjects(latest).find(item => item.id === project.id)) !== JSON.stringify(project)) throw projectFileError("project changed after application");
      if (!expected.path.endsWith(".json")) {
        if (expected.mode === "draft") await checkedProjectWrite(storage, expected.path, source, printProjectDocument(await createProjectDocument(project)));
        await syncProjectCopies(storage, root, latest, this.host.app.vault.configDir);
      }
      await this.syncOwned();
    } catch { copyUpdated = false; }
    return { backup, draft, copyUpdated };
  }

  /** A changed copy is a draft. Never overwrite it, even when the active project has also changed. */
  async syncOwned(): Promise<void> {
    let current = await this.primary.read(); this.check();
    const updates = new Map<string, InstalledProjectConfiguration>(), storage = projectVaultStorage(this.host.app.vault, this.active);
    const writes: { path: string; before: string; next: string; descriptor: InstalledProjectConfiguration }[] = [];
    // Read and validate the whole batch before changing its first file.
    for (const descriptor of this.descriptors(current)) {
      const project = allProjects(current).find(item => item.id === descriptor.projectId); if (!project) continue;
      const text = await this.read(descriptor.path), actualHash = await textDigest(text);
      const document = parseProjectConfiguration(text);
      if (document.owner !== descriptor.owner || document.project.id !== descriptor.projectId) throw projectFileError("configuration owner changed");
      const pending = descriptor.pendingWrite, owned = { ...descriptor }; delete owned.pendingWrite;
      if (pending) {
        if (Object.keys(pending).length !== 2 || !/^[a-f0-9]{64}$/.test(pending.sha256) || !/^[a-f0-9]{64}$/.test(pending.baseRevision)) throw projectFileError("invalid pending configuration write");
        if (actualHash === pending.sha256) {
          if (document.baseRevision !== pending.baseRevision || await textDigest(JSON.stringify(document.project)) !== pending.baseRevision) throw projectFileError("pending configuration payload changed");
          Object.assign(owned, pending);
        } else if (actualHash !== descriptor.sha256) throw projectFileError("owned configuration has external edits");
        updates.set(descriptor.path, owned);
      } else if (actualHash !== descriptor.sha256) throw projectFileError("owned configuration has external edits");
      const revision = await textDigest(JSON.stringify(project));
      if (revision === owned.baseRevision && JSON.stringify(document.project) === JSON.stringify(project)) continue;
      const next = await createProjectConfiguration(project, descriptor.owner);
      writes.push({ path: descriptor.path, before: text, next, descriptor: { ...owned, baseRevision: revision, sha256: await textDigest(next) } });
    }
    const publish = async (descriptors: ReadonlyMap<string, InstalledProjectConfiguration>) => {
      const latest = await this.primary.read(); this.check();
      if (canonical(latest) !== canonical(current)) throw projectFileError("configuration sync publication stale");
      const preferences = latest.preferences.projectFiles!;
      const candidate = { ...copy(latest), preferences: { ...copy(latest.preferences), projectFiles: { ...preferences,
        installations: preferences.installations?.map(item => ({ ...item, configurations: item.configurations.map(config => descriptors.get(config.path) ?? config) })) ?? [] } } };
      if (await this.primary.commit(latest, candidate, this.active) !== "confirmed") throw projectFileError("configuration sync publication unconfirmed");
      current = await this.primary.read(); this.check();
      if (canonical(current) !== canonical(candidate)) throw projectFileError("configuration changed during sync");
    };
    if (updates.size) await publish(updates);
    for (const write of writes) {
      const previous = this.descriptors(current).find(item => item.path === write.path)!;
      // Persist only hashes/revision, before writing bytes. A restart can then
      // distinguish the exact owned output from an external draft, even if the
      // active project changes before the interrupted acknowledgment is retried.
      await publish(new Map([[write.path, { ...previous, pendingWrite: { sha256: write.descriptor.sha256, baseRevision: write.descriptor.baseRevision } }]]));
      await checkedProjectWrite(storage, write.path, write.before, write.next); this.check();
      await publish(new Map([[write.path, write.descriptor]]));
    }
  }
}
