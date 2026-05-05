/**
 * R2.6 — Cell editor persistence.
 *
 * REFACTOR-203: thin wrapper around `FrontmatterWriter` (the canonical
 * mutator since REFACTOR-202). Returns `false` when the host doesn't
 * expose `processFrontMatter` (older Obsidian / unit tests with bare
 * mocks) so the caller can fall back gracefully.
 */

import type { App, TFile } from "obsidian";
import type { CellValue } from "./cellEditor";
import { createFrontmatterWriter } from "src/lib/frontmatter/writer";

interface FileManagerWithProcessFM {
  processFrontMatter?: unknown;
}

export async function writeCellValue(
  app: App,
  file: TFile,
  key: string,
  value: CellValue,
): Promise<boolean> {
  const fileManager = app.fileManager as unknown as FileManagerWithProcessFM;
  if (typeof fileManager.processFrontMatter !== "function") {
    return false;
  }
  const writer = createFrontmatterWriter(app);
  await writer.setField(file, key, value);
  return true;
}

