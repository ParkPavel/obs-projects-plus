import { jsonObject, MAX_PROJECT_DOCUMENT_BYTES, projectFileError } from "./document";
import { packageNameKey } from "./packageManifest";
import type { PackageFilePlan } from "./packageFilePlan";
import { createPackagePathGuard, PACKAGE_PATH_LIMITS, snapshotVaultPathIndex, type VaultPathEntry } from "./packagePathPolicy";
import { PACKAGE_LIMITS } from "./packagePolicy";

export interface ConfigPathChoice {
  readonly projectId: string;
  readonly location: readonly (string | number)[];
  readonly root: string;
  readonly source: string;
  readonly kind: "file" | "folder";
  readonly target: string;
  readonly origin: "existing" | "planned";
}
export interface ConfigBindingTarget { readonly path: string; readonly kind: "file" | "folder"; readonly origin: "existing" | "planned" }
type TargetNode = { kind: VaultPathEntry["kind"] | null; existing: boolean };
export const configPathChoiceKey = (projectId: string, location: readonly (string | number)[]): string => JSON.stringify([projectId, location]);

/** Capture UI choices before async work. They are intent, never installation authority. */
export function captureConfigPathChoices(input: readonly ConfigPathChoice[]): readonly ConfigPathChoice[] {
  if (!Array.isArray(input) || input.length > PACKAGE_LIMITS.dependencies) throw projectFileError("invalid path choices");
  const keys = new Set<string>(); let bytes = 0;
  const allowed = ["projectId", "location", "root", "source", "kind", "target", "origin"];
  const result = input.map(value => {
    if (!jsonObject(value) || Object.keys(value).some(key => !allowed.includes(key))) throw projectFileError("invalid path choice");
    const { projectId, location: rawLocation, root, source, kind, target, origin } = value;
    if (typeof projectId !== "string" || !projectId || projectId.length > 512 ||
        !Array.isArray(rawLocation) || !rawLocation.length || rawLocation.length > 16 || rawLocation.some((part: unknown) => typeof part === "string" ? !part || part.length > 100 : typeof part !== "number" || !Number.isSafeInteger(part) || part < 0) ||
        typeof root !== "string" || !root || root.length > 240 || typeof source !== "string" || source.length > 240 ||
        typeof target !== "string" || !target || target.length > 240 || (kind !== "file" && kind !== "folder") || (origin !== "existing" && origin !== "planned")) throw projectFileError("invalid path choice");
    const key = configPathChoiceKey(projectId, rawLocation);
    if (keys.has(key)) throw projectFileError("duplicate path choice"); keys.add(key);
    const location = rawLocation.map((part: unknown): string | number => {
      if (typeof part === "string" || typeof part === "number") return part;
      throw projectFileError("invalid path choice");
    });
    const copy = Object.freeze({ projectId, location: Object.freeze(location), root, source, kind, target, origin });
    bytes += new TextEncoder().encode(JSON.stringify(copy)).length;
    if (bytes > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("path choices too large");
    return copy;
  });
  return Object.freeze(result);
}

/** Safe explicit targets share the exact file-placement policy, aliases and ancestor checks. */
export function createConfigPathBindings(files: PackageFilePlan, existing: readonly VaultPathEntry[], configDir: string, copyRoots: readonly string[], choices: readonly ConfigPathChoice[]) {
  const guard = createPackagePathGuard(configDir, copyRoots);
  const index = new Map<string, Map<string, TargetNode>>();
  let count = 0, characters = 0;
  const add = (path: string, kind: VaultPathEntry["kind"], observed: boolean) => {
    const key = packageNameKey(path), variants = index.get(key) ?? new Map<string, TargetNode>();
    const prior = variants.get(path);
    if (prior) { if (prior.kind !== kind) prior.kind = null; prior.existing ||= observed; return; }
    characters += path.length;
    if (++count > PACKAGE_PATH_LIMITS.entries || characters > PACKAGE_PATH_LIMITS.characters) throw projectFileError("binding target inventory too large");
    variants.set(path, { kind, existing: observed }); index.set(key, variants);
  };
  for (const variants of snapshotVaultPathIndex(existing).values()) for (const [path, kind] of variants) add(path, kind, true);
  for (const folder of files.folders) add(folder, "folder", false);
  for (const file of files.files) add(file.destination, "file", false);
  const ancestry = new Map<string, boolean>();
  const safeFolder = (path: string): boolean => {
    if (ancestry.has(path)) return ancestry.get(path)!;
    const variants = index.get(packageNameKey(path)), row = variants?.get(path), at = path.lastIndexOf("/");
    const safe = variants?.size === 1 && row?.kind === "folder" && (at < 0 || safeFolder(path.slice(0, at)));
    ancestry.set(path, safe); return safe;
  };
  const targets: ConfigBindingTarget[] = [];
  for (const variants of index.values()) {
    if (variants.size !== 1) continue;
    for (const [path, row] of variants) {
      if (row.kind === null) continue;
      try { guard(path, row.kind === "file"); } catch { continue; }
      const at = path.lastIndexOf("/");
      if (row.kind === "folder" ? !safeFolder(path) : at >= 0 && !safeFolder(path.slice(0, at))) continue;
      targets.push(Object.freeze({ path, kind: row.kind, origin: row.existing ? "existing" : "planned" }));
    }
  }
  const eligible = new Map(targets.map(target => [JSON.stringify([target.path, target.kind, target.origin]), target]));
  const selected = new Map(choices.map(choice => [configPathChoiceKey(choice.projectId, choice.location), choice]));
  const used = new Set<string>();
  return {
    targets: Object.freeze(targets),
    resolve(projectId: string, location: readonly (string | number)[], source: string, kind: VaultPathEntry["kind"]): { status: "absent" } | { status: "invalid" } | { status: "chosen"; target: ConfigBindingTarget } {
      const key = configPathChoiceKey(projectId, location), choice = selected.get(key);
      if (!choice) return { status: "absent" };
      used.add(key);
      const target = eligible.get(JSON.stringify([choice.target, kind, choice.origin]));
      return choice.root === files.root && choice.source === source && choice.kind === kind && target ? { status: "chosen", target } : { status: "invalid" };
    },
    unused: () => choices.filter(choice => !used.has(configPathChoiceKey(choice.projectId, choice.location))),
  };
}
