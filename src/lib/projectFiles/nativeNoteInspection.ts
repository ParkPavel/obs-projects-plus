import type { CachedMetadata, Vault, MetadataCache } from "obsidian";
import { projectFileError, textDigest } from "./document";
import { ensureProjectFolders } from "./storage";
import { projectVaultStorage } from "./vaultStorage";
import { v4 as uuidv4 } from "uuid";

export interface NativeNoteInspection { readonly text: string; readonly cache: CachedMetadata }

/** Parse through the public metadata event, never Markdown rendering or imported expressions. */
export async function inspectNativeNote(vault: Vault, metadata: MetadataCache, incoming: string, source: string, text: string,
  check: () => void, expectedPath?: string): Promise<NativeNoteInspection> {
  check();
  const path = expectedPath ?? `${incoming}/Note inspection/${uuidv4()}/${await textDigest(source)}.md`;
  await ensureProjectFolders(projectVaultStorage(vault, () => { check(); return true; }), path.slice(0, path.lastIndexOf("/")));
  let timer: number | undefined;
  let resolve!: (cache: CachedMetadata) => void;
  let reject!: (reason: Error) => void;
  const ready = new Promise<CachedMetadata>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
    timer = window.setTimeout(() => reject(projectFileError("native note inspection timed out")), 15000);
  });
  const event = metadata.on("changed", (file, data, cache) => {
    if (file.path !== path || data !== text) return;
    if ((cache.links?.length ?? 0) + (cache.embeds?.length ?? 0) + (cache.referenceLinks?.length ?? 0) + (cache.frontmatterLinks?.length ?? 0) > 4096) { reject(projectFileError("too many note links")); return; }
    resolve(JSON.parse(JSON.stringify({ links: cache.links, embeds: cache.embeds, referenceLinks: cache.referenceLinks,
      frontmatterLinks: cache.frontmatterLinks, frontmatterPosition: cache.frontmatterPosition })) as CachedMetadata);
  });
  // Attach rejection handling before Vault.create, which can itself await indexing.
  const result = ready.then(cache => ({ text, cache }));
  void result.catch(() => {});
  try {
    check(); await vault.create(path, text); check();
    const inspected = await result; check();
    return inspected;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
    metadata.offref(event);
  }
}
