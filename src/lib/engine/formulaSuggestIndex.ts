/**
 * Formula suggestion index (B5, 3.7.2).
 *
 * The editor used to filter every function and every field name on each
 * keystroke. The index sorts both lists once per schema; a suggestion is a
 * binary search for the prefix plus a walk over the matches it returns.
 * `stats.comparisons` exists so the budget is tested in calls, not in time.
 */

export interface SuggestIndex {
  /** Functions first, then fields; case-insensitive prefix; at most `limit`. */
  suggest(word: string, limit?: number): string[];
  suggestEntries(word: string, limit?: number): FormulaSuggestionEntry[];
  readonly stats: { comparisons: number };
}

export interface FormulaSuggestionEntry {
  readonly label: string;
  readonly kind: "function" | "field";
}

type Entry = { readonly key: string; readonly label: string };

function sorted(labels: readonly string[]): Entry[] {
  return labels
    .map((label) => ({ key: label.toUpperCase(), label }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function buildSuggestIndex(functions: readonly string[], fields: readonly string[]): SuggestIndex {
  const lists = [sorted(functions), sorted(fields)];
  const stats = { comparisons: 0 };

  function lowerBound(list: Entry[], prefix: string): number {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      stats.comparisons++;
      if (list[mid]!.key < prefix) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function collect(word: string, limit = 12): FormulaSuggestionEntry[] {
    if (!word) return [];
    const prefix = word.toUpperCase();
    const out: FormulaSuggestionEntry[] = [];
    for (let group = 0; group < lists.length; group++) {
      const list = lists[group]!;
      for (let i = lowerBound(list, prefix); i < list.length && out.length < limit; i++) {
        stats.comparisons++;
        if (!list[i]!.key.startsWith(prefix)) break;
        out.push({ label: list[i]!.label, kind: group === 0 ? "function" : "field" });
      }
    }
    return out;
  }
  return {
    stats,
    suggestEntries: collect,
    suggest: (word, limit) => collect(word, limit).map(entry => entry.label),
  };
}

/** Rebuilds only when the function or field list itself is a different array. */
export function suggestIndexCache() {
  let lastFunctions: readonly string[] | null = null;
  let lastFields: readonly string[] | null = null;
  let index: SuggestIndex | null = null;
  const cache = {
    builds: 0,
    get(functions: readonly string[], fields: readonly string[]): SuggestIndex {
      if (!index || functions !== lastFunctions || fields !== lastFields) {
        index = buildSuggestIndex(functions, fields);
        lastFunctions = functions;
        lastFields = fields;
        cache.builds++;
      }
      return index;
    },
  };
  return cache;
}
