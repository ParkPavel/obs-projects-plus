import { TFile, TFolder, type Vault } from "obsidian";
import { projectFileError } from "./document";
import type { ProjectFilesStorage } from "./storage";

/** Uses visible Vault APIs; never writes through Node or a hidden-file adapter. */
export function projectVaultStorage(vault: Vault, alive: () => boolean): ProjectFilesStorage {
  const check = () => { if (!alive()) throw projectFileError("operation retired"); };
  const file = (path: string) => {
    const entry = vault.getAbstractFileByPath(path);
    if (entry && !(entry instanceof TFile)) throw projectFileError("file path occupied by a folder");
    return entry;
  };
  return {
    async read(path) {
      check();
      const entry = file(path);
      return entry ? vault.read(entry) : null;
    },
    async mkdir(path) {
      check();
      const entry = vault.getAbstractFileByPath(path);
      if (entry instanceof TFolder) return;
      if (entry) throw projectFileError("folder path occupied by a file");
      try { await vault.createFolder(path); }
      catch (error) { if (!(vault.getAbstractFileByPath(path) instanceof TFolder)) throw error; }
    },
    async create(path, text) {
      check();
      // Vault.create refuses an existing file, including a concurrently created one.
      await vault.create(path, text);
    },
    async replace(path, expected, text) {
      check();
      const entry = file(path);
      if (!entry) throw projectFileError("copy disappeared before write");
      await vault.process(entry, current => {
        check();
        if (current !== expected) throw projectFileError("copy changed during write");
        return text;
      });
    },
  };
}
