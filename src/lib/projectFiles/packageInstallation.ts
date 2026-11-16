import type { LatestProjectsPluginSettings, ProjectDefinition } from "src/settings/settings";
import type { CandidateCommitResult } from "src/lib/settings/settingsWriter";
import { binaryDigest } from "./package";
import { checkProject, jsonObject, projectFileError, textDigest } from "./document";
import { checkPackageGraph } from "./packageGraphCheck";
import { PACKAGE_LIMITS } from "./packagePolicy";
import { createPackagePathGuard } from "./packagePathPolicy";
import { packageNameKey } from "./packageManifest";
import { configuredCopyRoots, projectFilesRoot } from "./paths";
import { checkedProjectWrite, ensureProjectFolders } from "./storage";
import type { ProjectStageStorage } from "./packageStage";
import { samePendingImport, type PendingProjectImport } from "./pendingImportIsolation";
import { parseProjectConfiguration } from "./projectConfiguration";

export interface InstalledProjectConfiguration {
  readonly projectId: string;
  readonly path: string;
  readonly owner: string;
  readonly baseRevision: string;
  readonly sha256: string;
  /** Confirmed before an owned file write; reconciles interruption before acknowledgment. */
  readonly pendingWrite?: { readonly sha256: string; readonly baseRevision: string };
}
export interface InstalledProjectPackage {
  readonly id: string;
  readonly archiveHash: string;
  readonly journal: string;
  readonly configurations: InstalledProjectConfiguration[];
}
export interface InstallationFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}
export interface ProjectInstallationPlan {
  readonly format: "obs-projects-plus/installation";
  readonly schemaVersion: 1;
  readonly owner: string;
  readonly archivePath: string;
  readonly archiveHash: string;
  readonly root: string;
  readonly copyRoot: string;
  readonly projects: { readonly project: ProjectDefinition; readonly archived: boolean; readonly configuration: InstalledProjectConfiguration }[];
  readonly files: InstallationFile[];
}
export interface InstallationStorage extends ProjectStageStorage {
  /** Move to an unused recovery path, preserving bytes even if a user edits during the move. */
  recover(path: string, destination: string): Promise<void>;
}
export interface InstallationPrimary {
  /** Actual confirmed store reference, suitable as the writer's expected value. */
  read(): Promise<LatestProjectsPluginSettings>;
  commit(expected: LatestProjectsPluginSettings, candidate: LatestProjectsPluginSettings, guard?: () => boolean): Promise<CandidateCommitResult>;
  /** Cheap live quarantine check between files; the final commit still rechecks confirmed primary state. */
  pending?(expected: PendingProjectImport): boolean;
}
type Journal = { plan: ProjectInstallationPlan; completed: string[]; state: "preparing" | "files-verified" | "complete" | "rolled-back" };
function fail(reason: string): never { throw projectFileError("installation " + reason); }
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const capture = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function keys(value: unknown, expected: string[]): asserts value is Record<string, unknown> {
  if (!jsonObject(value) || Object.keys(value).length !== expected.length || expected.some(key => !Object.prototype.hasOwnProperty.call(value, key))) fail("invalid journal shape");
}
function print(journal: Journal): string {
  const text = JSON.stringify(journal);
  if (new TextEncoder().encode(text).length > PACKAGE_LIMITS.totalBytes) fail("journal too large");
  return text;
}

/** Revalidated on resume; a mutable journal is not trusted merely because its filename matches. */
export function validateInstallationPlan(input: unknown, configDir: string, roots: readonly string[]): asserts input is ProjectInstallationPlan {
  keys(input, ["format", "schemaVersion", "owner", "archivePath", "archiveHash", "root", "copyRoot", "projects", "files"]);
  if (input['format'] !== "obs-projects-plus/installation" || input['schemaVersion'] !== 1 ||
      typeof input['owner'] !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(input['owner']) || !hash(input['archiveHash']) ||
      typeof input['archivePath'] !== "string" || typeof input['root'] !== "string" || typeof input['copyRoot'] !== "string") fail("invalid plan");
  const root = projectFilesRoot(input['root'], configDir);
  projectFilesRoot(input['copyRoot'], configDir); projectFilesRoot(input['archivePath'], configDir);
  const guard = createPackagePathGuard(configDir, roots);
  guard(root);
  const files = input['files'], projects = input['projects'];
  if (!Array.isArray(files) || !files.length || files.length > PACKAGE_LIMITS.files || !Array.isArray(projects) || !projects.length || projects.length > PACKAGE_LIMITS.projects) fail("invalid plan count");
  let total = 0;
  const paths = new Map<string, InstallationFile>();
  for (const file of files) {
    keys(file, ["path", "bytes", "sha256"]);
    if (typeof file['path'] !== "string" || !file['path'].startsWith(root + "/") || typeof file['bytes'] !== "number" || !Number.isSafeInteger(file['bytes']) || file['bytes'] < 0 || file['bytes'] > PACKAGE_LIMITS.fileBytes || !hash(file['sha256'])) fail("invalid file");
    guard(file['path'], true); total += file['bytes'];
    const key = packageNameKey(file['path']);
    if (paths.has(key) || total > PACKAGE_LIMITS.totalBytes) fail("file collision or size limit");
    paths.set(key, file as unknown as InstallationFile);
  }
  const folders = new Map<string, string>();
  for (const file of paths.values()) for (const parent of ancestors(file.path)) {
    const key = packageNameKey(parent), prior = folders.get(key);
    if (paths.has(key) || prior !== undefined && prior !== parent) fail("parent collision");
    folders.set(key, parent);
  }
  const ids = new Set<string>(), configPaths = new Set<string>();
  const validatedProjects: ProjectDefinition[] = [];
  for (const item of projects) {
    keys(item, ["project", "archived", "configuration"]); checkProject(item['project']);
    const project = item['project'], config = item['configuration'];
    keys(config, ["projectId", "path", "owner", "baseRevision", "sha256"]);
    if (typeof item['archived'] !== "boolean" || ids.has(project.id) || config['projectId'] !== project.id || config['owner'] !== input['owner'] || typeof config['path'] !== "string" || !config['path'].endsWith(".json") || !hash(config['sha256']) || !hash(config['baseRevision'])) fail("invalid configuration");
    const key = packageNameKey(config['path']), file = paths.get(key);
    if (!file || file.path !== config['path'] || file.sha256 !== config['sha256'] || configPaths.has(key)) fail("configuration coverage");
    ids.add(project.id); configPaths.add(key);
    validatedProjects.push(project);
  }
  const graph = checkPackageGraph(validatedProjects);
  if (!graph.referencesChecked || graph.issues.length || graph.coreChecks.some(item => item.check.issues.length)) fail("invalid project graph");
}
function ancestors(path: string): string[] {
  const result: string[] = [];
  for (let at = path.indexOf("/"); at >= 0; at = path.indexOf("/", at + 1)) result.push(path.slice(0, at));
  return result;
}
function pendingFor(plan: ProjectInstallationPlan, id: string): PendingProjectImport {
  return { format: "obs-projects-plus/pending-import", schemaVersion: 1, id, archiveHash: plan.archiveHash,
    journal: `${plan.copyRoot}/Incoming/${plan.archiveHash}/Installations/${id}.json`, paths: plan.files.map(file => file.path) };
}
function samePending(current: PendingProjectImport | undefined, expected: PendingProjectImport): boolean {
  return samePendingImport(current, expected);
}
function compiledPath(pending: PendingProjectImport, index: number): string {
  return pending.journal.slice(0, -5) + `/Payload/${index}.bin`;
}

/** Confirmed primary boundary plus immutable plan and per-file acknowledgments. No project is activated early. */
export async function installProjectPackage(storage: InstallationStorage, primary: InstallationPrimary, input: ProjectInstallationPlan,
  payload: ReadonlyMap<string, Uint8Array>, configDir: string, check: () => void = () => {}): Promise<InstalledProjectPackage> {
  const serialized = JSON.stringify(input);
  if (new TextEncoder().encode(serialized).length > PACKAGE_LIMITS.totalBytes) fail("plan too large");
  const plan = JSON.parse(serialized) as ProjectInstallationPlan;
  const initial = await primary.read(); check();
  validateInstallationPlan(plan, configDir, configuredCopyRoots(initial.preferences.projectFiles));
  if (payload.size !== plan.files.length) fail("payload coverage");
  const content = new Map<string, Uint8Array>();
  for (const file of plan.files) {
    const bytes = payload.get(file.path);
    if (!bytes || bytes.length !== file.bytes) fail("payload coverage");
    content.set(file.path, new Uint8Array(bytes));
  }
  if (initial.preferences.projectFiles?.root !== plan.copyRoot) fail("copy root changed");
  const id = await textDigest(JSON.stringify(plan)), pending = pendingFor(plan, id);
  const receipt: InstalledProjectPackage = { id, archiveHash: plan.archiveHash, journal: pending.journal, configurations: plan.projects.map(item => capture(item.configuration)) };
  if (content.size !== plan.files.length) fail("payload coverage");
  for (const file of plan.files) {
    const bytes = content.get(file.path);
    if (!bytes || bytes.length !== file.bytes || await binaryDigest(bytes) !== file.sha256) fail("payload changed");
    check();
  }
  for (const item of plan.projects) {
    const bytes = content.get(item.configuration.path); if (!bytes) fail("configuration payload missing");
    const document = parseProjectConfiguration(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (document.owner !== plan.owner || document.baseRevision !== item.configuration.baseRevision ||
        document.baseRevision !== await textDigest(JSON.stringify(item.project)) || JSON.stringify(document.project) !== JSON.stringify(item.project)) fail("configuration payload mismatch");
    check();
  }
  let raw = await storage.read(pending.journal), journal: Journal = { plan, completed: [], state: "preparing" };
  if (raw !== null) journal = await readJournal(raw, pending, configDir, configuredCopyRoots(initial.preferences.projectFiles));
  if (JSON.stringify(journal.plan) !== JSON.stringify(plan) || journal.state === "rolled-back") fail("journal conflict");
  print({ ...journal, completed: plan.files.map(file => file.path), state: "complete" });
  if (raw === null) {
    if (initial.preferences.projectFiles?.pendingImport) fail("another operation pending");
    for (const file of plan.files) if (await storage.kind(file.path) !== null) fail("destination occupied");
    check(); await ensureProjectFolders(storage, pending.journal.slice(0, pending.journal.lastIndexOf("/")));
    raw = print(journal); await checkedProjectWrite(storage, pending.journal, null, raw);
  }
  // Opaque immutable compiled bytes make a retry independent of the original ZIP
  // and preserve link rewrites and allocated identities across application restarts.
  await ensureProjectFolders(storage, pending.journal.slice(0, -5) + "/Payload");
  for (const [index, file] of plan.files.entries()) {
    check(); const path = compiledPath(pending, index), bytes = await storage.readBinary(path);
    if (bytes === null) await storage.createBinary(path, content.get(file.path)!);
    else if (bytes.length !== file.bytes || await binaryDigest(bytes) !== file.sha256) fail("compiled payload changed");
    await verifyFile(storage, { ...file, path }, check);
  }
  let current = await primary.read(); check();
  const installed = current.preferences.projectFiles?.installations?.find(item => item.id === id);
  if (installed) {
    if (JSON.stringify(installed) !== JSON.stringify(receipt)) fail("installed metadata changed");
    for (const file of plan.files) await verifyFile(storage, file, check);
    journal.state = "complete";
    check(); await checkedProjectWrite(storage, pending.journal, raw, print(journal));
    return receipt;
  }
  const pref = current.preferences.projectFiles;
  if (!pref || pref.root !== plan.copyRoot || pref.pendingImport && !samePending(pref.pendingImport, pending)) fail("pending operation changed");
  if (!pref.pendingImport) {
    if (journal.completed.length || journal.state !== "preparing") fail("pending ownership missing");
    const candidate = { ...capture(current), preferences: { ...capture(current.preferences), projectFiles: { ...pref, pendingImport: pending } } };
    if (await primary.commit(current, candidate) !== "confirmed") fail("pending publication unconfirmed");
  }
  const guard = async () => {
    check();
    if (primary.pending) { if (!primary.pending(pending)) fail("pending ownership changed"); return; }
    const value = await primary.read(); check();
    if (value.preferences.projectFiles?.root !== plan.copyRoot || !samePending(value.preferences.projectFiles.pendingImport, pending)) fail("pending ownership changed");
  };
  for (const file of plan.files) {
    await guard();
    if (journal.completed.includes(file.path)) { await verifyFile(storage, file, check); continue; }
    if (await storage.kind(file.path) !== null) fail("unacknowledged file requires manual recovery");
    await ensureProjectFolders(storage, file.path.slice(0, file.path.lastIndexOf("/"))); await guard();
    await storage.createBinary(file.path, content.get(file.path)!); await verifyFile(storage, file, check);
    journal.completed.push(file.path);
    const next = print(journal); check(); await checkedProjectWrite(storage, pending.journal, raw, next); raw = next;
  }
  for (const file of plan.files) await verifyFile(storage, file, check);
  journal.state = "files-verified";
  let next = print(journal); check(); await checkedProjectWrite(storage, pending.journal, raw, next); raw = next;
  await guard(); current = await primary.read(); await guard();
  const destinationIds = new Set([...current.projects, ...current.archives].map(project => project.id));
  if (plan.projects.some(item => destinationIds.has(item.project.id))) fail("project identity occupied");
  const preferences = { ...current.preferences.projectFiles! };
  delete preferences.pendingImport;
  preferences.installations = [...(preferences.installations ?? []), capture(receipt)];
  const candidate = { ...capture(current), projects: [...current.projects, ...plan.projects.filter(item => !item.archived).map(item => capture(item.project))],
    archives: [...current.archives, ...plan.projects.filter(item => item.archived).map(item => capture(item.project))], preferences: { ...capture(current.preferences), projectFiles: preferences } };
  // A failed result may still have touched disk. Keep the journal and quarantine for reconciliation.
  if (await primary.commit(current, candidate) !== "confirmed") fail("project publication unconfirmed");
  journal.state = "complete"; next = print(journal); check(); await checkedProjectWrite(storage, pending.journal, raw, next);
  return receipt;
}
async function verifyFile(storage: InstallationStorage, file: InstallationFile, check: () => void): Promise<void> {
  check(); const bytes = await storage.readBinary(file.path); check();
  if (!bytes || bytes.length !== file.bytes || await binaryDigest(bytes) !== file.sha256) fail("file verification failed");
  check();
}
async function readJournal(raw: string, pending: PendingProjectImport, configDir: string, roots: readonly string[]): Promise<Journal> {
  if (new TextEncoder().encode(raw).length > PACKAGE_LIMITS.totalBytes) fail("journal too large");
  const value: unknown = JSON.parse(raw); keys(value, ["plan", "completed", "state"]);
  validateInstallationPlan(value['plan'], configDir, roots);
  const plan = value['plan'];
  if (await textDigest(JSON.stringify(plan)) !== pending.id || !samePending(pendingFor(plan, pending.id), pending) ||
      !Array.isArray(value['completed']) || value['completed'].some((path, i) => path !== plan.files[i]?.path) ||
      !["preparing", "files-verified", "complete", "rolled-back"].includes(String(value['state'])) ||
      value['state'] !== "preparing" && value['state'] !== "rolled-back" && value['completed'].length !== plan.files.length) fail("journal changed");
  return value as unknown as Journal;
}
async function pendingJournal(storage: InstallationStorage, primary: InstallationPrimary, configDir: string, check: () => void) {
  const current = await primary.read(); check();
  const preferences = current.preferences.projectFiles, pending = preferences?.pendingImport;
  if (!preferences || !pending || !hash(pending.id) || !hash(pending.archiveHash) ||
      pending.journal !== `${projectFilesRoot(preferences.root, configDir)}/Incoming/${pending.archiveHash}/Installations/${pending.id}.json`) fail("invalid pending journal");
  const raw = await storage.read(pending.journal); check(); if (raw === null) fail("journal missing");
  const journal = await readJournal(raw, pending, configDir, configuredCopyRoots(preferences));
  return { current, pending, raw, journal };
}

/** Resume only the pinned plan and its verified compiled payload; never allocates new project IDs. */
export async function resumeProjectInstallation(storage: InstallationStorage, primary: InstallationPrimary, configDir: string,
  check: () => void = () => {}): Promise<InstalledProjectPackage> {
  const { pending, journal } = await pendingJournal(storage, primary, configDir, check);
  const content = new Map<string, Uint8Array>();
  for (const [index, file] of journal.plan.files.entries()) {
    check(); const bytes = await storage.readBinary(compiledPath(pending, index)); check();
    if (!bytes || bytes.length !== file.bytes || await binaryDigest(bytes) !== file.sha256) fail("compiled payload missing or changed");
    content.set(file.path, bytes);
  }
  return installProjectPackage(storage, primary, journal.plan, content, configDir, check);
}

/** Explicit rollback retains edited/unacknowledged files; unchanged acknowledged bytes move to recovery. */
export async function rollbackProjectInstallation(storage: InstallationStorage, primary: InstallationPrimary, configDir: string,
  check: () => void = () => {}): Promise<{ recovered: string[]; retained: string[] }> {
  const loaded = await pendingJournal(storage, primary, configDir, check);
  let { current } = loaded;
  const { pending, raw, journal } = loaded;
  if (current.preferences.projectFiles?.installations?.some(item => item.id === pending.id)) fail("already published");
  const recovered: string[] = [], retained: string[] = [];
  for (const file of journal.plan.files) {
    check(); let bytes: Uint8Array | null;
    try { bytes = await storage.readBinary(file.path); }
    catch { check(); retained.push(file.path); continue; }
    check();
    if (bytes === null) continue;
    if (!journal.completed.includes(file.path) || bytes.length !== file.bytes || await binaryDigest(bytes) !== file.sha256) { retained.push(file.path); continue; }
    const destination = `${journal.plan.copyRoot}/Incoming/${pending.archiveHash}/Recovery/${pending.id}/${await textDigest(file.path)}.bin`;
    await ensureProjectFolders(storage, destination.slice(0, destination.lastIndexOf("/")));
    current = await primary.read(); check();
    if (!samePending(current.preferences.projectFiles?.pendingImport, pending)) fail("pending ownership changed");
    await storage.recover(file.path, destination); recovered.push(destination);
  }
  current = await primary.read(); check();
  if (!samePending(current.preferences.projectFiles?.pendingImport, pending)) fail("pending ownership changed");
  const pref = { ...current.preferences.projectFiles! }; delete pref.pendingImport;
  const candidate = { ...capture(current), preferences: { ...capture(current.preferences), projectFiles: pref } };
  if (await primary.commit(current, candidate) !== "confirmed") fail("rollback publication unconfirmed");
  journal.state = "rolled-back";
  check(); await checkedProjectWrite(storage, pending.journal, raw, print(journal));
  return { recovered, retained };
}
