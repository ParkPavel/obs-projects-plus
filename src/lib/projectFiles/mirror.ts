import type { LatestProjectsPluginSettings } from "src/settings/settings";
import { createProjectDocument, jsonObject, printProjectDocument, projectFileError, textDigest } from "./document";
import { projectFilesRoot } from "./paths";
import { checkedProjectWrite, ensureProjectFolders, writeProjectSnapshot, type ProjectFilesStorage } from "./storage";

interface MirrorEntry {
  id: string;
  revision: string;
  documentHash: string;
  state: "active" | "archived" | "removed";
}
interface MirrorIndex { format: "obs-projects-plus/mirror"; schemaVersion: 1; entries: MirrorEntry[]; }

function readIndex(text: string | null): MirrorIndex {
  if (text === null) return { format: "obs-projects-plus/mirror", schemaVersion: 1, entries: [] };
  if (text.length > 4 * 1024 * 1024) throw projectFileError("mirror index too large");
  const value: unknown = JSON.parse(text);
  if (!jsonObject(value) || value['format'] !== "obs-projects-plus/mirror" || value['schemaVersion'] !== 1 || !Array.isArray(value['entries'])) {
    throw projectFileError("unsupported mirror index");
  }
  const ids = new Set<string>();
  for (const entry of value['entries']) {
    if (!jsonObject(entry) || typeof entry['id'] !== "string" || !entry['id'] || ids.has(entry['id']) ||
        !["active", "archived", "removed"].includes(String(entry['state'])) || typeof entry['revision'] !== "string" || !/^[a-f0-9]{64}$/.test(entry['revision']) ||
        typeof entry['documentHash'] !== "string" || !/^[a-f0-9]{64}$/.test(entry['documentHash'])) throw projectFileError("invalid mirror index entry");
    ids.add(entry['id']);
  }
  return value as unknown as MirrorIndex;
}

export interface MirrorReceipt {
  root: string;
  projects: number;
  copies: readonly string[];
  snapshots: readonly string[];
  documents: readonly { name: string; path: string; archived: boolean }[];
}

/** Callers serialize runs and supply ONLY a freshly confirmed persisted settings value. */
export async function syncProjectCopies(storage: ProjectFilesStorage, input: string, settings: LatestProjectsPluginSettings, configDir: string): Promise<MirrorReceipt> {
  const root = projectFilesRoot(input, configDir);
  const indexPath = root + "/sync-index.json";
  const beforeIndex = await storage.read(indexPath);
  const index = readIndex(beforeIndex);
  const previous = new Map(index.entries.map(entry => [entry.id, entry]));
  const updated = new Map<string, MirrorEntry>([...previous].map(([id, entry]) => [id, { ...entry, state: "removed" }]));
  const seen = new Set<string>();
  const copies: string[] = [], snapshots: string[] = [];
  const documents: { name: string; path: string; archived: boolean }[] = [];
  // Prepare and validate the complete plan before creating any directories.
  const plan = [];
  let plannedBytes = 0;
  for (const [archived, projects] of [[false, settings.projects], [true, settings.archives]] as const) {
    for (const project of projects) {
      if (seen.has(project.id)) throw projectFileError("duplicate project identity");
      seen.add(project.id);
      const doc = await createProjectDocument(project), text = printProjectDocument(doc);
      plannedBytes += new TextEncoder().encode(text).length;
      if (plan.length >= 1000 || plannedBytes > 16 * 1024 * 1024) throw projectFileError("copy batch too large");
      const key = await textDigest(project.id);
      plan.push({ project, archived, doc, text, key, hash: await textDigest(text) });
    }
  }
  await ensureProjectFolders(storage, root);
  for (const item of plan) {
    const folder = root + "/Projects/" + item.key;
    const path = folder + "/Project.md", before = await storage.read(path), old = previous.get(item.project.id);
    // A prior index mismatch can be repaired only if the exact requested copy
    // already landed. Otherwise preserve external edits and refuse to overwrite.
    if (before !== item.text) {
      if (old ? before === null || await textDigest(before) !== old.documentHash : before !== null) {
        throw projectFileError("mirror changed externally or is missing");
      }
    }
    const backupFolder = root + "/Backups/" + item.key;
    const snapshot = backupFolder + "/" + item.hash + ".md";
    await ensureProjectFolders(storage, backupFolder);
    await writeProjectSnapshot(storage, snapshot, item.text);
    await ensureProjectFolders(storage, folder);
    await checkedProjectWrite(storage, path, before, item.text);
    copies.push(path); snapshots.push(snapshot);
    documents.push({ name: item.project.name, path, archived: item.archived });
    updated.set(item.project.id, { id: item.project.id, revision: item.doc.baseRevision, documentHash: item.hash, state: item.archived ? "archived" : "active" });
  }
  // Keep entries for removed projects: their copies are recoverable, never deleted.
  const next: MirrorIndex = { format: "obs-projects-plus/mirror", schemaVersion: 1, entries: [...updated.values()] };
  await checkedProjectWrite(storage, indexPath, beforeIndex, JSON.stringify(next, null, 2) + "\n");
  return { root, projects: plan.length, copies, snapshots, documents };
}
