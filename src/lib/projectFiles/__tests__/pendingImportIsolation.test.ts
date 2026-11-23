import { TextEncoder } from "node:util";
import {
  refreshPendingImportIsolation,
  isPendingImportPath,
  pendingImportRevision,
  samePendingImport,
} from "../pendingImportIsolation";

/**
 * Pending-import quarantine: only the descriptor's own paths are
 * blocked, an invalid descriptor blocks everything, and the revision moves
 * only when the semantic descriptor changes.
 */

const savedEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: TextEncoder }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: savedEncoder }));

const configDir = "AppConfig";
const root = "Copies";
const hash = "a".repeat(64);

test("recovery identity ignores operational key and path ordering but refuses extra metadata", () => {
  const expected = { format: "obs-projects-plus/pending-import" as const, schemaVersion: 1 as const, id: "attempt", archiveHash: hash,
    journal: `Copies/Incoming/${hash}/Installations/attempt.json`, paths: ["Imported/a.md", "Imported/b.md"] };
  const reordered = { paths: ["imported/B.md", "Imported/a.md"], journal: expected.journal, archiveHash: hash, id: "attempt", schemaVersion: 1 as const, format: expected.format };
  expect(samePendingImport(reordered, expected)).toBe(true);
  expect(samePendingImport({ ...reordered, future: true } as typeof reordered, expected)).toBe(false);
  expect(samePendingImport({ ...reordered, paths: ["Imported/a.md", "Imported/A.md"] }, expected)).toBe(false);
});

test("native inspection permits only its nonce-scoped Incoming Markdown paths, with the same live quarantine", () => {
  const id = "b".repeat(64), path = `Copies/Incoming/${hash}/Note inspection/${id}/${"c".repeat(64)}.md`;
  const pending = { format: "obs-projects-plus/pending-import", schemaVersion: 1, phase: "note-inspection", id, archiveHash: hash, journal: `Copies/Incoming/${hash}/Installations/${id}.json`, paths: [path] };
  try {
    expect(refreshPendingImportIsolation(preferences(pending), configDir)).toBe("pending"); expect(isPendingImportPath(path)).toBe(true);
    expect(refreshPendingImportIsolation(preferences({ ...pending, paths: ["Copies/Incoming/foreign.md"] }), configDir)).toBe("invalid");
    expect(refreshPendingImportIsolation(preferences({ ...pending, phase: "future" }), configDir)).toBe("invalid");
  } finally { refreshPendingImportIsolation(undefined, configDir); }
});

type Preferences = Parameters<typeof refreshPendingImportIsolation>[0];
type Raw = Record<string, unknown>;

function preferences(pendingImport?: unknown): Preferences {
  return { root, autoSync: false, ...(pendingImport === undefined ? {} : { pendingImport }) } as unknown as Preferences;
}

function descriptor(paths: unknown, overrides: Raw = {}): Raw {
  return {
    format: "obs-projects-plus/pending-import",
    schemaVersion: 1,
    id: "attempt-1",
    archiveHash: hash,
    journal: `${root}/Incoming/${hash}/Installations/attempt-1.json`,
    paths,
    ...overrides,
  };
}

const probes: Array<() => void> = [];

function probe() {
  const seen: number[] = [];
  const unsubscribe = pendingImportRevision.subscribe(value => seen.push(value));
  probes.push(unsubscribe);
  return { seen, unsubscribe };
}

afterEach(() => {
  for (const unsubscribe of probes.splice(0)) unsubscribe();
  refreshPendingImportIsolation(undefined, configDir);
});

describe("pending import isolation", () => {
  it("quarantines exactly the pending paths, ignores neighbours, and clears", () => {
    expect(refreshPendingImportIsolation(preferences(), configDir)).toBe("clear");
    expect(isPendingImportPath("Imported/Task.md")).toBe(false);

    expect(refreshPendingImportIsolation(
      preferences(descriptor(["Imported/Task.md", "Imported/Other.md"])),
      configDir
    )).toBe("pending");
    expect(isPendingImportPath("Imported/Task.md")).toBe(true);
    expect(isPendingImportPath("Imported/Other.md")).toBe(true);
    expect(isPendingImportPath("Imported/Unrelated.md")).toBe(false);
    expect(isPendingImportPath("Elsewhere/Task.md")).toBe(false);

    expect(refreshPendingImportIsolation(preferences(), configDir)).toBe("clear");
    expect(isPendingImportPath("Imported/Task.md")).toBe(false);
  });

  it("captures the paths so later caller edits cannot change the quarantine", () => {
    const files = ["Imported/Task.md"];
    expect(refreshPendingImportIsolation(preferences(descriptor(files)), configDir)).toBe("pending");

    files.push("Imported/Later.md");
    files[0] = "Imported/Changed.md";

    expect(isPendingImportPath("Imported/Task.md")).toBe(true);
    expect(isPendingImportPath("Imported/Later.md")).toBe(false);
    expect(isPendingImportPath("Imported/Changed.md")).toBe(false);
  });

  it("matches NFC and case-folded spellings but refuses duplicate aliases", () => {
    const nfc = "Imported/Café.md";
    const nfd = "Imported/Cafe\u0301.md";
    expect(nfc).not.toBe(nfd);

    expect(refreshPendingImportIsolation(preferences(descriptor([nfc])), configDir)).toBe("pending");
    expect(isPendingImportPath(nfd)).toBe(true);
    expect(isPendingImportPath("imported/café.MD")).toBe(true);

    expect(refreshPendingImportIsolation(preferences(descriptor([nfc, nfd])), configDir)).toBe("invalid");
    expect(isPendingImportPath("Imported/Task.md")).toBe(true);
    expect(isPendingImportPath("Anything/At/All.md")).toBe(true);
  });

  it("bumps the revision for changed metadata but not for an equivalent descriptor", () => {
    const p = probe();
    const start = p.seen.length;

    refreshPendingImportIsolation(preferences(descriptor(["Imported/A.md", "Imported/B.md"])), configDir);
    expect(p.seen.length).toBe(start + 1);

    refreshPendingImportIsolation(preferences(descriptor(["Imported/B.md", "Imported/A.md"])), configDir);
    expect(p.seen.length).toBe(start + 1);

    refreshPendingImportIsolation(preferences(descriptor(["Imported/A.md", "Imported/B.md"], {
      id: "attempt-2",
      journal: `${root}/Incoming/${hash}/Installations/attempt-2.json`,
    })), configDir);
    expect(p.seen.length).toBe(start + 2);
  });

  it("rejects malformed, future, reserved and config paths and stays blocked until corrected", () => {
    const invalid: Raw[] = [
      descriptor([]),
      descriptor(["Imported/Task.md"], { schemaVersion: 2 }),
      descriptor(["Imported/Task.md"], { format: "obs-projects-plus/other" }),
      descriptor(["Imported/Task.md"], { archiveHash: "A".repeat(64) }),
      descriptor(["Imported/Task.md"], { journal: `${root}/Incoming/b/Installations/attempt-1.json` }),
      descriptor(["Copies/Incoming/attempt-1.json"]),
      descriptor(["AppConfig/plugins/notes.md"]),
    ];

    for (const value of invalid) {
      expect(refreshPendingImportIsolation(preferences(value), configDir)).toBe("invalid");
      expect(isPendingImportPath("Imported/Task.md")).toBe(true);
      expect(isPendingImportPath("Anything/At/All.md")).toBe(true);
    }

    expect(refreshPendingImportIsolation(preferences(descriptor(["Imported/Task.md"])), configDir)).toBe("pending");
    expect(isPendingImportPath("Imported/Other.md")).toBe(false);
    expect(isPendingImportPath("Imported/Task.md")).toBe(true);

    expect(refreshPendingImportIsolation(preferences(), configDir)).toBe("clear");
    expect(isPendingImportPath("Imported/Task.md")).toBe(false);
  });
});
