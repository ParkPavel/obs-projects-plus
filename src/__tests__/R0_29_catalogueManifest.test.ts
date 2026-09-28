/**
 * R0.29 — manifest.json meets the Obsidian catalogue's submission rules.
 *
 * Source: obsidianmd/obsidian-developer-docs, "Submission requirements for
 * plugins" (read 2026-09-25) and the Manifest reference.
 *   - fundingUrl only for a financial-support service, otherwise absent;
 *   - the description is short (at most 250 characters), ends with a period,
 *     and carries no emoji or special characters;
 *   - minAppVersion is the minimum version the plugin really works on.
 *
 * The last one is checked against the one API family whose floor is known
 * and newer than the old declaration: App.loadLocalStorage/saveLocalStorage
 * (`@since 1.8.7` in obsidian.d.ts), called without a guard in several views.
 */

import * as fs from "fs";
import * as path from "path";
import { collectSourceFiles, SRC_ROOT } from "./support/cssScan";

const ROOT = path.join(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")) as Record<string, unknown>;

const FUNDING_HOSTS = /^https:\/\/(github\.com\/sponsors\/|www\.buymeacoffee\.com\/|buymeacoffee\.com\/|ko-fi\.com\/|www\.patreon\.com\/|patreon\.com\/|boosty\.to\/|liberapay\.com\/|opencollective\.com\/|www\.paypal\.(me|com)\/)/;

function atLeast(version: string, floor: string): boolean {
  const a = version.split(".").map(Number);
  const b = floor.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

describe("R0.29 catalogue manifest", () => {
  test("fundingUrl, when present, points at a financial-support service", () => {
    const funding = manifest["fundingUrl"];
    if (funding === undefined) return;
    const urls = typeof funding === "string" ? [funding] : Object.values(funding as Record<string, string>);
    for (const url of urls) expect(url).toMatch(FUNDING_HOSTS);
  });

  test("the description is short, plain and ends with a period", () => {
    const description = String(manifest["description"] ?? "");
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(250);
    expect(description.endsWith(".")).toBe(true);
    // The rules eslint-plugin-obsidianmd's validateManifest applies at review.
    expect(description).toMatch(/^[A-Z]/);
    expect(description).toMatch(/^[A-Za-z0-9\s.,!?'"-]+$/);
    expect(description).not.toMatch(/^this (is a )?plugin/i);
  });

  test("name, id and description avoid the words the validator forbids", () => {
    for (const key of ["name", "id", "description"]) {
      expect(String(manifest[key])).not.toMatch(/\b(obsidian|plugin)\b/i);
    }
  });

  // The directory rejects a name with any part of "Obsidian" (its trademark):
  // "OBS Projects Plus" failed its review. The id keeps its historical form —
  // installed copies and their data are found by it.
  test("the name carries no part of the Obsidian name", () => {
    const words = String(manifest["name"]).toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);
    for (const word of words) expect("obsidian".includes(word)).toBe(false);
  });

  test("minAppVersion covers the App storage API the code calls (@since 1.8.7)", () => {
    const usesAppStorage = collectSourceFiles(SRC_ROOT, [".ts", ".svelte"])
      .filter((f) => !/\.(test|spec)\.ts$/.test(f))
      .some((f) => /\b(load|save)LocalStorage\s*(\?\.)?\(/.test(fs.readFileSync(f, "utf8")));
    expect(usesAppStorage).toBe(true);
    expect(atLeast(String(manifest["minAppVersion"]), "1.8.7")).toBe(true);
  });

  test("versions.json maps the current version to the same minAppVersion", () => {
    const versions = JSON.parse(fs.readFileSync(path.join(ROOT, "versions.json"), "utf8")) as Record<string, string>;
    expect(versions[String(manifest["version"])]).toBe(manifest["minAppVersion"]);
  });
});
