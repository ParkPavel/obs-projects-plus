/** Search projections never replace canonical IDs, labels or stored values. */
export interface SearchText { label: string; aliases?: readonly string[]; searchTokens?: readonly string[] }
export interface SearchProjection { exact: string; folded: string; words: string[]; latin: string }

const RU = Array.from("ёйцукенгшщзхъфывапролджэячсмитьбю.");
const EN = Array.from("`qwertyuiop[]asdfghjkl;'zxcvbnm,./");
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
export const foldSearch = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/ё/g, "е");
export const latinSearch = (text: string): string => Array.from(text, char => TRANSLIT[char] ?? char).join("");
export const searchWords = (text: string): string[] => foldSearch(text.replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1 $2")).match(/[\p{L}\p{N}]+/gu) ?? [];

/** Convert the query before punctuation is tokenized (semicolon is Russian ж). */
export function switchLayout(text: string): string {
  const from = /[а-яё]/i.test(text) ? RU : EN;
  const to = from === RU ? EN : RU;
  return Array.from(text.toLowerCase(), char => {
    const index = from.indexOf(char);
    return index < 0 ? char : to[index]!;
  }).join("");
}

export function projectSearchText(text: string): SearchProjection {
  const exact = text.slice(0, 2048).trim();
  const folded = foldSearch(exact);
  return { exact, folded, words: searchWords(exact).slice(0, 128), latin: latinSearch(folded) };
}

/** Bounded Damerau-Levenshtein; short queries never enter the fuzzy path. */
export function nearWord(query: string, candidate: string): boolean {
  const a = Array.from(query), b = Array.from(candidate);
  if (a.length < 4 || a.length > 64 || b.length > 66) return false;
  const budget = a.length < 8 ? 1 : 2;
  if (Math.abs(a.length - b.length) > budget) return false;
  let older: number[] = [], previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array<number>(b.length + 1).fill(budget + 1);
    row[0] = i;
    let minimum = row[0];
    for (let j = Math.max(1, i - budget); j <= Math.min(b.length, i + budget); j++) {
      row[j] = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j]!, older[j - 2]! + 1);
      minimum = Math.min(minimum, row[j]!);
    }
    if (minimum > budget) return false;
    older = previous; previous = row;
  }
  return previous[b.length]! <= budget;
}

/** Direct matches precede transliteration, layout repair and bounded typos. */
export function textRank(value: SearchProjection, query: SearchProjection, repaired: SearchProjection, fuzzy = (word: string) => nearWord(query.folded, word)): number {
  if (value.exact === query.exact) return 0;
  if (value.folded === query.folded) return 1;
  if (value.folded.startsWith(query.folded)) return 2;
  if (value.words.some(word => word.startsWith(query.folded))) return 3;
  if (query.words.length > 1 && query.words.every(part => value.words.some(word => word.startsWith(part)))) return 4;
  if (value.folded.includes(query.folded)) return 5;
  if (query.latin !== "" && value.latin.includes(query.latin)) return 6;
  if (value.folded.includes(repaired.folded) || repaired.words.length > 1 && repaired.words.every(part => value.words.some(word => word.startsWith(part)))) return 7;
  if (query.words.length === 1 && value.words.some(fuzzy)) return 8;
  return Infinity;
}
