import {
  episodeOutcome,
  type Preservation,
} from "src/lib/settings/settingsEpisode";
import type { ReconcileDecision } from "src/lib/settings/settingsReconcile";

/**
 * #212 step C — the end of an episode, as a table.
 *
 * The branch this module replaces lived in eight places in `main.ts`, which has
 * no unit coverage in this tree at all, and it drifted three times in a day: a
 * notice naming an overwritten file, a tooltip contradicting its notice, a mark
 * still claiming "saved" after the notice said otherwise. Every row below is
 * one of those places, now checkable.
 */

type Settings = { version: number };

const NOT_NEEDED: Preservation = { kind: "not-needed" };
const PRESERVED: Preservation = {
  kind: "preserved",
  path: "vault/.config/plugins/pp/data.conflict-2026-09-08-ab12cd.json",
};
const UNPRESERVED: Preservation = { kind: "unpreserved" };

const IGNORE: ReconcileDecision<Settings> = {
  kind: "ignore",
  reason: "echo",
  resolves: true,
};
const ADOPT: ReconcileDecision<Settings> = {
  kind: "adopt",
  settings: { version: 4 },
  carried: true,
  resolves: true,
};
const CONFLICT: ReconcileDecision<Settings> = {
  kind: "conflict",
  reason: "pending",
  resolves: false,
};
const KEEP_UNPARSABLE: ReconcileDecision<Settings> = {
  kind: "keep",
  reason: "unparsable",
  resolves: false,
};
const KEEP_EMPTY: ReconcileDecision<Settings> = {
  kind: "keep",
  reason: "empty",
  resolves: false,
};

const ALL: ReconcileDecision<Settings>[] = [
  IGNORE,
  ADOPT,
  CONFLICT,
  KEEP_UNPARSABLE,
  KEEP_EMPTY,
];

describe("#212 — how an episode ends", () => {
  it("nothing to do: writing resumes and the user is told nothing", () => {
    expect(episodeOutcome(IGNORE, NOT_NEEDED)).toEqual({
      outcome: { kind: "release" },
      report: { code: null, params: {}, standing: false },
    });
  });

  it("the disk is taken whole, carrying the counter decision with it", () => {
    const episode = episodeOutcome(ADOPT, NOT_NEEDED);

    expect(episode.outcome).toEqual({
      kind: "adopted",
      settings: { version: 4 },
      carried: true,
    });
    expect(episode.report.code).toBeNull();
  });

  it("a file caught mid-write extends the episode and says nothing", () => {
    // The eleventh review pass, as a state instead of a call somebody has to
    // remember NOT to make: an empty or truncated file resolves nothing, and a
    // notice on the first half of somebody's write is a false alarm.
    for (const decision of [KEEP_UNPARSABLE, KEEP_EMPTY]) {
      const episode = episodeOutcome(decision, NOT_NEEDED);
      expect(episode.outcome.kind).toBe("extend");
      expect(episode.report.code).toBeNull();
    }
  });

  it("a conflict whose other version is safe restores, and names where it is", () => {
    const episode = episodeOutcome(CONFLICT, PRESERVED);

    expect(episode.outcome).toEqual({ kind: "restore", path: PRESERVED.path });
    expect(episode.report.code).toBe("PPP-105");
    expect(episode.report.params).toEqual({ path: PRESERVED.path });
    // Not standing: the restore writes, so once it lands nothing is outstanding
    // for a mark to report.
    expect(episode.report.standing).toBe(false);
  });

  it("a conflict whose other version could not be kept writes nothing at all", () => {
    const episode = episodeOutcome(CONFLICT, UNPRESERVED);

    expect(episode.outcome).toEqual({ kind: "hold" });
    expect(episode.report.code).toBe("PPP-106");
    expect(episode.report.standing).toBe(true);
  });

  it("a conflict with no preservation attempted is answered like a failed one", () => {
    // A caller that forgot is not given the benefit of the doubt: the only safe
    // response to "I do not know that the other version is safe" is not
    // writing. Guessing here would be the same class of defect as the eight
    // branches this module replaces.
    expect(episodeOutcome(CONFLICT, NOT_NEEDED).outcome).toEqual({
      kind: "hold",
    });
  });

  describe("the invariants, as properties over every row", () => {
    const rows: Array<[ReconcileDecision<Settings>, Preservation]> = [];
    for (const decision of ALL) {
      for (const preservation of [NOT_NEEDED, PRESERVED, UNPRESERVED]) {
        rows.push([decision, preservation]);
      }
    }

    it("I10 — a restore is reachable only from a preservation that succeeded", () => {
      // The rule the whole ticket exists for, as a row in a table rather than
      // as an ordering in an untested file.
      for (const [decision, preservation] of rows) {
        const { outcome } = episodeOutcome(decision, preservation);
        if (outcome.kind === "restore") {
          expect(preservation.kind).toBe("preserved");
        }
      }
    });

    it("I6 — a standing mark never carries a code the notice did not", () => {
      for (const [decision, preservation] of rows) {
        const { report } = episodeOutcome(decision, preservation);
        if (report.standing) expect(report.code).not.toBeNull();
      }
    });

    it("every row says something about writing, and nothing is undefined", () => {
      for (const [decision, preservation] of rows) {
        const episode = episodeOutcome(decision, preservation);
        expect(["release", "extend", "adopted", "restore", "hold"]).toContain(
          episode.outcome.kind
        );
        expect(episode.report.params).toBeDefined();
      }
    });

    it("only a conflict can end in a hold", () => {
      for (const [decision, preservation] of rows) {
        const { outcome } = episodeOutcome(decision, preservation);
        if (outcome.kind === "hold") expect(decision.kind).toBe("conflict");
      }
    });

    it("a decision that resolves the episode never extends it", () => {
      // `resolves` comes from the decision module and stays its property; this
      // asserts the two modules cannot contradict each other.
      for (const [decision, preservation] of rows) {
        const { outcome } = episodeOutcome(decision, preservation);
        if (decision.resolves) expect(outcome.kind).not.toBe("extend");
      }
    });
  });
});
