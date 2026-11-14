import { binaryDigest } from "./package";
import { jsonObject, projectFileError, textDigest } from "./document";
import { checkedPackageEntryPath, validatePackageManifest } from "./packageManifest";
import { PACKAGE_LIMITS } from "./packagePolicy";
import { projectFilesRoot } from "./paths";
import { checkedProjectWrite, ensureProjectFolders, type ProjectFilesStorage } from "./storage";
import type { InspectedProjectPackage } from "./packageInspect";

export const MAX_STAGE_JOURNAL_BYTES = 1024 * 1024;
export interface ProjectStageStorage extends ProjectFilesStorage {
  kind(path: string): Promise<"file" | "folder" | null>;
  readBinary(path: string): Promise<Uint8Array | null>;
  createBinary(path: string, bytes: Uint8Array): Promise<void>;
}
interface StagedFile { entry: string; stored: string; bytes: number; sha256: string }
interface StagePlan { format: "obs-projects-plus/staging"; schemaVersion: 1; archiveHash: string; files: StagedFile[] }
type StageState = "preparing" | "ready";
export interface StageReceipt { folder: string; journal: string; archiveHash: string; files: number; created: number; resumed: boolean }
function conflict(): never { throw projectFileError("staging conflict"); }
function journalText(plan: StagePlan, state: StageState, completed: number): string {
  const text = JSON.stringify({ ...plan, state, completed: plan.files.slice(0, completed).map(file => file.entry) }, null, 2) + "\n";
  if (new TextEncoder().encode(text).length > MAX_STAGE_JOURNAL_BYTES) throw projectFileError("staging journal too large");
  return text;
}
function readJournal(raw: string, plan: StagePlan): { state: StageState; completed: number } {
  if (new TextEncoder().encode(raw).length > MAX_STAGE_JOURNAL_BYTES) conflict();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { conflict(); }
  if (!jsonObject(value) || (value['state'] !== "preparing" && value['state'] !== "ready") || !Array.isArray(value['completed']) ||
      value['completed'].length > plan.files.length || (value['state'] === "ready" && value['completed'].length !== plan.files.length)) conflict();
  const state = value['state'], completed = value['completed'].length;
  // Operational journals are canonical and owned by this plan. Never repair an
  // externally edited, foreign or future-version journal in place.
  if (raw !== journalText(plan, state, completed)) conflict();
  return { state, completed };
}

/** Explicit staging only: immutable opaque .bin files, no active project registration. */
export async function stageProjectPackage(storage: ProjectStageStorage, input: string, inspected: InspectedProjectPackage,
  configDir: string, check: () => void = () => {}): Promise<StageReceipt> {
  check();
  const root = projectFilesRoot(input, configDir), archiveHash = inspected.archiveHash;
  if (!/^[a-f0-9]{64}$/.test(archiveHash)) conflict();
  const manifest = JSON.parse(JSON.stringify(inspected.manifest)) as unknown;
  validatePackageManifest(manifest, configDir);
  const originals = Array.from(inspected.entries).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  if (originals.length !== manifest.files.length + 1 || originals.length > PACKAGE_LIMITS.files) conflict();
  const described = new Map(manifest.files.map(file => [file.path, file]));
  const files: StagedFile[] = [], content = new Map<string, Uint8Array>(), storedNames = new Set<string>();
  let total = 0;
  // Recheck and capture bytes before creating directories or claiming a journal.
  // A mutable public preview object never authorizes writing different bytes.
  for (const [entry, source] of originals) {
    check(); checkedPackageEntryPath(entry, configDir);
    const bytes = new Uint8Array(source), sha256 = await binaryDigest(bytes);
    total += bytes.length;
    if (bytes.length > PACKAGE_LIMITS.fileBytes || total > PACKAGE_LIMITS.totalBytes) conflict();
    if (entry === "manifest.json") {
      let parsed: unknown;
      try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { conflict(); }
      if (bytes.length > PACKAGE_LIMITS.manifestBytes || JSON.stringify(parsed) !== JSON.stringify(manifest)) conflict();
    } else {
      const expected = described.get(entry);
      if (!expected || expected.bytes !== bytes.length || expected.sha256 !== sha256) conflict();
    }
    const stored = `Files/${await textDigest(entry)}.bin`;
    if (storedNames.has(stored)) conflict(); storedNames.add(stored);
    files.push({ entry, stored, bytes: bytes.length, sha256 }); content.set(entry, bytes);
  }
  if (!content.has("manifest.json")) conflict();
  const plan: StagePlan = { format: "obs-projects-plus/staging", schemaVersion: 1, archiveHash, files };
  journalText(plan, "ready", files.length); // Prove the largest journal fits before any writes.
  const incoming = root + "/Incoming", folder = incoming + "/" + archiveHash, journal = incoming + "/" + archiveHash + ".json";
  let raw = await storage.read(journal);
  const resumed = raw !== null;
  if (raw === null && await storage.kind(folder) !== null) conflict();
  let { state, completed } = raw === null ? { state: "preparing" as StageState, completed: 0 } : readJournal(raw, plan);
  check(); await ensureProjectFolders(storage, incoming);
  if (raw === null) {
    const next = journalText(plan, state, completed);
    await checkedProjectWrite(storage, journal, null, next); raw = next;
  }
  // The parent journal exists before the payload directory: interruption after
  // claiming the plan can resume without adopting an unclaimed existing folder.
  await ensureProjectFolders(storage, folder + "/Files");
  let created = 0;
  const verify = async (file: StagedFile) => {
    check();
    const actual = await storage.readBinary(folder + "/" + file.stored);
    if (actual === null || actual.length !== file.bytes || await binaryDigest(actual) !== file.sha256) conflict();
    check();
  };
  for (let i = 0; i < files.length; i++) {
    check();
    const file = files[i]!, path = folder + "/" + file.stored;
    const existing = await storage.readBinary(path);
    if (existing === null) {
      // Explicit retry may recreate a missing payload even when the last journal
      // reached ready (e.g. filesystem synchronization delivered metadata first).
      check(); await storage.createBinary(path, content.get(file.entry)!); created++;
    } else if (existing.length !== file.bytes || await binaryDigest(existing) !== file.sha256) conflict();
    await verify(file);
    completed = Math.max(completed, i + 1);
    const next = journalText(plan, state, completed);
    check(); await checkedProjectWrite(storage, journal, raw, next); raw = next;
  }
  for (const file of files) await verify(file);
  state = "ready";
  const ready = journalText(plan, state, files.length);
  check(); await checkedProjectWrite(storage, journal, raw, ready);
  for (const file of files) await verify(file);
  if (await storage.read(journal) !== ready) conflict();
  check();
  return { folder, journal, archiveHash, files: files.length, created, resumed };
}
