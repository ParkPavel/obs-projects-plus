import type { ProjectDefinition } from "src/settings/settings";

import {
  checkProject,
  createProjectDocument,
  jsonObject,
  MAX_PROJECT_DOCUMENT_BYTES,
  projectFileError,
} from "./document";

export const PROJECT_CONFIGURATION_FORMAT = "obs-projects-plus/project-configuration";

/**
 * Owner-scoped, editable project configuration envelope.
 *
 * `baseRevision` identifies the persisted project this draft originated from. It
 * describes the origin, not the current contents, so an edited payload keeps it.
 */
export interface ProjectConfiguration {
  readonly format: typeof PROJECT_CONFIGURATION_FORMAT;
  readonly schemaVersion: 1;
  readonly settingsVersion: 4;
  readonly owner: string;
  readonly baseRevision: string;
  readonly project: ProjectDefinition;
}

const MAX_CONFIGURATION_NODES = 16384;
const MAX_CONFIGURATION_DEPTH = 32;
const OWNER_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const REVISION_PATTERN = /^[a-f0-9]{64}$/;
const ENVELOPE_KEYS = ["format", "schemaVersion", "settingsVersion", "owner", "baseRevision", "project"] as const;

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

function checkOwner(owner: unknown): asserts owner is string {
  if (typeof owner !== "string" || !OWNER_PATTERN.test(owner)) throw projectFileError("invalid configuration owner");
}

/**
 * Bounds the whole decoded payload, including opaque unknown sections, with the
 * same approach as `checkProjectCoreJson`: iterative, no recursion, no
 * execution, and independent of the typed visitors below.
 */
function boundPayload(value: unknown): void {
  let nodes = 0;
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > MAX_CONFIGURATION_NODES || item.depth > MAX_CONFIGURATION_DEPTH) throw projectFileError("configuration too complex");
    if (typeof item.value === "number" && !Number.isFinite(item.value)) throw projectFileError("non-finite configuration value");
    if (item.value && typeof item.value === "object") {
      const values = Object.values(item.value);
      if (nodes + stack.length + values.length > MAX_CONFIGURATION_NODES) throw projectFileError("configuration too complex");
      for (const next of values) stack.push({ value: next, depth: item.depth + 1 });
    }
  }
}

/**
 * Serializes an owned project configuration as pretty JSON plus a trailing LF.
 *
 * `createProjectDocument` snapshots the project synchronously and digests that
 * snapshot, so later caller mutations cannot change the emitted document.
 */
export async function createProjectConfiguration(project: ProjectDefinition, owner: string): Promise<string> {
  checkOwner(owner);
  const document = await createProjectDocument(project);
  const configuration: ProjectConfiguration = {
    format: PROJECT_CONFIGURATION_FORMAT,
    schemaVersion: 1,
    settingsVersion: 4,
    owner,
    baseRevision: document.baseRevision,
    project: document.project,
  };
  boundPayload(configuration);
  const text = `${JSON.stringify(configuration, null, 2)}\n`;
  if (utf8Length(text) > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("configuration too large");
  return text;
}

/**
 * Parses an owned project configuration envelope.
 *
 * This is envelope-only validation and is NOT installation authority: the caller
 * must validate the project graph/schema and the owner against trusted primary
 * metadata before applying anything. Unknown project JSON survives losslessly in
 * insertion order (integer-like keys follow JavaScript ordering, exactly as in
 * `parseProjectDocument`). An edited payload is accepted with its origin
 * `baseRevision`; the digest is deliberately not re-checked here.
 */
export function parseProjectConfiguration(text: string): ProjectConfiguration {
  if (typeof text !== "string" || text.length > MAX_PROJECT_DOCUMENT_BYTES || utf8Length(text) > MAX_PROJECT_DOCUMENT_BYTES) throw projectFileError("configuration too large");
  const value: unknown = JSON.parse(text);
  boundPayload(value);
  if (!jsonObject(value) || Object.keys(value).length !== ENVELOPE_KEYS.length ||
      ENVELOPE_KEYS.some(key => !Object.prototype.hasOwnProperty.call(value, key))) throw projectFileError("invalid configuration envelope");
  if (value["format"] !== PROJECT_CONFIGURATION_FORMAT || value["schemaVersion"] !== 1 || value["settingsVersion"] !== 4) throw projectFileError("unsupported configuration version");
  const owner = value["owner"];
  checkOwner(owner);
  const baseRevision = value["baseRevision"];
  if (typeof baseRevision !== "string" || !REVISION_PATTERN.test(baseRevision)) throw projectFileError("invalid configuration revision");
  const project = value["project"];
  checkProject(project);
  return { format: PROJECT_CONFIGURATION_FORMAT, schemaVersion: 1, settingsVersion: 4, owner, baseRevision, project };
}
