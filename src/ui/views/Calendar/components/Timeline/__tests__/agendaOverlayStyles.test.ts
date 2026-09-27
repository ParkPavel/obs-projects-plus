/**
 * Codex review of 125c617 (catalogue C6): the agenda overlay still wrote
 * `position: fixed`, and without a calendar container the whole-viewport box,
 * inline on every update. Those are static; only the measured bounds of the
 * container stay inline.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(resolve(__dirname, "..", "AgendaSidebar.svelte"), "utf8");
const overlay = src.slice(src.indexOf("function portalOverlay("), src.indexOf("function portalOverlay(") + 1500);

test("no static style is written inline by the overlay", () => {
  expect(overlay).not.toMatch(/node\.style\.position\s*=/);
  expect(overlay).not.toMatch(/'100vw'|'100vh'|style\.top = '0'|style\.left = '0'/);
});

test("the overlay's static layout is a class, with its rule", () => {
  expect(overlay).toMatch(/classList\.add\('obsidian-projects-agenda-overlay'\)/);
  expect(overlay).toMatch(/classList\.toggle\('obsidian-projects-agenda-overlay--viewport', !container\)/);
  expect(src).toMatch(/:global\(\.obsidian-projects-agenda-overlay\)\s*\{[^}]*position: fixed/);
  expect(src).toMatch(/:global\(\.obsidian-projects-agenda-overlay--viewport\)\s*\{[^}]*inset: 0/);
});
