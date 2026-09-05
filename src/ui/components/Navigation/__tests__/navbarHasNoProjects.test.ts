import * as fs from "fs";
import * as path from "path";

/**
 * #197 — the navbar says nothing about projects, and the settings tab says all
 * of it.
 *
 * Asserted against the SOURCE rather than a mounted component on purpose. The
 * thing being pinned is a decision — projects belong to the settings panel —
 * and a decision is broken by someone adding a project control back, not by a
 * prop changing value. A mounted test would pass happily against a navbar that
 * had grown a new switcher under a different name.
 *
 * The user's wording (visual run, 2026-09-06): remove the redundant display of
 * projects from the header; the settings panel already manages everything else.
 */

const NAVBAR = path.join(__dirname, "..", "CompactNavBar.svelte");
const PROJECT_TAB = path.join(
  __dirname,
  "..",
  "SettingsMenu",
  "tabs",
  "ProjectTab.svelte"
);

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

describe("#197 — projects left the navbar", () => {
  it("the navbar declares no project prop and dispatches no project change", () => {
    const source = read(NAVBAR);
    const markup = source.slice(0, source.indexOf("<style>"));

    expect(markup).not.toMatch(/export let projects/);
    expect(markup).not.toMatch(/export let projectId/);
    expect(markup).not.toMatch(/projectChange/);
  });

  it("no project control survives under another name", () => {
    const source = read(NAVBAR);
    // Covers the three shapes the block took: the switcher button, the static
    // label at one project, and the hardcoded check against the demo project's
    // name that decided between them.
    expect(source).not.toMatch(/project-trigger/);
    expect(source).not.toMatch(/project-name/);
    expect(source).not.toMatch(/hideProjectName/);
    expect(source).not.toMatch(/Демо-проект/);
  });

  it("the settings tab still owns every action the navbar could not do", () => {
    const source = read(PROJECT_TAB);

    // Select is the one the navbar had; the other three are why the panel is
    // the right home for it.
    expect(source).toMatch(/dispatch\("select"/);
    expect(source).toMatch(/dispatch\("editProject"/);
    expect(source).toMatch(/dispatch\("deleteProject"/);
    expect(source).toMatch(/dispatch\("addProject"/);
  });

  it("the dead switcher strings are gone from every locale", () => {
    const localeDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "lib",
      "stores",
      "translations"
    );
    for (const locale of ["en", "ru", "uk", "zh-CN"]) {
      const raw = fs.readFileSync(path.join(localeDir, `${locale}.json`), "utf8");
      expect(raw).not.toContain("project-switcher");
    }
  });
});
