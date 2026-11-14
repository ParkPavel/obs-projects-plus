import { projectFileError } from "./document";

/** Visible Vault operations, with create-exclusive and compare-inside-process semantics. */
export interface ProjectFilesStorage {
  read(path: string): Promise<string | null>;
  create(path: string, text: string): Promise<void>;
  replace(path: string, expected: string, text: string): Promise<void>;
  mkdir(path: string): Promise<void>;
}

export async function ensureProjectFolders(storage: ProjectFilesStorage, path: string): Promise<void> {
  let current = "";
  for (const segment of path.split("/")) {
    current = current ? current + "/" + segment : segment;
    await storage.mkdir(current);
  }
}

export async function checkedProjectWrite(storage: ProjectFilesStorage, path: string, expected: string | null, text: string): Promise<void> {
  if (expected === null) await storage.create(path, text);
  else if (expected !== text) await storage.replace(path, expected, text);
  if (await storage.read(path) !== text) throw projectFileError("copy read-back failed");
}

/** Existing snapshots are immutable; a changed or unrelated file is never repaired in place. */
export async function writeProjectSnapshot(storage: ProjectFilesStorage, path: string, text: string): Promise<void> {
  const existing = await storage.read(path);
  if (existing !== null && existing !== text) throw projectFileError("snapshot conflict");
  if (existing === null) await storage.create(path, text);
  if (await storage.read(path) !== text) throw projectFileError("snapshot verification failed");
}
