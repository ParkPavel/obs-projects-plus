/**
 * Codex review of 08eda4e (three demo projects): a repair run on a later day
 * doubled the demo. Visit, tracker, expense, finance and payment notes were
 * named by their date, which is relative to today, so the next day every name
 * was new and writeFiles (which skips existing paths) wrote them all again.
 * A note's name is now its place in the seed, the same on every day.
 */

import type { Vault } from "obsidian";
import { seedDemoNotes } from "../demoProject";

function fakeVault() {
  const files = new Map<string, string>();
  const vault = {
    getAbstractFileByPath: (p: string) => (files.has(p) ? { path: p } : null),
    create: async (p: string, body: string) => { files.set(p, body); return { path: p }; },
    createFolder: async (p: string) => { files.set(p, ""); },
  };
  return { vault: vault as unknown as Vault, files };
}

afterEach(() => jest.useRealTimers());

test("a repair run on a later day writes nothing new", async () => {
  const { vault, files } = fakeVault();
  jest.useFakeTimers({ now: new Date("2026-09-26T12:00:00") });
  await seedDemoNotes(vault);
  const first = files.size;
  jest.setSystemTime(new Date("2026-09-27T12:00:00"));
  await seedDemoNotes(vault);
  expect(files.size).toBe(first);
});
