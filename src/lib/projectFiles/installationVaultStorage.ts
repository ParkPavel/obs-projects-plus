import { TFile, TFolder, type Vault } from "obsidian";
import { projectFileError } from "./document";
import { stageVaultStorage } from "./stageVaultStorage";
import { PACKAGE_LIMITS } from "./packagePolicy";
import type { InstallationStorage } from "./packageInstallation";
import { packageNameKey } from "./packageManifest";
import { snapshotVaultPathIndex } from "./packagePathPolicy";

/** Recheck live siblings adjacent to each write, without rescanning an entire vault per file. */
function placement(vault: Vault, path: string, kind: "file" | "folder", existing: boolean, required = false): void {
  if (typeof vault.getRoot !== "function") {
    const index = snapshotVaultPathIndex(vault.getAllLoadedFiles().map(file => ({ path: file.path, kind: file instanceof TFile ? "file" : "folder" })));
    const parts = path.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const current = parts.slice(0, i).join("/"), matches = index.get(packageNameKey(current));
      for (const [observed, observedKind] of matches ?? []) if (observed !== current || observedKind !== (i === parts.length ? kind : "folder") || i === parts.length && !existing) throw projectFileError("installation path occupied or aliased");
      if (required && !matches?.size) throw projectFileError("installation path disappeared");
    }
    return;
  }
  let parent = vault.getRoot(), prefix = "";
  const parts = path.split("/");
  for (const [index, part] of parts.entries()) {
    prefix = prefix ? prefix + "/" + part : part;
    const matches = parent.children.filter(file => packageNameKey(file.name) === packageNameKey(part));
    if (!matches.length) { if (required) throw projectFileError("installation path disappeared"); return; }
    if (matches.length !== 1 || matches[0]!.path !== prefix) throw projectFileError("installation path alias");
    const file = matches[0]!;
    if (index === parts.length - 1) {
      if (!existing || kind === "file" && !(file instanceof TFile) || kind === "folder" && !(file instanceof TFolder)) throw projectFileError("installation path occupied");
    } else { if (!(file instanceof TFolder)) throw projectFileError("installation parent is a file"); parent = file; }
  }
}

/** Public visible Vault API only; rollback moves bytes to recovery rather than deleting them. */
export function installationVaultStorage(vault: Vault, check: () => void): InstallationStorage {
  const base = stageVaultStorage(vault, check);
  return {
    ...base,
    async mkdir(path) {
      check(); placement(vault, path, "folder", true);
      await base.mkdir(path); check(); placement(vault, path, "folder", true, true);
    },
    async createBinary(path, bytes) {
      check(); placement(vault, path, "file", false);
      await base.createBinary(path, bytes); check(); placement(vault, path, "file", true, true);
    },
    async read(path) {
      check(); const file = vault.getAbstractFileByPath(path);
      if (!file) return null;
      if (!(file instanceof TFile) || file.stat.size > PACKAGE_LIMITS.totalBytes) throw projectFileError("installation journal unavailable");
      const text = await vault.read(file); check();
      if (new TextEncoder().encode(text).length > PACKAGE_LIMITS.totalBytes) throw projectFileError("installation journal too large");
      return text;
    },
    async recover(path, destination) {
      check(); const file = vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile) || vault.getAbstractFileByPath(destination)) throw projectFileError("recovery path conflict");
      await vault.rename(file, destination); check();
    },
  };
}
