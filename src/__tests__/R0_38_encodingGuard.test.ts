/**
 * R0.38 — no UTF-8 text read back as Windows-1251 in the sources (w4-p05,
 * audit F10).
 *
 * The agenda's icon picker showed four Cyrillic signs where "🔥" was meant: its file had
 * been saved once through an editor that took UTF-8 for Windows-1251, and four
 * more calendar files carried the same damage in comments and in the filter
 * prefix label. Nothing caught it, because the broken text is valid Cyrillic.
 *
 * ## What is rejected
 *
 * In every `src/**` `.ts`, `.svelte`, `.css` and `.json` file, tests included:
 * a lead letter (Р/С, в, р) followed by the Windows-1251 signs that a UTF-8
 * sequence of that length is made of, not all of them typography Russian or
 * Ukrainian text puts after a letter (see `findCp1251Readings`).
 *
 * ## Where it is blind
 *
 * A broken run made only of letters and typography (some Cyrillic words become
 * exactly that) is not seen alone; a broken word almost always holds one other
 * sign. Text that was broken through another code page is not the subject.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { findCp1251Readings } from "src/lib/text/cp1251";
import { SRC_ROOT, relToSrc } from "./support/cssScan";

function allFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) allFiles(full, out);
    else if (/\.(ts|svelte|css|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("R0.38 — encoding guard", () => {
  test("the detector sees the broken forms and passes real text", () => {
    // "🔥", "→", "—", "Где" as they read after the damage.
    expect(findCp1251Readings("\u0440\u045F\u201D\u0490")).toHaveLength(1);
    expect(findCp1251Readings("x \u0432\u2020\u2019 y")).toHaveLength(1);
    expect(findCp1251Readings("\u0432\u0402\u201D")).toHaveLength(1);
    expect(findCp1251Readings("\u0420\u201C\u0420\u0491\u0420\u00B5").length).toBeGreaterThan(0);
    for (const text of ["Где и как", "«Готов»", "в «кавычках»", "Иванов»—", "ПРАВИЛЬНАЯ ЛОГИКА", "Вівторок, ґанок, їжа, є", "🔥 → —"]) {
      expect(findCp1251Readings(text)).toEqual([]);
    }
  });

  test("no source file holds UTF-8 read as Windows-1251", () => {
    const offences: string[] = [];
    for (const file of allFiles(SRC_ROOT)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const hits = findCp1251Readings(line);
        if (hits.length > 0) offences.push(`${relToSrc(file)}:${i + 1} ${hits.slice(0, 3).join(" ")}`);
      });
    }
    expect(offences).toEqual([]);
  });
});
