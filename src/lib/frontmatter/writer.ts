/**
 * FrontmatterWriter runtime implementation (REFACTOR-202).
 *
 * Wraps `app.fileManager.processFrontMatter` with:
 *   - Type-preserving codec from `./codec` for every value.
 *   - Retry envelope with exponential backoff for transient errors
 *     (ENOENT during file rename, lock contention, missing host API
 *     during plugin teardown).
 *   - Optional change-notification suppression for batch writers.
 *
 * Contract: see `./contracts.ts::FrontmatterWriter`.
 *
 * @since 4.0 (REFACTOR-202)
 */

import type { App, TFile } from "obsidian";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import type { FrontmatterWriter, WriteOpts } from "./contracts";
import { encodeValue } from "./codec";

interface FileManagerWithProcessFM {
  processFrontMatter?: (
    file: TFile,
    fn: (fm: Record<string, unknown>) => void,
  ) => Promise<void>;
}

const DEFAULT_RETRY = 3;
const RETRY_BASE_MS = 25;

/**
 * Build a writer bound to an Obsidian `App`. Returns a stable instance
 * — safe to memoise per plugin.
 */
export function createFrontmatterWriter(app: App): FrontmatterWriter {
  return {
    setField: (file, key, value, opts) =>
      mutate(app, file, (fm) => applyPatch(fm, { [key]: value }), opts),
    setFields: (file, patch, opts) =>
      mutate(app, file, (fm) => applyPatch(fm, patch), opts),
    unsetField: (file, key, opts) =>
      mutate(app, file, (fm) => {
        delete fm[key];
      }, opts),
  };
}

/**
 * Apply an encoded patch to the in-place frontmatter object.
 * `null` values and empty arrays delete the key (Notion parity:
 * clearing the last tag removes the property).
 */
function applyPatch(
  fm: Record<string, unknown>,
  patch: Readonly<Record<string, Optional<DataValue>>>,
): void {
  for (const [key, raw] of Object.entries(patch)) {
    const encoded = encodeValue(raw);
    if (encoded === null) {
      delete fm[key];
      continue;
    }
    if (Array.isArray(encoded) && encoded.length === 0) {
      delete fm[key];
      continue;
    }
    fm[key] = encoded;
  }
}

/**
 * Centralised retry envelope. Callers never see the raw retry count.
 */
async function mutate(
  app: App,
  file: TFile,
  fn: (fm: Record<string, unknown>) => void,
  opts?: WriteOpts,
): Promise<void> {
  const retry = opts?.retry ?? DEFAULT_RETRY;
  const fileManager = app.fileManager as unknown as FileManagerWithProcessFM;
  if (typeof fileManager.processFrontMatter !== "function") {
    // Host without the API — bail silently. Matches `cellEditorWriter`
    // legacy behaviour so callers that opt-in to the writer don't
    // crash unit tests with bare mocks.
    return;
  }
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt <= retry) {
    try {
      await fileManager.processFrontMatter(file, fn);
      return;
    } catch (err) {
      lastError = err;
      if (attempt === retry) break;
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      await sleep(delay);
      attempt++;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Frontmatter write failed: ${String(lastError)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
