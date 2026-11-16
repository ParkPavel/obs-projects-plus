import { jsonObject, MAX_PROJECT_DOCUMENT_BYTES, projectFileError, textDigest } from "./document";
import { configPathChoiceKey } from "./packagePathBindings";
import type { ConfigPathIssue, ConfigPathScope, PackageConfigPathPreview } from "./packageConfigPaths";
import { PACKAGE_LIMITS } from "./packagePolicy";

export interface PackageScopeChoice {
  readonly projectId: string;
  readonly location: readonly (string | number)[];
  readonly revision: string;
  readonly mode: "keep-rule";
}
export interface ReviewedPackageScope extends ConfigPathScope {
  readonly revision: string;
  readonly status: "pending" | "confirmed" | "invalid" | "blocked";
  readonly blockedReason?: "source-issues" | "long-rule";
}
export interface PackageScopeReview {
  readonly rows: readonly ReviewedPackageScope[];
  readonly choices: readonly PackageScopeChoice[];
  readonly issues: readonly ConfigPathIssue[];
}
export const MAX_SCOPE_RULE_DISPLAY = 8192;
export const scopeRuleDisplayable = (value: string): boolean => value.length <= MAX_SCOPE_RULE_DISPLAY && value.split("\n").length <= 128;

/** UI intent only. Capture before awaiting; never a schema/application authorization. */
export function capturePackageScopeChoices(input: readonly PackageScopeChoice[]): readonly PackageScopeChoice[] {
  if (!Array.isArray(input) || input.length > PACKAGE_LIMITS.dependencies) throw projectFileError("invalid source scope choices");
  const keys = new Set<string>(); let bytes = 0;
  return Object.freeze(input.map(value => {
    if (!jsonObject(value) || Object.keys(value).some(key => !["projectId", "location", "revision", "mode"].includes(key))) throw projectFileError("invalid source scope choice");
    const { projectId, location, revision, mode } = value;
    if (typeof projectId !== "string" || !projectId || projectId.length > 512 || !Array.isArray(location) || !location.length || location.length > 16 ||
        location.some((part: unknown) => typeof part === "string" ? !part || part.length > 100 : typeof part !== "number" || !Number.isSafeInteger(part) || part < 0) ||
        typeof revision !== "string" || !/^[a-f0-9]{64}$/.test(revision) || mode !== "keep-rule") throw projectFileError("invalid source scope choice");
    const key = configPathChoiceKey(projectId, location);
    if (keys.has(key)) throw projectFileError("duplicate source scope choice"); keys.add(key);
    const capturedLocation = location.map((part: unknown): string | number => {
      if (typeof part === "string" || typeof part === "number") return part;
      throw projectFileError("invalid source scope choice");
    });
    const copy = Object.freeze({ projectId, location: Object.freeze(capturedLocation), revision, mode });
    bytes += new TextEncoder().encode(JSON.stringify(copy)).length;
    if (bytes > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("source scope choices too large");
    return copy;
  }));
}

/** Confirms only the displayed source rule. Keeps all unrelated diagnostics and configuration bytes. */
export async function reviewPackageScopes(preview: PackageConfigPathPreview, basisRevision: string, input: readonly PackageScopeChoice[] = [], check: () => void = () => undefined): Promise<PackageScopeReview> {
  check();
  if (!/^[a-f0-9]{64}$/.test(basisRevision)) throw projectFileError("invalid source scope revision");
  const choices = capturePackageScopeChoices(input);
  const selected = new Map(choices.map(choice => [configPathChoiceKey(choice.projectId, choice.location), choice]));
  const used = new Set<string>(), confirmed = new Set<string>();
  const revisions = new Map<string, string>();
  // Capture bounded projects before the first await. The service passes private validated previews.
  if (preview.projects.length > PACKAGE_LIMITS.projects || preview.scopes.length > PACKAGE_LIMITS.dependencies || preview.issues.length > PACKAGE_LIMITS.dependencies) throw projectFileError("source scope review too large");
  const scopeSnapshot = preview.scopes.map(scope => ({ ...scope, location: [...scope.location] }));
  const issueSnapshot = preview.issues.map(issue => ({ ...issue, location: [...issue.location] }));
  let totalBytes = 0;
  const captures = preview.projects.map(item => {
    const text = JSON.stringify(item), bytes = new TextEncoder().encode(text).length; totalBytes += bytes;
    if (bytes > MAX_PROJECT_DOCUMENT_BYTES + 128 || totalBytes > PACKAGE_LIMITS.totalBytes + 128 * PACKAGE_LIMITS.projects) throw projectFileError("source scope project too large");
    return { id: item.project.id, text };
  });
  for (const item of captures) { const revision = await textDigest(basisRevision + "\n" + item.text); check(); revisions.set(item.id, revision); }
  const issues: ConfigPathIssue[] = [...issueSnapshot];
  const addIssue = (choice: PackageScopeChoice, code: "invalid-scope-choice" | "stale-scope-choice") => {
    if (issues.length >= PACKAGE_LIMITS.dependencies) throw projectFileError("too many source scope decisions");
    issues.push(Object.freeze({ projectId: choice.projectId, location: Object.freeze([...choice.location]), code }));
  };
  // Index issue prefixes once, instead of scanning every diagnostic for every source.
  const issueLocations = new Set<string>(), issueAncestors = new Set<string>();
  for (const issue of issueSnapshot) if (issue.code !== "scope-choice-required") {
    issueLocations.add(configPathChoiceKey(issue.projectId, issue.location));
    for (let length = 0; length <= issue.location.length; length++) issueAncestors.add(configPathChoiceKey(issue.projectId, issue.location.slice(0, length)));
  }
  const rows = scopeSnapshot.map(scope => {
    const key = configPathChoiceKey(scope.projectId, scope.location), choice = selected.get(key), revision = revisions.get(scope.projectId);
    if (!revision) throw projectFileError("source scope project missing");
    // Acknowledging scope cannot fix malformed or unbound source config. Other fields remain independent.
    const sourceIssues = issueAncestors.has(key) || scope.location.some((_, i) => issueLocations.has(configPathChoiceKey(scope.projectId, scope.location.slice(0, i)))) || issueLocations.has(key);
    const blockedReason = sourceIssues ? "source-issues" as const : !scopeRuleDisplayable(scope.value) ? "long-rule" as const : undefined;
    if (choice) { used.add(key); if (choice.revision !== revision || blockedReason) addIssue(choice, "invalid-scope-choice"); else confirmed.add(key); }
    return Object.freeze({ ...scope, location: Object.freeze([...scope.location]), revision,
      status: blockedReason ? "blocked" as const : choice ? choice.revision === revision ? "confirmed" as const : "invalid" as const : "pending" as const,
      ...(blockedReason ? { blockedReason } : {}) });
  });
  for (const choice of choices) if (!used.has(configPathChoiceKey(choice.projectId, choice.location))) addIssue(choice, "stale-scope-choice");
  return Object.freeze({ rows: Object.freeze(rows), choices, issues: Object.freeze(issues.filter(issue => issue.code !== "scope-choice-required" || !confirmed.has(configPathChoiceKey(issue.projectId, issue.location)))) });
}
