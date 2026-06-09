/**
 * Dashboard V2 (NPLAN-C2 / Sprint 4) — two-way relation write-back.
 *
 * When a forward relation field is edited, writes the inverse link on
 * the target file's frontmatter if `inverseFieldName` is configured.
 * Uses the same `createFrontmatterWriter` path as cell edits so retry
 * logic and encoding are consistent.
 */

import { TFile, type App } from "obsidian";
import type { RelationFieldConfig } from "src/settings/base/settings";

export interface RelationWriteContext {
  /** Basename (no extension) or wiki-link text identifying the source. */
  sourceRecordId: string;
  /** Name of the relation field on source file. */
  fieldName: string;
  /** Field config — must include `inverseFieldName` to trigger write-back. */
  fieldConfig: RelationFieldConfig;
  /** New value (wiki-link strings, raw). */
  newValue: string | string[] | null | undefined;
  /** Previous value before this edit. */
  oldValue: string | string[] | null | undefined;
  app: App;
}

/**
 * Write inverse relation links when a forward relation changes.
 *
 * **Contract:**
 * - Added links → append `sourceRecordId` to `inverseFieldName` on target.
 * - Removed links → remove `sourceRecordId` from `inverseFieldName` on target.
 * - Target file not found → silently skip (vault may not contain all targets).
 * - Does NOT create the inverse field if it doesn't exist (avoids polluting
 *   notes that never opted in). Sprint 5+ can add an opt-in creation flag.
 */
export async function writeInverseRelations(
  ctx: RelationWriteContext
): Promise<void> {
  const { fieldConfig, sourceRecordId, app } = ctx;
  if (!fieldConfig.inverseFieldName) return;

  const oldLinks = normalizeLinks(ctx.oldValue);
  const newLinks = normalizeLinks(ctx.newValue);

  const added = newLinks.filter((l) => !oldLinks.includes(l));
  const removed = oldLinks.filter((l) => !newLinks.includes(l));
  if (added.length === 0 && removed.length === 0) return;

  const inverseField = fieldConfig.inverseFieldName;
  const sourceLink = `[[${sourceRecordId}]]`;

  await Promise.all([
    ...added.map(async (targetLink) => {
      const file = resolveFile(app, targetLink);
      if (!file) return;
      await app.fileManager.processFrontMatter(file, (fm) => {
        const cur = normalizeFmList(fm[inverseField]);
        if (!cur.includes(sourceLink)) {
          fm[inverseField] = [...cur, sourceLink];
        }
      });
    }),
    ...removed.map(async (targetLink) => {
      const file = resolveFile(app, targetLink);
      if (!file) return;
      await app.fileManager.processFrontMatter(file, (fm) => {
        const cur = normalizeFmList(fm[inverseField]);
        const next = cur.filter((v) => v !== sourceLink);
        if (next.length === 0) {
          delete fm[inverseField];
        } else {
          fm[inverseField] = next;
        }
      });
    }),
  ]);
}

// ── Helpers ───────────────────────────────────────────────

function normalizeLinks(v: string | string[] | null | undefined): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map(stripWikiLink);
}

/** Strip `[[...]]` brackets if present, return bare basename. */
function stripWikiLink(s: string): string {
  const m = s.match(/^\[\[(.+?)(?:\|.+?)?\]\]$/);
  return m ? (m[1] ?? s) : s;
}

function resolveFile(app: App, nameOrLink: string): TFile | null {
  const bare = stripWikiLink(nameOrLink);
  const byPath = app.vault.getAbstractFileByPath(bare);
  if (byPath instanceof TFile) {
    return byPath;
  }
  const meta = (app as unknown as { metadataCache?: { getFirstLinkpathDest?(p: string, src: string): TFile | null } }).metadataCache;
  return meta?.getFirstLinkpathDest?.(bare, "") ?? null;
}

function normalizeFmList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}
