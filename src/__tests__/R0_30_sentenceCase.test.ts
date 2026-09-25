/**
 * R0.30 — English UI text is in sentence case.
 *
 * Obsidian's plugin guidelines ask for sentence case in UI text ("Template
 * folder location", not "Template Folder Location"), and a catalogue reviewer
 * reads the English bundle first. en.json carried 65 Title Case labels —
 * «Visit Website», «Animation Behavior», «Chart Type», «Save Changes».
 *
 * A label is Title Case here when every word after the first starts with a
 * capital, ignoring acronyms (HEX, DQL, X, Y), placeholders and the proper
 * nouns below; names of people and of the plugin are listed by key.
 */

import * as fs from "fs";
import * as path from "path";

const PROPER = new Set(["Projects", "Plus", "Obsidian", "Dataview", "Markdown", "GitHub", "Telegram", "Notion", "Excel", "Airtable", "Unsplash", "iOS", "Android", "Kanban", "Gantt"]);
/** Keys whose value is a name, not a label. */
const NAMES = new Set(["settings.about.author-name", "settings.about.original-author-name", "obsidian.hover-link-settings"]);

export function isTitleCase(value: string): boolean {
  const words = value.replace(/\{\{[^}]*\}\}/g, "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length < 2) return false;
  const tail = words.slice(1).filter((w) => !PROPER.has(w.replace(/[^A-Za-z]/g, "")) && !/^[A-Z0-9-]+$/.test(w.replace(/[^A-Za-z0-9-]/g, "")));
  return tail.length > 0 && tail.every((w) => /^[A-Z][a-z]/.test(w));
}

function leaves(node: unknown, prefix = ""): Array<[string, string]> {
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [[key, v] as [string, string]] : leaves(v, key);
  });
}

describe("isTitleCase — synthetic proof", () => {
  it("flags Title Case and passes sentence case, acronyms and names", () => {
    expect(isTitleCase("Visit Website")).toBe(true);
    expect(isTitleCase("Visit website")).toBe(false);
    expect(isTitleCase("X Axis")).toBe(true);
    expect(isTitleCase("X axis")).toBe(false);
    expect(isTitleCase("HEX code")).toBe(false);
    expect(isTitleCase("Star Projects Plus")).toBe(false);
    expect(isTitleCase("Save")).toBe(false);
  });
});

describe("R0.30 — en.json", () => {
  it("has no Title Case label", () => {
    const file = path.join(__dirname, "..", "lib", "stores", "translations", "en.json");
    const bundle = (JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as { translation: unknown }).translation;
    const offenders = leaves(bundle).filter(([key, value]) => !NAMES.has(key) && isTitleCase(value)).map(([key, value]) => `${key}: ${value}`);
    expect(offenders).toEqual([]);
  });
});
