import type { ProjectDefinition } from "src/settings/settings";
import { emptyDashboardConfig, migrateTableConfig } from "src/ui/views/Dashboard/migration";
import { checkProjectCoreJson } from "./projectCoreCheck";

/** Deterministic runtime canonicalization, only after the original shape passes validation. */
export function canonicalPackageProject(input: ProjectDefinition): ProjectDefinition {
  const text = JSON.stringify(input), copy = JSON.parse(text) as ProjectDefinition;
  if (checkProjectCoreJson(text).issues.length) return copy;
  return { ...copy, views: copy.views.map(view => {
    if (view.type !== "table") return view;
    const config = view.config;
    if (Array.isArray(config['widgets']) && typeof config['layoutVersion'] === "number") return { ...view, type: "dashboard" };
    // Exactly empty pages stay empty. A scoped fixed identity keeps repeated
    // previews stable; the ordinary import identity allocator remaps it later.
    return { ...view, type: "dashboard", config: { ...(Object.keys(config).length ? migrateTableConfig(config, "legacy-table") : emptyDashboardConfig()) } };
  }) };
}
