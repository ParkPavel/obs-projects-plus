import type { ProjectDefinition } from "src/settings/settings";
import { blockRefId, blockRefsReadBy, blocksOf, dashboardsOf, MAX_BLOCK_CHAIN, parseBlockRef } from "src/lib/relations/blockRefs";
import { projectFileError } from "./document";
import { PACKAGE_LIMITS } from "./packagePolicy";

/** Same chain rule as runtime, indexed once for a closed batch instead of scanning every project per edge. */
export function createPackageBlockCheck(projects: readonly ProjectDefinition[]): (self: string | undefined, target: string) => boolean {
  const canonical = (reference: string) => {
    const parsed = parseBlockRef(reference);
    return parsed ? blockRefId(parsed.projectId, parsed.viewId, parsed.widgetId) : undefined;
  };
  const edges = new Map<string, readonly string[]>(); let count = 0;
  for (const project of projects) for (const dashboard of dashboardsOf(project)) for (const block of blocksOf(dashboard)) {
    if (edges.size >= PACKAGE_LIMITS.dependencies) throw projectFileError("too many indexed blocks");
    const next = blockRefsReadBy(block).map(canonical).filter((value): value is string => value !== undefined);
    if ((count += next.length) > PACKAGE_LIMITS.dependencies) throw projectFileError("too many indexed block reads");
    edges.set(blockRefId(project.id, dashboard.viewId, block.id), next);
  }
  return (self, target) => {
    const done = new Set<string>();
    const walk = (key: string, path: readonly string[]): boolean => {
      // Keep the runtime's ordered DFS and shared done-set exactly, including
      // its depth-before-done rule for shared nodes reached along unequal paths.
      if (key === self || path.includes(key) || path.length >= MAX_BLOCK_CHAIN) return true;
      if (done.has(key)) return false;
      for (const next of edges.get(key) ?? []) if (walk(next, [...path, key])) return true;
      done.add(key); return false;
    };
    const key = canonical(target); return key === undefined ? false : walk(key, []);
  };
}
