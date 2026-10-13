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
  readonly stats: { comparisons: number };
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

  return {
    stats,
    suggest(word: string, limit = 12): string[] {
      if (!word) return [];
      const prefix = word.toUpperCase();
      const out: string[] = [];
      for (const list of lists) {
        for (let i = lowerBound(list, prefix); i < list.length && out.length < limit; i++) {
          stats.comparisons++;
          if (!list[i]!.key.startsWith(prefix)) break;
          out.push(list[i]!.label);
        }
      }
      return out;
    },
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
