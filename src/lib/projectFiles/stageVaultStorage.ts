import { TFile, TFolder, type Vault } from "obsidian";
import { projectFileError } from "./document";
import { MAX_STAGE_JOURNAL_BYTES, type ProjectStageStorage } from "./packageStage";
import { PACKAGE_LIMITS } from "./packagePolicy";
import { projectVaultStorage } from "./vaultStorage";

/** Restricted Vault port: no deletion, binary replacement or hidden adapter writes. */
export function stageVaultStorage(vault: Vault, check: () => void): ProjectStageStorage {
  const text = projectVaultStorage(vault, () => { check(); return true; });
  const fileAt = (path: string) => {
    const entry = vault.getAbstractFileByPath(path);
    if (entry && !(entry instanceof TFile)) throw projectFileError("staging file path occupied");
    return entry;
  };
  return {
    ...text,
    async kind(path) {
      check(); const entry = vault.getAbstractFileByPath(path);
      return entry instanceof TFolder ? "folder" : entry ? "file" : null;
    },
    async read(path) {
      check(); const file = fileAt(path);
      if (!file) return null;
      if (file.stat.size > MAX_STAGE_JOURNAL_BYTES) throw projectFileError("staging journal too large");
      const raw = await vault.read(file); check();
      if (new TextEncoder().encode(raw).length > MAX_STAGE_JOURNAL_BYTES) throw projectFileError("staging journal too large");
      return raw;
    },
    async readBinary(path) {
      check(); const file = fileAt(path);
      if (!file) return null;
      if (file.stat.size > PACKAGE_LIMITS.fileBytes) throw projectFileError("staging payload too large");
      const before = { ...file.stat }, bytes = new Uint8Array(await vault.readBinary(file)); check();
      if (vault.getAbstractFileByPath(path) !== file || file.stat.size !== before.size || file.stat.mtime !== before.mtime || bytes.length !== before.size) throw projectFileError("staging payload changed during read");
      return bytes;
    },
    async createBinary(path, bytes) {
      check();
      if (bytes.length > PACKAGE_LIMITS.fileBytes) throw projectFileError("staging payload too large");
      await vault.createBinary(path, new Uint8Array(bytes).buffer); check();
    },
  };
}
