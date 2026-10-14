/** B3: the search language lives in tableSearchQuery; this name stays for its callers. */
export {
  applySearch, matchesSearch, matchesParsed, parseSearchQuery, normalizeSearchText,
  searchDay, valueTexts, highlightParts, searchSuggestions, hintKey,
} from "./tableSearchQuery";
export type { SearchTerm, ParsedSearch, HighlightPart, SearchSuggestion } from "./tableSearchQuery";
