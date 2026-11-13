// w4-p05 (audit F10) — UTF-8 text that was read back as Windows-1251.
//
// A file saved once through an editor that took UTF-8 for Windows-1251 turns
// every character outside ASCII into two to four Cyrillic letters and signs:
// "🔥" becomes "р", "џ", "”", "Ґ"; "→" becomes "в", "†", "’". The agenda's
// emoji, comments and a prefix label were stored that way. This file undoes
// such a reading (for values saved before the repair) and finds one in text
// (for the encoding guard, R0.38).

// Windows-1251 bytes 0x80–0xBF; 0xC0–0xFF are А–я in order. 0x98 is unused.
const CP1251_HIGH =
  "\u0402\u0403\u201A\u0453\u201E\u2026\u2020\u2021\u20AC\u2030\u0409\u2039\u040A\u040C\u040B\u040F" +
  "\u0452\u2018\u2019\u201C\u201D\u2022\u2013\u2014\uFFFF\u2122\u0459\u203A\u045A\u045C\u045B\u045F" +
  "\u00A0\u040E\u045E\u0408\u00A4\u0490\u00A6\u00A7\u0401\u00A9\u0404\u00AB\u00AC\u00AD\u00AE\u0407" +
  "\u00B0\u00B1\u0406\u0456\u0491\u00B5\u00B6\u00B7\u0451\u2116\u0454\u00BB\u0458\u0405\u0455\u0457";

const CYRILLIC_A = 0x0410;
const CYRILLIC_YA = 0x044f;

function cp1251Byte(char: string): number | null {
  const code = char.charCodeAt(0);
  if (code < 0x80) return code;
  if (code >= CYRILLIC_A && code <= CYRILLIC_YA) return 0xc0 + (code - CYRILLIC_A);
  const high = CP1251_HIGH.indexOf(char);
  return high >= 0 && char !== "\uFFFF" ? 0x80 + high : null;
}

/**
 * The text a UTF-8 string had before it was read as Windows-1251, or null when
 * `text` is not such a reading (plain Cyrillic, an emoji, ASCII).
 */
export function undoCp1251Reading(text: string): string | null {
  if (!/[\u0400-\u04ff\u2013-\u2122]/.test(text)) return null;
  let escaped = "";
  for (const char of text) {
    const byte = cp1251Byte(char);
    if (byte === null) return null;
    escaped += `%${byte.toString(16).padStart(2, "0")}`;
  }
  try {
    const decoded = decodeURIComponent(escaped);
    return decoded !== text ? decoded : null;
  } catch {
    return null;
  }
}

// Signs real Russian and Ukrainian text puts after a letter: quotes, dashes,
// the ellipsis, ё, і, ї, є, ґ. A lead letter followed only by these is text.
const TYPOGRAPHY = new Set([..."\u00AB\u00BB\u2014\u2013\u201C\u201D\u201E\u2018\u2019\u2026\u2022\u2116\u00B0\u00A0\u00A7\u00A9\u00B7\u00B1\u0451\u0401\u0456\u0406\u0457\u0407\u0454\u0404\u0491\u0490"]);

function isContinuation(char: string | undefined): boolean {
  if (char === undefined) return false;
  const byte = cp1251Byte(char);
  return byte !== null && byte >= 0x80 && byte <= 0xbf;
}

/**
 * Where `text` holds a UTF-8 sequence read as Windows-1251: a lead letter
 * (Р/С for Cyrillic, в for signs and arrows, р for emoji) followed by the
 * continuation signs that sequence needs, not all of them typography. Returns
 * the matched pieces.
 */
export function findCp1251Readings(text: string): string[] {
  const found: string[] = [];
  const chars = [...text];
  const needs: Record<string, number> = { "\u0420": 1, "\u0421": 1, "\u0432": 2, "\u0440": 3 };
  for (let i = 0; i < chars.length; i++) {
    const need = needs[chars[i]!];
    if (!need) continue;
    const tail = chars.slice(i + 1, i + 1 + need);
    if (tail.length !== need || !tail.every(isContinuation)) continue;
    if (tail.every((c) => TYPOGRAPHY.has(c))) continue;
    found.push(chars.slice(i, i + 1 + need).join(""));
    i += need;
  }
  return found;
}
