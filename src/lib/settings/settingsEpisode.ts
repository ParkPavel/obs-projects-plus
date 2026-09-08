/**
 * #212 step C — what an external-change episode ENDS with.
 *
 * `settingsReconcile.ts` decides what the file on disk means. This module
 * decides what the writer and the user are told about it, and it exists for one
 * reason: those two answers were produced by hand, in eight branches of a file
 * with no unit coverage, and they drifted apart three times in one day — a
 * notice naming a file that had been overwritten, a tooltip contradicting its
 * own notice, a standing mark still saying "saved" after the notice said
 * "could not be saved" (`RETRO_SETTINGS_OWNERSHIP_2026-09-08.md` §3.4).
 *
 * Here they are one value. The mark and the notice cannot disagree because
 * neither is written twice, and `restore` — the outcome that lets this session's
 * version become the file — is constructible only from a preservation that
 * succeeded, so "overwrite before the other version is safe" is not a state
 * this module can produce.
 *
 * Like its neighbours it imports no `obsidian` and no i18n: it names codes as
 * literals, the way `settingsWriter.ts` does, so the resolution stays in
 * `errorText.ts` and this file's tests stay free of four locale files.
 */

import type { ReconcileDecision } from "src/lib/settings/settingsReconcile";

/** #200 — memory was kept and the other version was written beside the file. */
const SETTINGS_CONFLICT = "PPP-105";
/** #200 — the other version could not be written anywhere. */
const SETTINGS_CONFLICT_UNCOPIED = "PPP-106";

/**
 * Whether the version this session refused was put somewhere durable, and
 * where. `not-needed` is the honest third case: most decisions have nothing to
 * preserve, and passing them a preservation result would invent one.
 */
export type Preservation =
  | { readonly kind: "not-needed" }
  | { readonly kind: "preserved"; readonly path: string }
  | { readonly kind: "unpreserved" };

/**
 * What the writer must do when the episode ends.
 *
 * `release` — nothing is owed; a queued edit goes back on its ordinary
 *   schedule.
 * `extend` — the file is mid-write and says nothing yet; keep the fence and
 *   look again. This is the eleventh review pass's finding as a state rather
 *   than as a call somebody must remember not to make.
 * `adopted` — the disk is taken whole; the queue is cleared by priming.
 * `restore` — this session's version becomes the file. Reachable only from a
 *   preservation that succeeded.
 * `hold` — nothing could be preserved, so nobody writes until the user acts.
 */
export type EpisodeOutcome<T> =
  | { readonly kind: "release" }
  | { readonly kind: "extend"; readonly reason: "unparsable" | "empty" }
  | {
      readonly kind: "adopted";
      readonly settings: T;
      readonly carried: boolean;
    }
  | { readonly kind: "restore"; readonly path: string }
  | { readonly kind: "hold" };

/**
 * What the user is told. `code` is one field, so the notice and the standing
 * mark are the same code by construction rather than by two call sites
 * agreeing — which is the defect this shape removes.
 */
export interface EpisodeReport {
  /** The code to raise a notice with, or `null` to say nothing. */
  readonly code: string | null;
  /** Interpolation for the notice; empty when the code takes none. */
  readonly params: Readonly<Record<string, string>>;
  /** Whether the standing mark keeps this code after the notice fades. */
  readonly standing: boolean;
}

export interface Episode<T> {
  readonly outcome: EpisodeOutcome<T>;
  readonly report: EpisodeReport;
}

const SILENT: EpisodeReport = { code: null, params: {}, standing: false };

/**
 * The end of one episode, as one value.
 *
 * `decision` comes from `reconcileSettings`; `preservation` says what happened
 * to the version this session refused. Every row is a test in
 * `__tests__/settingsEpisode.test.ts`, which is the point: the branch that used
 * to live in eight places in `main.ts` is now checkable on synthetic input,
 * where `main.ts` cannot be checked at all.
 */
export function episodeOutcome<T>(
  decision: ReconcileDecision<T>,
  preservation: Preservation
): Episode<T> {
  switch (decision.kind) {
    case "ignore":
      return { outcome: { kind: "release" }, report: SILENT };

    case "keep":
      // Silence is deliberate and is the whole content of this row: a file
      // caught between truncate and fill resolves nothing, and a notice on the
      // first half of somebody's write is a false alarm.
      return {
        outcome: { kind: "extend", reason: decision.reason },
        report: SILENT,
      };

    case "adopt":
      return {
        outcome: {
          kind: "adopted",
          settings: decision.settings,
          carried: decision.carried,
        },
        report: SILENT,
      };

    case "conflict":
      if (preservation.kind === "preserved") {
        return {
          outcome: { kind: "restore", path: preservation.path },
          // Not standing: the restore writes, and once it lands there is
          // nothing outstanding for a mark to report. The notice carries the
          // path, which is the part the user needs afterwards.
          report: {
            code: SETTINGS_CONFLICT,
            params: { path: preservation.path },
            standing: false,
          },
        };
      }
      // Both the unpreserved case and the caller that forgot to preserve at
      // all. They are answered identically on purpose: the only safe response
      // to "I do not know that the other version is safe" is not writing, and a
      // module that guessed here would be the same class of defect as the eight
      // branches this replaces.
      return {
        outcome: { kind: "hold" },
        report: {
          code: SETTINGS_CONFLICT_UNCOPIED,
          params: {},
          standing: true,
        },
      };
  }
}
