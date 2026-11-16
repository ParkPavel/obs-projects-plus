import type { ProjectDefinition } from "src/settings/settings";
import { blockReadCycle, blockRefId, blockRefsReadBy, blocksOf, dashboardsOf, MAX_BLOCK_CHAIN, parseBlockRef } from "src/lib/relations/blockRefs";
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
  const memo = Array.from({ length: MAX_BLOCK_CHAIN + 1 }, () => new Map<string, boolean>());
  const invalid = (key: string, remaining: number): boolean => {
    // Runtime refuses the ninth target before attempting its lookup, including
    // a missing target. Any cycle also supplies a path beyond this finite bound.
    if (!remaining) return true;
    const previous = memo[remaining]!.get(key); if (previous !== undefined) return previous;
    const result = (edges.get(key) ?? []).some(next => invalid(next, remaining - 1));
    memo[remaining]!.set(key, result); return result;
  };
  return (self, target) => {
    const key = canonical(target); if (key === undefined) return false;
    if (self === key) return true;
    // Batch callers provide actual outgoing reads. Preserve the general helper
    // contract for a hypothetical self/target pair outside that stored graph.
    if (self !== undefined && !edges.get(self)?.includes(key)) return blockReadCycle(projects, self, target);
    return invalid(key, MAX_BLOCK_CHAIN);
  };
}
