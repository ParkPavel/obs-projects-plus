import { binaryDigest, type PackageManifest } from "./package";
import { createProjectDocument, parseProjectDocument, textDigest, type ProjectDocument } from "./document";
import { readStoredProjectZip } from "./packageZipReader";
import { validatePackageManifest } from "./packageManifest";
import { PACKAGE_LIMITS, PackageInspectionError } from "./packagePolicy";
import { packageDependencies } from "./packageDependencies";
import type { LatestProjectsPluginSettings } from "src/settings/settings";

export interface InspectedProjectPackage {
  manifest: PackageManifest;
  documents: readonly ProjectDocument[];
  entries: ReadonlyMap<string, Uint8Array>;
  archiveHash: string;
}

/** Integrity and envelope inspection only. This does not authorize applying config or executing expressions. */
export async function inspectProjectPackage(input: Uint8Array, configDir: string, check: () => void = () => {}): Promise<InspectedProjectPackage> {
  check();
  if (input.length > PACKAGE_LIMITS.archiveBytes) throw new PackageInspectionError("size-limit");
  const captured = await readStoredProjectZip(input, configDir, check);
  const archiveHash = await binaryDigest(captured.archive), entries = captured.entries;
  const manifestBytes = entries.get("manifest.json");
  if (!manifestBytes || manifestBytes.length > PACKAGE_LIMITS.manifestBytes) throw new PackageInspectionError("invalid-manifest");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let manifest: unknown;
  try { manifest = JSON.parse(decoder.decode(manifestBytes)); } catch { throw new PackageInspectionError("invalid-manifest"); }
  validatePackageManifest(manifest, configDir);
  if (entries.size !== manifest.files.length + 1) throw new PackageInspectionError("invalid-manifest");
  for (const file of manifest.files) {
    check();
    const bytes = entries.get(file.path);
    if (!bytes || bytes.length !== file.bytes || await binaryDigest(bytes) !== file.sha256) throw new PackageInspectionError("checksum");
  }
  const documents: ProjectDocument[] = [];
  for (const project of manifest.projects) {
    check();
    let document: ProjectDocument;
    try { document = parseProjectDocument(decoder.decode(entries.get(project.path))); }
    catch { throw new PackageInspectionError("invalid-manifest"); }
    let revision: string;
    try { revision = (await createProjectDocument(document.project)).baseRevision; }
    catch { throw new PackageInspectionError("invalid-manifest"); }
    if (project.id !== document.project.id || project.name !== document.project.name || project.baseRevision !== document.baseRevision ||
        project.path !== `Projects/${await textDigest(project.id)}/Project.md` ||
        revision !== document.baseRevision) throw new PackageInspectionError("invalid-manifest");
    documents.push(document);
  }
  // Never trust a sender's claim that references resolve. Recompute the same
  // known-reference contract against the verified document payloads.
  const state = {
    projects: documents.filter((_, i) => !manifest.projects[i]!.archived).map(document => document.project),
    archives: documents.filter((_, i) => manifest.projects[i]!.archived).map(document => document.project),
  } as LatestProjectsPluginSettings;
  let graph: ReturnType<typeof packageDependencies>;
  try { graph = packageDependencies(state, manifest.rootProjectId); }
  catch { throw new PackageInspectionError("invalid-manifest"); }
  const key = (item: PackageManifest["dependencies"][number]) => JSON.stringify([item.from, item.reference, item.target, item.resolved]);
  const expected = new Set(graph.dependencies.map(key));
  if (graph.projects.length !== documents.length || expected.size !== manifest.dependencies.length ||
      manifest.dependencies.some(item => !expected.has(key(item)))) throw new PackageInspectionError("invalid-manifest");
  check(); return { manifest, documents, entries, archiveHash };
}
