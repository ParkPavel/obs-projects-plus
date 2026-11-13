/**
 * R0.37 — no dimension binding where a component is rendered per item (17.10).
 *
 * Svelte 3 implements `bind:clientHeight` / `bind:clientWidth` / `bind:offset*`
 * with a hidden <iframe> per bound element (add_iframe_resize_listener). The
 * month calendar bound every day cell: hundreds of iframes, a freeze when the
 * calendar opened on a month, and memory exhausted until Windows could not
 * start new processes. Calendar components are rendered per day or per period;
 * they measure through `src/ui/actions/observeHeight` (one ResizeObserver).
 */
import fs from "fs";
import path from "path";

const CALENDAR = path.join(__dirname, "..", "ui", "views", "Calendar");

function svelteFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return svelteFiles(p);
    return e.name.endsWith(".svelte") ? [p] : [];
  });
}

it("calendar components bind no element dimensions (one iframe per element in Svelte 3)", () => {
  const offenders = svelteFiles(CALENDAR).filter((f) =>
    /bind:(client|offset)(Height|Width)\b/.test(fs.readFileSync(f, "utf8"))
  );
  expect(offenders.map((f) => path.relative(CALENDAR, f))).toEqual([]);
});

it("the month list is bounded and loads nothing while hidden", () => {
  const src = fs.readFileSync(path.join(CALENDAR, "components", "Calendar", "InfiniteCalendar.svelte"), "utf8");
  expect(src).toMatch(/const MAX_UNITS = \d+;/);
  expect(src).toMatch(/function checkAndLoadMore\(\) \{[\s\S]*?if \(!isActive\) return;/);
  expect(src).toMatch(/\.slice\(0, MAX_UNITS\)/);
  const horizontal = fs.readFileSync(path.join(CALENDAR, "components", "Calendar", "InfiniteHorizontalCalendar.svelte"), "utf8");
  expect(horizontal).toMatch(/function checkAndLoadMore\(\) \{[\s\S]*?!isActive\) return;/);
});
