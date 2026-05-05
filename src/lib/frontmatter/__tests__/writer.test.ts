/**
 * REFACTOR-202 — FrontmatterWriter / Reader / codec coverage.
 *
 * Pins:
 *  - Codec round-trip for every `DataValue` shape.
 *  - Writer encodes through the codec and unsets keys for null/[].
 *  - Writer retry envelope recovers from transient failures.
 *  - Writer surfaces the last error after exhausting retries.
 *  - Reader decodes ISO date strings back into `Date`.
 *  - Reader observe() debounces rapid metadata-cache changes.
 */

import type { App, TFile } from "obsidian";
import { encodeValue, decodeValue } from "../codec";
import { createFrontmatterWriter } from "../writer";
import { createFrontmatterReader } from "../reader";

// ── codec ──────────────────────────────────────────────────
describe("frontmatter/codec — round-trip", () => {
  test("string", () => {
    expect(decodeValue(encodeValue("hello"))).toBe("hello");
  });
  test("number", () => {
    expect(decodeValue(encodeValue(42))).toBe(42);
  });
  test("boolean", () => {
    expect(decodeValue(encodeValue(true))).toBe(true);
    expect(decodeValue(encodeValue(false))).toBe(false);
  });
  test("Date midnight → YYYY-MM-DD → Date", () => {
    const d = new Date(2026, 4, 15);
    const enc = encodeValue(d);
    expect(enc).toBe("2026-05-15");
    const dec = decodeValue(enc);
    expect(dec).toBeInstanceOf(Date);
    expect((dec as Date).getFullYear()).toBe(2026);
    expect((dec as Date).getMonth()).toBe(4);
    expect((dec as Date).getDate()).toBe(15);
  });
  test("Date with time → ISO datetime → Date", () => {
    const d = new Date(Date.UTC(2026, 4, 15, 9, 30));
    const enc = encodeValue(d);
    expect(typeof enc).toBe("string");
    expect((enc as string).startsWith("2026-05-15T")).toBe(true);
    const dec = decodeValue(enc);
    expect(dec).toBeInstanceOf(Date);
    expect((dec as Date).getTime()).toBe(d.getTime());
  });
  test("array of strings", () => {
    expect(decodeValue(encodeValue(["a", "b"]))).toEqual(["a", "b"]);
  });
  test("array of mixed", () => {
    const out = decodeValue(encodeValue([1, "x", true]));
    expect(out).toEqual([1, "x", true]);
  });
  test("null encodes to null", () => {
    expect(encodeValue(null)).toBeNull();
  });
  test("undefined encodes to null", () => {
    expect(encodeValue(undefined)).toBeNull();
  });
  test("decode plain ISO date string yields Date", () => {
    const dec = decodeValue("2026-01-31");
    expect(dec).toBeInstanceOf(Date);
  });
  test("decode arbitrary string is identity", () => {
    expect(decodeValue("hello world")).toBe("hello world");
  });
});

// ── writer ─────────────────────────────────────────────────
function makeMockApp(opts: {
  failures?: number;
  recordCalls?: Array<Record<string, unknown>>;
  hostMissing?: boolean;
} = {}): App {
  let failuresLeft = opts.failures ?? 0;
  const fileManager = opts.hostMissing
    ? {}
    : {
        processFrontMatter: jest.fn(
          async (
            _file: TFile,
            fn: (fm: Record<string, unknown>) => void,
          ): Promise<void> => {
            if (failuresLeft > 0) {
              failuresLeft--;
              throw new Error("ENOENT (simulated race)");
            }
            const fm: Record<string, unknown> = {};
            fn(fm);
            opts.recordCalls?.push({ ...fm });
          },
        ),
      };
  return { fileManager } as unknown as App;
}

const FILE = { path: "x.md" } as TFile;

describe("frontmatter/writer", () => {
  test("setField encodes the value before writing", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const w = createFrontmatterWriter(makeMockApp({ recordCalls: calls }));
    await w.setField(FILE, "due", new Date(2026, 4, 15));
    expect(calls[0]).toEqual({ due: "2026-05-15" });
  });

  test("setFields applies an atomic patch", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const w = createFrontmatterWriter(makeMockApp({ recordCalls: calls }));
    await w.setFields(FILE, { a: 1, b: "two", c: true });
    expect(calls[0]).toEqual({ a: 1, b: "two", c: true });
  });

  test("setField with null deletes the key", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const w = createFrontmatterWriter(makeMockApp({ recordCalls: calls }));
    await w.setField(FILE, "tag", null);
    expect(calls[0]).toEqual({});
  });

  test("setField with empty array deletes the key", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const w = createFrontmatterWriter(makeMockApp({ recordCalls: calls }));
    await w.setField(FILE, "tags", []);
    expect(calls[0]).toEqual({});
  });

  test("retry envelope succeeds after transient failures", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const w = createFrontmatterWriter(
      makeMockApp({ failures: 2, recordCalls: calls }),
    );
    await w.setField(FILE, "x", 1, { retry: 3 });
    expect(calls[0]).toEqual({ x: 1 });
  });

  test("retry envelope surfaces the last error after exhaustion", async () => {
    const w = createFrontmatterWriter(makeMockApp({ failures: 5 }));
    await expect(w.setField(FILE, "x", 1, { retry: 1 })).rejects.toThrow(
      /ENOENT/,
    );
  });

  test("retry=0 means a single attempt", async () => {
    const w = createFrontmatterWriter(makeMockApp({ failures: 1 }));
    await expect(w.setField(FILE, "x", 1, { retry: 0 })).rejects.toThrow();
  });

  test("missing host API is a silent no-op", async () => {
    const w = createFrontmatterWriter(makeMockApp({ hostMissing: true }));
    await expect(w.setField(FILE, "x", 1)).resolves.toBeUndefined();
  });

  test("unsetField removes the key", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const w = createFrontmatterWriter(makeMockApp({ recordCalls: calls }));
    await w.unsetField(FILE, "x");
    expect(calls[0]).toEqual({});
  });
});

// ── reader ─────────────────────────────────────────────────
describe("frontmatter/reader", () => {
  test("read returns {} when the file has no frontmatter cache", async () => {
    const app = {
      metadataCache: { getFileCache: () => null },
    } as unknown as App;
    const r = createFrontmatterReader(app);
    expect(await r.read(FILE)).toEqual({});
  });

  test("read decodes ISO date strings back into Date", async () => {
    const app = {
      metadataCache: {
        getFileCache: () => ({ frontmatter: { due: "2026-05-15" } }),
      },
    } as unknown as App;
    const r = createFrontmatterReader(app);
    const out = await r.read(FILE);
    expect(out["due"]).toBeInstanceOf(Date);
  });

  test("read strips Obsidian-internal `position` marker", async () => {
    const app = {
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { x: 1, position: { start: 0 } },
        }),
      },
    } as unknown as App;
    const r = createFrontmatterReader(app);
    const out = await r.read(FILE);
    expect(out["x"]).toBe(1);
    expect("position" in out).toBe(false);
  });

  test("observe debounces rapid changes into a single callback", async () => {
    let listener: ((file: TFile) => void) | null = null;
    const app = {
      metadataCache: {
        getFileCache: () => ({ frontmatter: { x: 1 } }),
        on: (_evt: string, cb: (file: TFile) => void) => {
          listener = cb;
          return { id: 1 } as never;
        },
        offref: jest.fn(),
      },
    } as unknown as App;
    const r = createFrontmatterReader(app);
    const cb = jest.fn();
    const dispose = r.observe(FILE, cb);
    listener!(FILE);
    listener!(FILE);
    listener!(FILE);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cb).toHaveBeenCalledTimes(1);
    dispose();
  });

  test("observe ignores changes for unrelated files", async () => {
    let listener: ((file: TFile) => void) | null = null;
    const app = {
      metadataCache: {
        getFileCache: () => ({ frontmatter: {} }),
        on: (_evt: string, cb: (file: TFile) => void) => {
          listener = cb;
          return { id: 1 } as never;
        },
        offref: jest.fn(),
      },
    } as unknown as App;
    const r = createFrontmatterReader(app);
    const cb = jest.fn();
    r.observe(FILE, cb);
    listener!({ path: "other.md" } as TFile);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cb).not.toHaveBeenCalled();
  });

  test("dispose unregisters the listener and cancels pending debounce", async () => {
    let listener: ((file: TFile) => void) | null = null;
    const offref = jest.fn();
    const app = {
      metadataCache: {
        getFileCache: () => ({ frontmatter: {} }),
        on: (_evt: string, cb: (file: TFile) => void) => {
          listener = cb;
          return { id: 1 } as never;
        },
        offref,
      },
    } as unknown as App;
    const r = createFrontmatterReader(app);
    const cb = jest.fn();
    const dispose = r.observe(FILE, cb);
    listener!(FILE);
    dispose();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cb).not.toHaveBeenCalled();
    expect(offref).toHaveBeenCalled();
  });
});
