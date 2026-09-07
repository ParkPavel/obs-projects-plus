import { reconcileSettings } from "src/lib/settings/settingsReconcile";
import { canonical } from "src/lib/settings/settingsVerify";

/**
 * #200 step 2 — the decision table, on synthetic input.
 *
 * This is where the ticket's judgement is actually tested. `main.ts` cannot be
 * unit-tested in this tree (jsdom, and `src/__mocks__/obsidian.ts` exports no
 * `Plugin`), so if the branch lived in the hook it would be believed rather
 * than proven — and the whole ticket exists because a status that was believed
 * turned out to be false.
 *
 * Every row of the plan's table is here, plus the two the plan named as traps:
 * a corrupted file mid-session must NOT produce defaults, and a missing base
 * counts as a conflict rather than as permission to take the disk.
 */

type Settings = {
  version: number;
  projects: { id: string; name: string }[];
};

const MEMORY: Settings = {
  version: 4,
  projects: [{ id: "p1", name: "Mine" }],
};

const DISK: Settings = {
  version: 4,
  projects: [{ id: "p1", name: "Renamed elsewhere" }],
};

function decide(over: Partial<Parameters<typeof reconcileSettings<Settings>>[0]>) {
  return reconcileSettings<Settings>({
    diskRaw: JSON.stringify(DISK),
    memory: MEMORY,
    base: canonical(MEMORY),
    pending: false,
    expectedVersion: 4,
    ...over,
  });
}

describe("#200 — memory against disk", () => {
  it("adopts the disk when the writer has nothing to lose", () => {
    const decision = decide({});

    expect(decision.kind).toBe("adopt");
    if (decision.kind !== "adopt") return;
    // Whole, not merged: the value handed back is the file's, field for field.
    expect(decision.settings).toEqual(DISK);
  });

  it("keeps memory and conflicts when a change is still unsaved", () => {
    // The plan's dirty row. Adopting here would throw away work the user did
    // and can still see on screen.
    expect(decide({ pending: true })).toEqual({
      kind: "conflict",
      reason: "pending",
    });
  });

  it("treats an unknown base as a conflict", () => {
    // `confirmedOnDisk` is null after a diverged write and before the first
    // confirmed one. Without a base, an adoption and a silent loss look the
    // same from here, so the safe branch is the one that keeps both sides.
    expect(decide({ base: null })).toEqual({
      kind: "conflict",
      reason: "unknown-base",
    });
  });

  it("ignores the echo of a write we already confirmed", () => {
    // The step-0 spike showed our own `saveData` does not fire the hook, so
    // this is a net rather than a load-bearing part — but a host that
    // coalesces or re-fires must not cost a redraw.
    expect(
      decide({ diskRaw: JSON.stringify(DISK), base: canonical(DISK) })
    ).toEqual({ kind: "ignore", reason: "echo" });
  });

  it("ignores a file that differs from the base but says what memory says", () => {
    // Two windows converging on the same value: the file changed, and there is
    // nothing to adopt. Adoption here would redraw every view for no change,
    // and drop the modals holding a project reference with it.
    expect(
      decide({ diskRaw: JSON.stringify(MEMORY), base: canonical(DISK) })
    ).toEqual({ kind: "ignore", reason: "same" });
  });

  it("compares regardless of key order and formatting", () => {
    // The file's shape is the host's business — indentation, key order and the
    // trailing newline. A comparison that called those a difference would turn
    // every save into a conflict.
    const reordered = `{\n  "projects": [ { "name": "Mine", "id": "p1" } ],\n  "version": 4\n}\n`;

    expect(decide({ diskRaw: reordered, base: canonical(DISK) })).toEqual({
      kind: "ignore",
      reason: "same",
    });
  });

  it("does not fall back to defaults when the file is corrupted mid-session", () => {
    // The asymmetry the plan insisted be explicit. At load, an unreadable file
    // yields defaults; mid-session that would be data loss created by the
    // mechanism itself — the user's working state replaced because a
    // synchroniser was caught halfway through a write.
    const decision = decide({ diskRaw: '{ "version": 4, "projects": [' });

    expect(decision).toEqual({ kind: "keep", reason: "unparsable" });
  });

  it("refuses to adopt a settings version this build does not speak", () => {
    // Migration happens at load, against a file that is not also being edited.
    // Adopting a v3 payload into a v4 session would put a shape in memory that
    // no consumer expects; adopting a future version would be worse.
    for (const version of [3, 5]) {
      expect(
        decide({ diskRaw: JSON.stringify({ ...DISK, version }) })
      ).toEqual({ kind: "conflict", reason: "unknown-version" });
    }
  });

  it("refuses a payload that is not an object at all", () => {
    for (const raw of ["null", "[]", '"text"', "7"]) {
      expect(decide({ diskRaw: raw }).kind).toBe("conflict");
    }
  });

  it("never loses a side: every branch either keeps memory or hands back disk", () => {
    // The property behind the table, stated once. There is no branch that
    // discards both, and none that merges — the losing side is preserved by
    // the caller, which is what makes adoption safe rather than cheap.
    const rows = [
      decide({}),
      decide({ pending: true }),
      decide({ base: null }),
      decide({ diskRaw: "{" }),
      decide({ diskRaw: JSON.stringify({ ...DISK, version: 9 }) }),
    ];

    for (const decision of rows) {
      expect(["adopt", "conflict", "keep", "ignore"]).toContain(decision.kind);
      if (decision.kind === "adopt") expect(decision.settings).toEqual(DISK);
    }
  });
});
