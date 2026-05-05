/**
 * Canonical type contracts for the YAML frontmatter layer (v4.0 / Layer 0).
 *
 * NORMATIVE source of truth for the single supported pathway that mutates
 * note frontmatter. After REFACTOR-202..203, all `processFrontMatter`
 * calls outside `lib/frontmatter/` are forbidden.
 *
 * Per ARCHITECTURE_V4 §4 and PHASE_3_TICKETS REFACTOR-006:
 *   - Types ONLY. Zero runtime code. Zero side effects.
 *   - No circular imports.
 *
 * @since 4.0
 * @see docs/ARCHITECTURE_V4.md §4
 * @see docs/PHASE_3_TICKETS.md REFACTOR-006
 */

import type { TFile } from "obsidian";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";

export type { DataValue, Optional, TFile };

/**
 * Disposer returned by observe() to unsubscribe and release resources.
 */
export type Disposer = () => void;

/**
 * Read-side contract for note frontmatter.
 *
 * Implementations must:
 *   - Return a defensively-cloned plain object (callers may mutate).
 *   - Treat absent / malformed frontmatter as `{}` (never throw).
 *   - Debounce `observe` callbacks (coalesce rapid changes).
 */
export interface FrontmatterReader {
  /**
   * Read the current frontmatter as a plain object.
   * Resolves to `{}` for files with no frontmatter.
   */
  read(file: TFile): Promise<Record<string, unknown>>;

  /**
   * Subscribe to frontmatter changes for a single file.
   * Callback fires with the post-change snapshot.
   */
  observe(
    file: TFile,
    cb: (fm: Record<string, unknown>) => void
  ): Disposer;
}

/**
 * Options controlling a single write operation.
 */
export interface WriteOpts {
  /**
   * Retry attempts on transient failures (ENOENT race during file
   * rename, lock contention). Default `3` with exponential backoff.
   * Set to `0` to disable retries.
   */
  readonly retry?: number;

  /**
   * Preserve original key ordering when serializing back to YAML.
   * Default `true`.
   */
  readonly preserveOrder?: boolean;

  /**
   * Emit a (debounced) change notification after a successful write.
   * Default `true`. Set to `false` for batch operations that emit
   * a single trailing event themselves.
   */
  readonly emitChange?: boolean;
}

/**
 * Write-side contract for note frontmatter.
 *
 * All writes go through a type-preserving codec
 * (see ARCHITECTURE_V4 §4.3) and a retry envelope.
 */
export interface FrontmatterWriter {
  /**
   * Single-property update. Encodes `value` per the codec table for
   * the field's `DataFieldType` before writing. Passing `null` (or an
   * empty array) unsets the key, matching Notion's clear-last-tag
   * behaviour.
   */
  setField(
    file: TFile,
    key: string,
    value: Optional<DataValue>,
    opts?: WriteOpts
  ): Promise<void>;

  /**
   * Atomic multi-field update. Either all keys land or none.
   * Useful for moves that must keep two fields in lockstep
   * (e.g. dual-property relations).
   */
  setFields(
    file: TFile,
    patch: Readonly<Record<string, Optional<DataValue>>>,
    opts?: WriteOpts
  ): Promise<void>;

  /**
   * Remove a key from the frontmatter. No-op if the key is absent.
   */
  unsetField(file: TFile, key: string, opts?: WriteOpts): Promise<void>;
}
