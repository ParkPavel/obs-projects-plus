import type { ProjectDefinition } from "src/settings/settings";

export const PROJECT_DOCUMENT_FORMAT = "obs-projects-plus/project-copy";
export const MAX_PROJECT_DOCUMENT_BYTES = 2 * 1024 * 1024;
const BEGIN = "<!-- projects-plus:configuration -->";
const END = "<!-- /projects-plus:configuration -->";
export interface ProjectDocument {
  readonly format: typeof PROJECT_DOCUMENT_FORMAT;
  readonly schemaVersion: 1;
  readonly settingsVersion: 4;
  /** Revision of the persisted project from which this editable copy originated. */
  readonly baseRevision: string;
  readonly project: ProjectDefinition;
}

export function projectFileError(reason: string): Error {
  return new Error(`Project copy: ${reason}`);
}

export function jsonObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Digest exact UTF-8 bytes; callers choose payload revision or full document bytes. */
export async function textDigest(text: string): Promise<string> {
  if (!window.crypto?.subtle) throw projectFileError("secure digest unavailable");
  const bytes = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function checkProject(value: unknown): asserts value is ProjectDefinition {
  if (!jsonObject(value) || typeof value['id'] !== "string" || !value['id'] || value['id'].length > 512 ||
      typeof value['name'] !== "string" || !jsonObject(value['fieldConfig']) || !jsonObject(value['dataSource']) ||
      !Array.isArray(value['views']) || !Array.isArray(value['templates']) || !Array.isArray(value['excludedNotes'])) {
    throw projectFileError("invalid project envelope");
  }
  // Envelope validation is deliberately lossless: unknown custom-view keys survive.
  // This does NOT authorize installing the project or evaluating imported expressions.
  const ids = new Set<string>();
  for (const view of value['views']) {
    if (!jsonObject(view) || typeof view['id'] !== "string" || !view['id'] || ids.has(view['id'])) {
      throw projectFileError("invalid or duplicate view identity");
    }
    ids.add(view['id']);
  }
}

export async function createProjectDocument(project: ProjectDefinition): Promise<ProjectDocument> {
  const serialized = JSON.stringify(project);
  if (new TextEncoder().encode(serialized).length > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("project too large");
  const copy: unknown = JSON.parse(serialized);
  checkProject(copy);
  // Preserve insertion order too: custom configurations can use object key order.
  // A reordered payload is a separate conservative revision, not a lost setting.
  return { format: PROJECT_DOCUMENT_FORMAT, schemaVersion: 1, settingsVersion: 4,
    baseRevision: await textDigest(serialized), project: copy };
}

export function printProjectDocument(document: ProjectDocument): string {
  const text = `# Projects Plus\n\n${BEGIN}\n\`\`\`json\n${JSON.stringify(document, null, 2)}\n\`\`\`\n${END}\n`;
  if (new TextEncoder().encode(text).length > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("document too large");
  return text;
}

/** Parse only an explicitly marked document; surrounding prose is never executable. */
export function parseProjectDocument(text: string): ProjectDocument {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("document too large");
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const begin = lines.flatMap((line, index) => line === BEGIN ? [index] : []);
  const end = lines.flatMap((line, index) => line === END ? [index] : []);
  if (begin.length !== 1 || end.length !== 1 || lines[begin[0]! + 1] !== "```json" ||
      lines[end[0]! - 1] !== "```" || end[0]! <= begin[0]! + 3) throw projectFileError("ambiguous configuration block");
  const value: unknown = JSON.parse(lines.slice(begin[0]! + 2, end[0]! - 1).join("\n"));
  if (!jsonObject(value) || value['format'] !== PROJECT_DOCUMENT_FORMAT || value['schemaVersion'] !== 1 ||
      value['settingsVersion'] !== 4 || typeof value['baseRevision'] !== "string" || !/^[a-f0-9]{64}$/.test(value['baseRevision'])) {
    throw projectFileError("unsupported configuration version");
  }
  checkProject(value['project']);
  return value as unknown as ProjectDocument;
}
