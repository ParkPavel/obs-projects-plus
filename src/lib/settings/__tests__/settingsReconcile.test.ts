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

function decide(
  over: Partial<Parameters<typeof reconcileSettings<Settings>>[0]>
) {
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
      resolves: false,
    });
  });

  it("treats an unknown base as a conflict", () => {
    // `confirmedOnDisk` is null after a diverged write and before the first
    // confirmed one. Without a base, an adoption and a silent loss look the
    // same from here, so the safe branch is the one that keeps both sides.
    expect(decide({ base: null })).toEqual({
      kind: "conflict",
      reason: "unknown-base",
      resolves: false,
    });
  });

  it("ignores the echo of a write we already confirmed", () => {
    // The step-0 spike showed our own `saveData` does not fire the hook, so
    // this is a net rather than a load-bearing part — but a host that
    // coalesces or re-fires must not cost a redraw.
    expect(
      decide({ diskRaw: JSON.stringify(DISK), base: canonical(DISK) })
    ).toEqual({ kind: "ignore", reason: "echo", resolves: true });
  });

  it("ignores a file that differs from the base but says what memory says", () => {
    // Two windows converging on the same value: the file changed, and there is
    // nothing to adopt. Adoption here would redraw every view for no change,
    // and drop the modals holding a project reference with it.
    expect(
      decide({ diskRaw: JSON.stringify(MEMORY), base: canonical(DISK) })
    ).toEqual({ kind: "ignore", reason: "same", resolves: true });
  });

  it("compares regardless of key order and formatting", () => {
    // The file's shape is the host's business — indentation, key order and the
    // trailing newline. A comparison that called those a difference would turn
    // every save into a conflict.
    const reordered = `{\n  "projects": [ { "name": "Mine", "id": "p1" } ],\n  "version": 4\n}\n`;

    expect(decide({ diskRaw: reordered, base: canonical(DISK) })).toEqual({
      kind: "ignore",
      reason: "same",
      resolves: true,
    });
  });

  it("does not fall back to defaults when the file is corrupted mid-session", () => {
    // The asymmetry the plan insisted be explicit. At load, an unreadable file
    // yields defaults; mid-session that would be data loss created by the
    // mechanism itself — the user's working state replaced because a
    // synchroniser was caught halfway through a write.
    const decision = decide({ diskRaw: '{ "version": 4, "projects": [' });

    expect(decision).toEqual({
      kind: "keep",
      reason: "unparsable",
      resolves: false,
    });
  });

  it("calls an empty file nobody's version, not somebody's", () => {
    // #210, found on the acceptance re-run. A writer that is not atomic
    // truncates data.json before filling it, so the file is zero bytes for an
    // instant and the hook can catch exactly that instant. The old answer —
    // "unparsable, keep and preserve" — produced a 0-BYTE conflict copy and a
    // notice sending the user to read it.
    for (const raw of ["", "   ", "\n\t "]) {
      expect(decide({ diskRaw: raw })).toEqual({
        kind: "keep",
        reason: "empty",
        resolves: false,
      });
    }
  });

  it("still calls mangled bytes somebody's version", () => {
    // The other side of the same line: those bytes are a version, damaged, and
    // losing them silently is what the delayed re-read exists to prevent.
    expect(decide({ diskRaw: '{ "version": 4, "projects": [' })).toEqual({
      kind: "keep",
      reason: "unparsable",
      resolves: false,
    });
  });

  it("refuses to adopt a settings version this build does not speak", () => {
    // Migration happens at load, against a file that is not also being edited.
    // Adopting a v3 payload into a v4 session would put a shape in memory that
    // no consumer expects; adopting a future version would be worse.
    for (const version of [3, 5]) {
      expect(decide({ diskRaw: JSON.stringify({ ...DISK, version }) })).toEqual(
        { kind: "conflict", reason: "unknown-version", resolves: false }
      );
    }
  });

  it("refuses a payload that carries the version and nothing else", () => {
    // Found by the adversarial review of this change. `{ "version": 4 }` passes
    // a version check, and the resolver would then fill it in with an EMPTY
    // project list — so a stub left by a synchroniser would read as a
    // legitimate adoption and quietly empty the user's configuration.
    expect(decide({ diskRaw: '{ "version": 4 }' })).toEqual({
      kind: "conflict",
      reason: "unknown-version",
      resolves: false,
    });
    expect(decide({ diskRaw: '{ "version": 4, "projects": {} }' })).toEqual({
      kind: "conflict",
      reason: "unknown-version",
      resolves: false,
    });
  });

  it("still adopts a vault whose projects were all deleted", () => {
    // The other half of the same rule: an empty list is a real state a user can
    // reach, and refusing it would make the mechanism silently useless for
    // exactly the person who just deleted their last project elsewhere.
    const decision = decide({
      diskRaw: '{ "version": 4, "projects": [] }',
    });

    expect(decision.kind).toBe("adopt");
  });

  it("refuses a payload that is not an object at all", () => {
    for (const raw of ["null", "[]", '"text"', "7"]) {
      expect(decide({ diskRaw: raw }).kind).toBe("conflict");
    }
  });

  describe("which decisions end the episode", () => {
    // #211, eleventh review pass. Whether a suspended local edit may go to disk
    // again is a property of the decision, not something the hook remembers per
    // branch — remembering is what let an empty file release an edit that then
    // raced the payload a synchroniser was still writing.
    it("a file caught mid-write resolves nothing", () => {
      expect(decide({ diskRaw: "" }).resolves).toBe(false);
      expect(
        decide({ diskRaw: '{ "version": 4, "projects": [' }).resolves
      ).toBe(false);
    });

    it("a conflict waits for the caller, which knows whether it preserved anything", () => {
      expect(decide({ pending: true }).resolves).toBe(false);
      expect(decide({ base: null }).resolves).toBe(false);
      expect(
        decide({ diskRaw: JSON.stringify({ ...DISK, version: 3 }) }).resolves
      ).toBe(false);
    });

    it("nothing to do, and taking the disk whole, both end it", () => {
      expect(decide({}).resolves).toBe(true);
      expect(
        decide({ diskRaw: JSON.stringify(DISK), base: canonical(DISK) })
          .resolves
      ).toBe(true);
    });
  });

  describe("the one field that is merged, by the user's decision", () => {
    // `uniqueIdCounter` is monotonic and feeds `UniqueId` values written into
    // NOTES. Adopting a lower one makes the plugin reissue identifiers that
    // already exist in the vault — and unlike a settings conflict there is no
    // copy to recover from, because the duplicates are spread across notes.
    const withCounter = (counter: number | undefined, name: string) => ({
      version: 4,
      projects: [{ id: "p1", name, uniqueIdCounter: counter }],
    });

    it("carries the higher counter forward and says that it did", () => {
      const decision = reconcileSettings({
        diskRaw: JSON.stringify(withCounter(3, "Theirs")),
        memory: withCounter(11, "Mine"),
        base: canonical(withCounter(11, "Mine")),
        pending: false,
        expectedVersion: 4,
      });

      expect(decision.kind).toBe("adopt");
      if (decision.kind !== "adopt") return;
      // Everything else is still the disk's, field for field. Only the counter
      // moved, and only upwards.
      expect(decision.settings).toEqual(withCounter(11, "Theirs"));
      expect(decision.carried).toBe(true);
    });

    it("leaves a disk counter that is already higher alone", () => {
      const decision = reconcileSettings({
        diskRaw: JSON.stringify(withCounter(40, "Theirs")),
        memory: withCounter(11, "Mine"),
        base: canonical(withCounter(11, "Mine")),
        pending: false,
        expectedVersion: 4,
      });

      expect(decision.kind).toBe("adopt");
      if (decision.kind !== "adopt") return;
      expect(decision.settings).toEqual(withCounter(40, "Theirs"));
      // Nothing moved, so the caller owes the disk no write.
      expect(decision.carried).toBe(false);
    });

    it("matches projects by id, never by position", () => {
      const decision = reconcileSettings({
        diskRaw: JSON.stringify({
          version: 4,
          projects: [
            { id: "b", uniqueIdCounter: 1 },
            { id: "a", uniqueIdCounter: 1 },
          ],
        }),
        memory: {
          version: 4,
          projects: [
            { id: "a", uniqueIdCounter: 9 },
            { id: "b", uniqueIdCounter: 2 },
          ],
        },
        base: "{}",
        pending: false,
        expectedVersion: 4,
      });

      expect(decision.kind).toBe("adopt");
      if (decision.kind !== "adopt") return;
      expect(decision.settings).toEqual({
        version: 4,
        projects: [
          { id: "b", uniqueIdCounter: 2 },
          { id: "a", uniqueIdCounter: 9 },
        ],
      });
    });

    it("covers archived projects too: an archive can be restored", () => {
      const decision = reconcileSettings({
        diskRaw: JSON.stringify({
          version: 4,
          projects: [],
          archives: [{ id: "old", uniqueIdCounter: 2 }],
        }),
        memory: {
          version: 4,
          projects: [],
          archives: [{ id: "old", uniqueIdCounter: 30 }],
        },
        base: "{}",
        pending: false,
        expectedVersion: 4,
      });

      expect(decision.kind).toBe("adopt");
      if (decision.kind !== "adopt") return;
      expect(decision.settings).toEqual({
        version: 4,
        projects: [],
        archives: [{ id: "old", uniqueIdCounter: 30 }],
      });
    });

    it("adds no counter to a project that never had one", () => {
      // The field is optional and `undefined` means "treat as 0 on first
      // read". Writing a 0 into every project would change the stored shape
      // for a reason no user asked for.
      const decision = reconcileSettings({
        diskRaw: JSON.stringify({
          version: 4,
          projects: [{ id: "p1", name: "Theirs" }],
        }),
        memory: { version: 4, projects: [{ id: "p1", name: "Mine" }] },
        base: "{}",
        pending: false,
        expectedVersion: 4,
      });

      expect(decision.kind).toBe("adopt");
      if (decision.kind !== "adopt") return;
      expect(decision.settings).toEqual({
        version: 4,
        projects: [{ id: "p1", name: "Theirs" }],
      });
      expect(decision.carried).toBe(false);
    });

    it("does not touch anything else, however different the two sides are", () => {
      // The exception is one field wide. If it ever grows, this fails.
      const decision = reconcileSettings({
        diskRaw: JSON.stringify({
          version: 4,
          projects: [{ id: "p1", isDefault: true, uniqueIdCounter: 1 }],
          preferences: { commands: [] },
        }),
        memory: {
          version: 4,
          projects: [{ id: "p1", isDefault: false, uniqueIdCounter: 5 }],
          preferences: { commands: ["stale"] },
        },
        base: "{}",
        pending: false,
        expectedVersion: 4,
      });

      expect(decision.kind).toBe("adopt");
      if (decision.kind !== "adopt") return;
      expect(decision.settings).toEqual({
        version: 4,
        projects: [{ id: "p1", isDefault: true, uniqueIdCounter: 5 }],
        preferences: { commands: [] },
      });
    });
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
