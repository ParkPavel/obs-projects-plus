/**
 * R0.28 — no English literal in Svelte markup a user reads.
 *
 * R0.22 guards one shape (`new Notice('…')`). Live checks on 2026-09-25 met the
 * wider one: `{count} events` read to a Russian screen-reader user, «All day»,
 * «Loading...», «No favorites», and some eighty aria-labels, titles and
 * placeholders written straight into templates. Text nodes and the attributes
 * people read or hear (title, aria-label, placeholder, alt) must come from the
 * locale layer.
 *
 * The scan is textual, like R0.13/R0.26: `<script>`, `<style>` and comments are
 * blanked first, then text nodes with a word of three letters, those
 * attributes, and a word right after an expression (`{count} events`) are
 * reported. What is not language — format hints a user types in, a code
 * sample — is listed below with its reason, so the list is an argument on the
 * record rather than a hole.
 */

import * as fs from "fs";
import * as path from "path";
import { collectSourceFiles, SRC_ROOT } from "./support/cssScan";

/** `file|literal` pairs that are not language, each with why. */
const NOT_LANGUAGE: ReadonlyMap<string, string> = new Map([
  ["ui/components/ColorPicker/ColorPicker.svelte|#RRGGBB", "hex colour format hint"],
  ["ui/components/FieldControl/FieldControl.svelte|#RRGGBB", "hex colour format hint"],
  ["ui/views/Calendar/components/DayPopup/RecordItem.svelte|#RRGGBB", "hex colour format hint"],
  ["ui/modals/components/DateFormatSelector.svelte|YYYY-MM-DD", "date format token"],
  ["ui/modals/components/CreateProject.svelte|#tag", "tag syntax hint"],
  ["ui/modals/components/CreateProject.svelte|folder/path", "path syntax hint"],
  ["ui/modals/components/CreateProject.svelte|TABLE ...", "Dataview query keyword"],
  ["ui/modals/components/CreateProject.svelte|TABLE status Status FROM Work", "Dataview query sample"],
  ["ui/views/Dashboard/widgets/PipelineEditor.svelte|SUM", "formula function name"],
  ["ui/app/onboarding/Onboarding.svelte|---\nstatus: Backlog\ndue: 2023-01-01\npublished: false\n---\n\n# My blog post", "front matter code sample"],
  ["ui/views/Calendar/components/Calendar/HeaderStripsSection.svelte|= stripGhost.startDayIndex && dayIdx", "not text: a `<` comparison inside a template expression"],
]);

function blank(source: string, re: RegExp): string {
  return source.replace(re, (m) => m.replace(/[^\n]/g, " "));
}

export function englishInMarkup(source: string): string[] {
  const s = blank(blank(blank(source, /<script[\s\S]*?<\/script>/g), /<style[\s\S]*?<\/style>/g), /<!--[\s\S]*?-->/g);
  const found: string[] = [];
  for (const m of s.matchAll(/>([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g)) {
    const t = (m[1] ?? "").trim();
    if (t && !/^[\s\W\d]*$/.test(t)) found.push(t);
  }
  for (const m of s.matchAll(/\b(?:title|aria-label|placeholder|alt)="([^"{]*[A-Za-z]{3,}[^"{]*)"/g)) {
    found.push((m[1] ?? "").trim());
  }
  // Component props a user reads (SettingItem description, Callout title…),
  // written as a string or as a string expression — visual acceptance found
  // description={"Project"} under every settings row, which the attribute
  // list above could not see.
  for (const m of s.matchAll(/(?<![\w-])(?:description|label|heading|tooltip)="([^"{]*[A-Za-z]{3,}[^"{]*)"/g)) {
    found.push((m[1] ?? "").trim());
  }
  for (const m of s.matchAll(/(?<![\w-])(?:title|aria-label|placeholder|alt|description|label|heading|tooltip)=\{\s*["'`]([^"'`{}]*[A-Za-z]{3,}[^"'`{}]*)["'`]\s*\}/g)) {
    found.push((m[1] ?? "").trim());
  }
  // A SettingItem's name is its visible label (an HTML name= is not text).
  for (const m of s.matchAll(/<SettingItem\b[^>]*?\bname="([^"{]*[A-Z][a-z]{2,}[^"{]*)"/g)) {
    found.push((m[1] ?? "").trim());
  }
  // English words in a template-literal attribute: `Remove option ${i}`.
  for (const m of s.matchAll(/(?<![\w-])(?:title|aria-label|placeholder|alt|description|label|heading|tooltip)=\{`([^`]*)`\}/g)) {
    const words = (m[1] ?? "").replace(/\$\{[^}]*\}/g, " ").match(/[A-Za-z]{3,}/g);
    if (words) found.push(words.join(" "));
  }
  for (const m of s.matchAll(/\}\s+([a-z]{3,}(?:\s[a-z]+)*)\s*</g)) {
    found.push((m[1] ?? "").trim());
  }
  return found;
}

describe("englishInMarkup — synthetic proof", () => {
  it("finds a text node, a read attribute and a word after an expression", () => {
    expect(englishInMarkup(`<span>All day</span><button aria-label="Close">x</button><b>{n} events</b>`))
      .toEqual(["All day", "Close", "events"]);
  });
  it("finds a user-read component prop written as a string or a string expression", () => {
    expect(englishInMarkup(`<SettingItem name={x} description={"Project"} /><Callout title={"Info"} /><Row description="View" />`))
      .toEqual(["View", "Project", "Info"]);
  });
  it("ignores script, style, comments, expressions and translated attributes", () => {
    const src = `<script>const a = "Hello there";</script><style>.x{}</style><!-- Some note -->
      <span>{$i18n.t("x")}</span><i title={$i18n.t("y")}></i><b>42 %</b>`;
    expect(englishInMarkup(src)).toEqual([]);
  });
});

describe("R0.28 — the real tree", () => {
  const files = collectSourceFiles(SRC_ROOT, [".svelte"]).filter((f) => !f.includes(`${path.sep}__tests__${path.sep}`));

  it("scanned the components (a vacuous scan must not pass)", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  it("no English literal in markup outside the not-language list", () => {
    const offenders = files.flatMap((file) => {
      const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
      return englishInMarkup(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"))
        .filter((literal) => !NOT_LANGUAGE.has(`${rel}|${literal}`))
        .map((literal) => `${rel}: ${literal}`);
    });
    expect(offenders).toEqual([]);
  });

  // A type identifier printed as text is English too, though no literal is in
  // the markup: «(stats)» beside the translated header badges, «Обзор
  // (dashboard)» in the view settings. Found by visual acceptance on a touch
  // layout, where the type badge is always visible.
  it("no widget or view type identifier is printed raw", () => {
    const offenders = files.flatMap((file) => {
      const src = fs.readFileSync(file, "utf8");
      return [...src.matchAll(/\(\{(widgetType|view\.type|widget\.type)\}\)|\$\{(col\.field\.type|field\.type)\}/g)]
        .map((m) => `${path.relative(SRC_ROOT, file).split(path.sep).join("/")}: ${m[0]}`);
    });
    expect(offenders).toEqual([]);
  });

  it("every not-language entry still exists (the list cannot rot)", () => {
    const stale = [...NOT_LANGUAGE.keys()].filter((key) => {
      const [rel, literal] = key.split("|") as [string, string];
      const file = path.join(SRC_ROOT, rel);
      return !fs.existsSync(file) || !englishInMarkup(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n")).includes(literal);
    });
    expect(stale).toEqual([]);
  });
});
