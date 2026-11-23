import type { App } from "obsidian";
import { v4 as uuidv4 } from "uuid";
import type { InspectedProjectPackage } from "./packageInspect";
import type { InstallationPrimary, InstallationStorage } from "./packageInstallation";
import { samePendingImport, type PendingProjectImport } from "./pendingImportIsolation";
import { projectFileError, textDigest, jsonObject } from "./document";
import { projectFilesRoot } from "./paths";
import { ensureProjectFolders, checkedProjectWrite } from "./storage";
import { inspectNativeNote, type NativeNoteInspection } from "./nativeNoteInspection";
import { getAPI, isPluginEnabled } from "src/lib/datasources/dataview/host";
import { PACKAGE_LIMITS } from "./packagePolicy";

interface InspectionPlan { format: "obs-projects-plus/note-inspection"; schemaVersion: 1; root: string; archivePath: string; archiveHash: string; nonce: string; files: { source: string; name: string }[] }
const capture = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const fail = () => { throw projectFileError("note inspection journal or quarantine changed"); };
function pendingFor(plan: InspectionPlan, id: string): PendingProjectImport {
  return { format: "obs-projects-plus/pending-import", schemaVersion: 1, phase: "note-inspection", id, archiveHash: plan.archiveHash,
    journal: `${plan.root}/Incoming/${plan.archiveHash}/Installations/${id}.json`,
    paths: plan.files.map(file => `${plan.root}/Incoming/${plan.archiveHash}/Note inspection/${id}/${file.name}.md`) };
}

/** Use only Dataview's public path index, never a received query or expression. */
async function waitForIndex(app: App, paths: readonly string[], check: () => void): Promise<void> {
  const canonical = (path: string) => path.normalize("NFC").toLowerCase();
  const pending = new Set(paths.map(canonical)), deadline = Date.now() + 15000;
  while (isPluginEnabled(app)) {
    check(); const api = getAPI(app);
    if (typeof api?.pagePaths !== "function") throw projectFileError("Dataview cannot confirm temporary-note cleanup");
    const indexed: unknown = api.pagePaths().array();
    if (!Array.isArray(indexed) || indexed.length > 100000 || indexed.some(value => typeof value !== "string")) throw projectFileError("unsupported Dataview path index");
    if (!indexed.some(path => pending.has(canonical(path as string)))) return;
    if (Date.now() >= deadline) throw projectFileError("Dataview temporary-note cleanup timed out");
    await new Promise<void>(resolve => window.setTimeout(resolve, 50));
  }
  check();
}

async function finish(app: App, storage: InstallationStorage, primary: InstallationPrimary, pending: PendingProjectImport, raw: string, check: () => void) {
  const guard = () => { check(); if (primary.pending && !primary.pending(pending)) return fail(); };
  // The entire nonce-scoped Incoming inspection namespace belongs to this
  // temporary operation. Preserve all bytes, including a write interrupted before acknowledgment.
  for (const path of pending.paths) {
    check(); const current = await primary.read(); check();
    if (!samePendingImport(current.preferences.projectFiles?.pendingImport, pending)) return fail();
    if (await storage.kind(path) === null) continue;
    let target = path.slice(0, -3) + ".bin";
    if (await storage.kind(target) !== null) target = `${path.slice(0, path.lastIndexOf("/"))}/Recovery/${uuidv4()}.bin`;
    await ensureProjectFolders(storage, target.slice(0, target.lastIndexOf("/"))); check();
    await storage.recover(path, target); check();
  }
  await waitForIndex(app, pending.paths, guard);
  const current = await primary.read(); check();
  if (!samePendingImport(current.preferences.projectFiles?.pendingImport, pending)) return fail();
  const preferences = { ...current.preferences.projectFiles! }; delete preferences.pendingImport;
  const candidate = { ...capture(current), preferences: { ...capture(current.preferences), projectFiles: preferences } };
  if (await primary.commit(current, candidate) !== "confirmed") throw projectFileError("note inspection cleanup unconfirmed");
  const value = JSON.parse(raw) as { plan: InspectionPlan; state: string }; value.state = "cleaned";
  check(); await checkedProjectWrite(storage, pending.journal, raw, JSON.stringify(value));
}

/** Native parsing is isolated before the first Markdown file, then all temporary notes become opaque bytes. */
export async function prepareNativeNoteInspection(app: App, storage: InstallationStorage, primary: InstallationPrimary, archivePath: string,
  inspected: InspectedProjectPackage, check: () => void): Promise<Map<string, NativeNoteInspection>> {
  const current = await primary.read(); check();
  const root = current.preferences.projectFiles?.root;
  if (!root || current.preferences.projectFiles?.pendingImport) throw projectFileError("finish the pending operation first");
  const files = [];
  for (const file of inspected.manifest.files) if (file.role === "note" && file.sourcePath) files.push({ source: file.sourcePath, name: await textDigest(file.sourcePath) });
  const notes = new Map<string, NativeNoteInspection>(); if (!files.length) return notes;
  const plan: InspectionPlan = { format: "obs-projects-plus/note-inspection", schemaVersion: 1, root, archivePath, archiveHash: inspected.archiveHash, nonce: uuidv4(), files };
  const id = await textDigest(JSON.stringify(plan)), pending = pendingFor(plan, id);
  if (pending.paths.reduce((sum, path) => sum + path.length, 0) > 65536) throw projectFileError("note inspection paths too large");
  const raw = JSON.stringify({ plan, state: "preparing" });
  await ensureProjectFolders(storage, pending.journal.slice(0, pending.journal.lastIndexOf("/"))); check();
  await checkedProjectWrite(storage, pending.journal, null, raw);
  const before = await primary.read(); check();
  if (before.preferences.projectFiles?.root !== root || before.preferences.projectFiles.pendingImport) return fail();
  const candidate = { ...capture(before), preferences: { ...capture(before.preferences), projectFiles: { ...before.preferences.projectFiles, pendingImport: pending } } };
  if (await primary.commit(before, candidate) !== "confirmed") throw projectFileError("note inspection quarantine unconfirmed");
  const guard = () => { check(); if (primary.pending && !primary.pending(pending)) return fail(); };
  for (const [index, file] of files.entries()) {
    guard();
    const entry = inspected.manifest.files.find(item => item.role === "note" && item.sourcePath === file.source)!, bytes = inspected.entries.get(entry.path);
    if (!bytes) return fail();
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    notes.set(file.source, await inspectNativeNote(app.vault, app.metadataCache, `${root}/Incoming/${plan.archiveHash}`, file.source, text, guard, pending.paths[index]));
  }
  await finish(app, storage, primary, pending, raw, check); check();
  return notes;
}

/** After restart, preserve the operation's temporary bytes and let the caller repeat preparation. */
export async function recoverNativeNoteInspection(app: App, storage: InstallationStorage, primary: InstallationPrimary, check: () => void) {
  const current = await primary.read(); check();
  const preferences = current.preferences.projectFiles, pending = preferences?.pendingImport;
  if (!preferences || !pending || pending.phase !== "note-inspection" || !/^[a-f0-9]{64}$/.test(pending.id) || !/^[a-f0-9]{64}$/.test(pending.archiveHash) ||
      pending.journal !== `${projectFilesRoot(preferences.root, app.vault.configDir)}/Incoming/${pending.archiveHash}/Installations/${pending.id}.json`) return fail();
  const raw = await storage.read(pending.journal); if (raw === null || raw.length > PACKAGE_LIMITS.manifestBytes) return fail();
  const value: unknown = JSON.parse(raw);
  if (!jsonObject(value) || value['state'] !== "preparing" || !jsonObject(value['plan'])) return fail();
  const plan = value['plan'];
  if (plan['format'] !== "obs-projects-plus/note-inspection" || plan['schemaVersion'] !== 1 || plan['root'] !== preferences.root || plan['archiveHash'] !== pending.archiveHash ||
      typeof plan['archivePath'] !== "string" || !Array.isArray(plan['files']) || !plan['files'].length || plan['files'].length > PACKAGE_LIMITS.files || await textDigest(JSON.stringify(plan)) !== pending.id) return fail();
  projectFilesRoot(plan['archivePath'], app.vault.configDir);
  for (const file of plan['files']) {
    if (!jsonObject(file) || typeof file['source'] !== "string" || typeof file['name'] !== "string" || await textDigest(file['source']) !== file['name']) return fail();
  }
  if (!samePendingImport(pendingFor(plan as unknown as InspectionPlan, pending.id), pending)) return fail();
  await finish(app, storage, primary, pending, raw, check);
  return { preparationReset: true as const };
}
