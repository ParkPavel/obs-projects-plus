import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";

/** A legacy basename is resolved only when this target scope makes it unambiguous. */
function targetOf(value: string, candidates: readonly string[]): string | undefined {
  const target = value.replace(/\.md$/i, "");
  if (candidates.includes(target)) return target;
  if (target.includes("/")) return undefined;
  const matches = candidates.filter(candidate => candidate.split("/").pop() === target);
  return matches.length === 1 ? matches[0] : undefined;
}

export function selectedCandidateIds(selected: Iterable<string>, candidates: readonly string[]): string[] {
  return [...new Set(Array.from(selected, value => targetOf(value, candidates)).filter((value): value is string => value !== undefined))];
}

export function toggleRelationSelection(selected: ReadonlySet<string>, target: string, candidates: readonly string[]): Set<string> {
  const next = new Set(selected);
  const existing = [...selected].filter(value => targetOf(value, candidates) === target);
  if (existing.length) for (const value of existing) next.delete(value);
  else next.add(target);
  return next;
}

/** Preserve unchanged containers and untouched link tokens, including aliases. */
export function serializeRelationSelection(targets: readonly string[], original: Optional<DataValue>, multi: boolean): Optional<DataValue> {
  const initial = [...new Set(parseRelationLinks(original))];
  if (targets.length === initial.length && targets.every((value, index) => value === initial[index])) return original;
  const tokens: Array<{ target: string; raw: Optional<DataValue> }> = [];
  for (const raw of Array.isArray(original) ? original : [original]) {
    const pieces = typeof raw === "string" ? raw.match(/\[\[[^\]]+\]\]/g) ?? [raw] : [raw];
    for (const piece of pieces) for (const target of parseRelationLinks(piece)) tokens.push({ target, raw: piece });
  }
  const values = targets.flatMap(target => {
    const previous = tokens.filter(token => token.target === target);
    return previous.length ? previous.map(token => token.raw) : [`[[${target}]]`];
  });
  return multi ? values : values[0] ?? "";
}
