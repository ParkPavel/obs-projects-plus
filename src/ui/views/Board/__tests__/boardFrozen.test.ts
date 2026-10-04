import { readFileSync } from "fs";
import { join } from "path";
import { isBoardFrozen } from "../types";

// release-370: a board saved by an older version with only `freezeColumns`
// showed as frozen in the settings and the navigation bar but rendered its
// columns unpinned, because the board read `freezeAll` alone.
describe("release-370 — a frozen board reads the legacy key too", () => {
  it.each([
    [undefined, false],
    [{}, false],
    [{ freezeAll: true }, true],
    [{ freezeAll: false }, false],
    [{ freezeColumns: true }, true],
    [{ freezeColumns: false }, false],
    [{ freezeAll: false, freezeColumns: true }, false],
    [{ freezeAll: true, freezeColumns: false }, true],
  ])("%p is frozen: %p", (config, expected) => {
    expect(isBoardFrozen(config)).toBe(expected);
  });

  it("the board view pins columns through it", () => {
    const view = readFileSync(join(__dirname, "..", "BoardView.svelte"), "utf8");
    expect(view).toContain("isBoardFrozen(config) ? { ...c, pinned: true } : c");
    expect(view).not.toMatch(/config\?\.freezeAll \?/);
  });
});
