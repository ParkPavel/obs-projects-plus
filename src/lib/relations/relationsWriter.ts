/**
 * Inverse WikiLink relation write-back.
 */

import { TFile, type App } from "obsidian";
import type { RelationFieldConfig } from "src/settings/base/settings";

export interface RelationWriteContext {
  sourceRecordId: string;
  fieldName: string;
  fieldConfig: RelationFieldConfig;
  /** Explicit authority to create a missing inverse field. Legacy callers omit it. */
  createIfMissing?: boolean;
  newValue: string | string[] | null | undefined;
  oldValue: string | string[] | null | undefined;
  app: App;
}

export type RelationWriteIssue = {
  readonly operation: "add" | "remove";
  readonly targetLink: string;
  readonly code: "target-not-found" | "inverse-field-missing" | "write-failed";
  readonly error?: unknown;
};

/** Observable outcome: callers can surface or retry an inverse failure. */
export type RelationWriteOutcome = {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly issues: readonly RelationWriteIssue[];
};

/**
 * Write inverse relation links when a forward relation changes.
 *
 * Contract:
 * - Added links append the source WikiLink to the configured inverse field.
 * - Removed links remove that source WikiLink from the configured inverse field.
 * - An unresolved target is returned as a typed issue; it is never silent.
 * - A missing inverse field is returned as a typed issue unless the caller
 *   explicitly supplies `createIfMissing: true`. Legacy callers retain false.
 */
export async function writeInverseRelations(
  ctx: RelationWriteContext
): Promise<RelationWriteOutcome> {
  const { fieldConfig, sourceRecordId } = ctx;
  if (!fieldConfig.inverseFieldName) return emptyOutcome();

  const oldLinks = normalizeLinks(ctx.oldValue);
  const newLinks = normalizeLinks(ctx.newValue);
  const added = newLinks.filter((link) => !oldLinks.includes(link));
  const removed = oldLinks.filter((link) => !newLinks.includes(link));
  if (added.length === 0 && removed.length === 0) return emptyOutcome();

  const inverseField = fieldConfig.inverseFieldName;
  const sourceLink = `[[${sourceRecordId}]]`;
  const outcomes = await Promise.all([
    ...added.map((targetLink) => writeOne("add", targetLink, ctx, inverseField, sourceLink)),
    ...removed.map((targetLink) => writeOne("remove", targetLink, ctx, inverseField, sourceLink)),
  ]);
  return outcomes.reduce<RelationWriteOutcome>(
    (result, outcome) => ({
      added: [...result.added, ...outcome.added],
      removed: [...result.removed, ...outcome.removed],
      issues: [...result.issues, ...outcome.issues],
    }),
    emptyOutcome()
  );
}

function normalizeLinks(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map(stripWikiLink);
}

function stripWikiLink(value: string): string {
  const match = value.match(/^\[\[(.+?)(?:\|.+?)?\]\]$/);
  return match ? (match[1] ?? value) : value;
}

async function writeOne(
  operation: "add" | "remove",
  targetLink: string,
  ctx: RelationWriteContext,
  inverseField: string,
  sourceLink: string
): Promise<RelationWriteOutcome> {
  const file = resolveFile(ctx.app, targetLink, ctx.sourceRecordId);
  if (!file) return issueOutcome(operation, targetLink, "target-not-found");

  try {
    let inverseFieldMissing = false;
    let changed = false;
    await ctx.app.fileManager.processFrontMatter(file, (frontmatter) => {
      inverseFieldMissing = !Object.prototype.hasOwnProperty.call(frontmatter, inverseField);
      if (inverseFieldMissing && !ctx.createIfMissing) return;

      const current = normalizeFmList(frontmatter[inverseField]);
      if (operation === "add") {
        if (!current.includes(sourceLink)) {
          frontmatter[inverseField] = [...current, sourceLink];
          changed = true;
        }
        return;
      }

      const next = current.filter((value) => value !== sourceLink);
      if (next.length !== current.length) {
        if (next.length === 0) delete frontmatter[inverseField];
        else frontmatter[inverseField] = next;
        changed = true;
      }
    });

    if (inverseFieldMissing && !ctx.createIfMissing) {
      return issueOutcome(operation, targetLink, "inverse-field-missing");
    }
    return operation === "add"
      ? { added: changed ? [targetLink] : [], removed: [], issues: [] }
      : { added: [], removed: changed ? [targetLink] : [], issues: [] };
  } catch (error) {
    return issueOutcome(operation, targetLink, "write-failed", error);
  }
}

function resolveFile(app: App, nameOrLink: string, sourcePath: string): TFile | null {
  const bare = stripWikiLink(nameOrLink);
  const byPath = app.vault.getAbstractFileByPath(bare);
  if (byPath instanceof TFile) return byPath;
  const metadataCache = (
    app as unknown as {
      metadataCache?: { getFirstLinkpathDest?(path: string, source: string): TFile | null };
    }
  ).metadataCache;
  return metadataCache?.getFirstLinkpathDest?.(bare, sourcePath) ?? null;
}

function normalizeFmList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function emptyOutcome(): RelationWriteOutcome {
  return { added: [], removed: [], issues: [] };
}

function issueOutcome(
  operation: "add" | "remove",
  targetLink: string,
  code: RelationWriteIssue["code"],
  error?: unknown
): RelationWriteOutcome {
  return {
    added: [],
    removed: [],
    issues: [{ operation, targetLink, code, ...(error === undefined ? {} : { error }) }],
  };
}
