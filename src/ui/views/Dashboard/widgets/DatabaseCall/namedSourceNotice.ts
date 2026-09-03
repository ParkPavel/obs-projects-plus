/**
 * What a block SAYS about the source it was pointed at (#184).
 *
 * `resolveNamedSource` returns four cases precisely because three of them look
 * identical on screen — an empty table — while needing opposite reactions from
 * the user. That distinction is only real if it survives into the copy, and
 * copy written inline in markup is copy nobody can check.
 *
 * So the mapping lives here, as a pure function. `DatabaseCallBlock` cannot be
 * mounted in jest at all — importing it pulls `BoardView`, which pulls
 * `EditNoteModal`, which closes a require cycle back through `FieldControl`
 * and throws before any test runs. That is a real constraint of this tree and
 * not a preference, so the claim "three states say three different things" is
 * asserted where it can be executed rather than asserted about a file's text.
 */

import type { NamedSourceView } from "src/lib/datasources/namedSource";

export interface NamedSourceNotice {
  /** Its own screen (the block cannot show data), or a hint beneath the empty state. */
  readonly placement: "screen" | "hint";
  readonly icon: string;
  readonly key: string;
  readonly fallback: string;
  /** Interpolation values for `key`. */
  readonly vars: Record<string, string>;
  /** Free text under the title — the resolver's own reason, already specific. */
  readonly hint?: string;
}

/**
 * The notice for a resolution, or `null` when there is nothing to say.
 *
 * `ok` is null because a block showing its records should not also explain
 * itself. `empty` is a hint rather than a screen: it is a real answer, and
 * giving it a full screen of its own would read as a failure.
 */
export function namedSourceNotice(view: NamedSourceView): NamedSourceNotice | null {
  switch (view.kind) {
    case "pending":
      // Distinct from the linked-project "Loading…" on purpose: same picture,
      // different cause, and identical copy would hide which one is happening.
      return {
        placement: "screen",
        icon: "loader",
        key: "views.dashboard.database-call.source-resolving",
        fallback: "Preparing this block's source…",
        vars: {},
      };
    case "broken":
      // Configuration the user can fix. "No records" would send them to look
      // at their data, which is the wrong place entirely.
      return {
        placement: "screen",
        icon: "unlink",
        key: "views.dashboard.database-call.named-source-broken",
        fallback: "The source this block points at is gone",
        vars: { source: view.label },
        hint: view.reason,
      };
    case "empty":
      return {
        placement: "hint",
        icon: "",
        key: "views.dashboard.database-call.named-source-empty",
        fallback: 'Nothing in "{{source}}" right now',
        vars: { source: view.label },
      };
    case "ok":
      return null;
  }
}
