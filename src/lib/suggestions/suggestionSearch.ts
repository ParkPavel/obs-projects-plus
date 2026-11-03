import { nearWord, projectSearchText, switchLayout, textRank, type SearchProjection, type SearchText } from "./searchText";

interface Entry<T> { value: T; signature: string; projections: SearchProjection[] }
export interface SearchResult<T> { version: number; total: number; items: T[] }

/** One index belongs to one caller's permitted scope. No vault access or shared candidates. */
export function createSuggestionIndex<T extends SearchText>() {
  let entries = new Map<string, Entry<T>>();
  let version = 0;
  let projectionsBuilt = 0;
  const entry = (value: T, old?: Entry<T>): Entry<T> => {
    const texts = [value.label, ...(value.aliases ?? []).slice(0, 16), ...(value.searchTokens ?? []).slice(0, 32)];
    const signature = JSON.stringify(texts);
    if (old?.signature === signature) return { ...old, value };
    projectionsBuilt++;
    return { value, signature, projections: texts.map(projectSearchText) };
  };
  return {
    get version(): number { return version; },
    get projectionsBuilt(): number { return projectionsBuilt; },
    replace(values: readonly T[], id: (value: T, index: number) => string): void {
      const next = new Map<string, Entry<T>>();
      values.forEach((value, index) => {
        const key = id(value, index);
        next.set(key, entry(value, entries.get(key)));
      });
      entries = next; version++;
    },
    upsert(id: string, value: T): void { entries.set(id, entry(value, entries.get(id))); version++; },
    remove(id: string): void { if (entries.delete(id)) version++; },
    search(text: string, limit = 50): SearchResult<T> {
      // Never turn an excessive query into a different, selectable prefix.
      if (text.trim().length > 128) return { version, total: 0, items: [] };
      const query = projectSearchText(text);
      const repaired = projectSearchText(switchLayout(query.exact));
      // Repeated words are common in record titles. This bounded memo dies with
      // the query; no results or candidate IDs survive into another scope.
      const distances = new Map<string, boolean>();
      const fuzzy = (word: string): boolean => {
        const known = distances.get(word);
        if (known !== undefined) return known;
        const close = nearWord(query.folded, word);
        if (distances.size < 2048) distances.set(word, close);
        return close;
      };
      const ranked: Array<{ value: T; rank: number; order: number }> = [];
      let order = 0;
      for (const { value, projections } of entries.values()) {
        const rank = query.exact === "" ? 0 : Math.min(...projections.map(projection => textRank(projection, query, repaired, fuzzy)));
        if (Number.isFinite(rank)) ranked.push({ value, rank, order });
        order++;
      }
      ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
      return { version, total: ranked.length, items: ranked.slice(0, Math.max(0, limit)).map(item => item.value) };
    },
  };
}

/** One-off search; live fields use their own index so reactive updates invalidate it. */
export function searchSuggestions<T extends SearchText>(values: readonly T[], query: string, limit = 50): T[] {
  const index = createSuggestionIndex<T>();
  index.replace(values, (_, position) => String(position));
  return index.search(query, limit).items;
}
