/**
 * R1.3 — Persistence helper for manual relations.
 *
 * Mirrors `overlayWriter.ts`: goes through `app.fileManager.processFrontMatter`
 * to take a write-lock and avoid stomping on user edits.
 */

import type { App, TFile } from "obsidian";
import {
  DEFAULT_RELATION_KEY,
  appendRelation,
  removeRelation,
  type RelationTarget,
} from "./relations";

type ProcessFn = (
  file: TFile,
  fn: (frontmatter: Record<string, unknown>) => void,
) => Promise<void>;

function getProcessFrontMatter(app: App): ProcessFn | null {
  const fm = (app.fileManager as unknown as {
    processFrontMatter?: ProcessFn;
  }).processFrontMatter;
  return typeof fm === "function" ? fm.bind(app.fileManager) : null;
}

export async function appendRelationToFile(
  app: App,
  file: TFile,
  target: RelationTarget,
  key: string = DEFAULT_RELATION_KEY,
): Promise<boolean> {
  const processFn = getProcessFrontMatter(app);
  if (!processFn) return false;
  await processFn(file, (frontmatter) => {
    frontmatter[key] = appendRelation(frontmatter, key, target);
  });
  return true;
}

export async function removeRelationFromFile(
  app: App,
  file: TFile,
  path: string,
  key: string = DEFAULT_RELATION_KEY,
): Promise<boolean> {
  const processFn = getProcessFrontMatter(app);
  if (!processFn) return false;
  await processFn(file, (frontmatter) => {
    const next = removeRelation(frontmatter, key, path);
    if (next.length === 0) {
      delete frontmatter[key];
    } else {
      frontmatter[key] = next;
    }
  });
  return true;
}
