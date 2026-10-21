/**
 * i3-props — persistence for `propertyKeys.ts`: one `processFrontMatter` per
 * rename or delete, so the key, its overlay entries and its type move together
 * or not at all. Resolves false when the host has no frontmatter API or the
 * mutation did not apply (the key vanished, the new name appeared meanwhile).
 */

import type { App, TFile } from "obsidian";
import { deleteKeyIn, renameKeyIn } from "./propertyKeys";

type ProcessFn = (
  file: TFile,
  fn: (frontmatter: Record<string, unknown>) => void,
) => Promise<void>;

function getProcessFrontMatter(app: App): ProcessFn | null {
  const fm = (app.fileManager as unknown as { processFrontMatter?: ProcessFn }).processFrontMatter;
  return typeof fm === "function" ? fm.bind(app.fileManager) : null;
}

async function apply(app: App, file: TFile, fn: (fm: Record<string, unknown>) => boolean): Promise<boolean> {
  const processFn = getProcessFrontMatter(app);
  if (!processFn) return false;
  let applied = false;
  await processFn(file, (frontmatter) => {
    applied = fn(frontmatter);
  });
  return applied;
}

export function renameProperty(app: App, file: TFile, from: string, to: string): Promise<boolean> {
  return apply(app, file, (fm) => renameKeyIn(fm, from, to));
}

export function deleteProperty(app: App, file: TFile, key: string): Promise<boolean> {
  return apply(app, file, (fm) => deleteKeyIn(fm, key));
}
