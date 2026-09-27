/**
 * 3.6.1 — when the demo folder cannot be created nothing is written, and the
 * generator has already said so (PPP-601). The shared entry must then report
 * failure: the first-run window stays open for a second try, and no notice
 * claims the demo exists and was repaired.
 */

import { createDemoWithNotices } from "../demoRun";

const mockMessages: string[] = [];
jest.mock("obsidian", () => {
  const actual = jest.requireActual("src/__mocks__/obsidian");
  class RecordingNotice extends actual.Notice {
    constructor(message: string, duration?: number) {
      super(message, duration);
      mockMessages.push(String(message));
    }
  }
  return { ...actual, Notice: RecordingNotice };
});

describe("createDemoWithNotices — the demo folder cannot be created", () => {
  it("returns null, opens nothing and does not claim a repair", async () => {
    const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const vault = {
      getAbstractFileByPath: () => null,
      createFolder: () => Promise.reject(new Error("EACCES")),
      create: jest.fn(),
    } as never;
    const open = jest.fn();

    const result = await createDemoWithNotices(vault, open);

    errors.mockRestore();
    expect(result).toBeNull();
    expect(open).not.toHaveBeenCalled();
    expect(mockMessages.some((m) => m.includes("PPP-601"))).toBe(true);
    expect(mockMessages.some((m) => /repaired|restored|восстановлен/i.test(m))).toBe(false);
  });
});
