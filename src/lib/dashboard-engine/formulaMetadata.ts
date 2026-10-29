// Display adapters retain the previous computed catalog until explicit UI opt-in.
import { getFormulaDefinition, getFormulaCatalog } from "src/lib/formula/catalog";
import type { FormulaSemantics } from "src/lib/formula/catalog";
import type { FormulaMetadata } from "src/lib/formula/metadata";
export type { FormulaMetadata, FormulaCategory } from "src/lib/formula/metadata";


/**
 * Look up metadata for a function by name (case-insensitive).
 * Returns undefined if the name is not a recognised formula function.
 */
export function getFormulaMetadata(name: string, semantics: FormulaSemantics = "legacy-computed"): FormulaMetadata | undefined {
  if (!name) return undefined;
  return getFormulaDefinition(name, semantics)?.metadata;
}

/**
 * i3-final: a function's description in the reader's language. Translations
 * live under `formula-docs.<NAME>`; a function without one keeps its English
 * doc rather than showing the key.
 */
export function localizedFormulaDoc(
  name: string,
  fallback: string,
  t: (key: string, options: { defaultValue: string }) => string,
  semantics: FormulaSemantics = "legacy-computed",
): string {
  const functionName = name.toUpperCase();
  const profileDoc = ["COUNT", "WORKDAYS", "TODAY", "NOW"].includes(functionName)
    || (semantics === "legacy-filter" && ["AND", "OR"].includes(functionName));
  const key = profileDoc ? `formula-profile-docs.${semantics}.${functionName}` : `formula-docs.${functionName}`;
  const text = t(key, { defaultValue: fallback });
  return text && text !== key ? text : fallback;
}

/**
 * All registered formula function metadata entries.
 */
export function getAllFormulaMetadata(semantics: FormulaSemantics = "legacy-computed"): readonly FormulaMetadata[] {
  return getFormulaCatalog(semantics).map(definition => definition.metadata);
}

/**
 * Walks backwards from `cursor` through `source` to find the name of the
 * innermost function call whose opening `(` has not yet been closed.
 * Used by FormulaBar to pick the signature popover when typing inside a call.
 *
 * String-literal aware: skips parentheses that sit inside "..." / '...' spans,
 * respecting backslash escapes.
 */
export function findEnclosingCall(source: string, cursor: number, semantics: FormulaSemantics = "legacy-computed"): string | null {
  if (semantics === "unified-v1") return strictEnclosingCall(source, cursor);
  const end = Math.min(cursor, source.length);
  // First pass (forward): compute which indices live inside a string literal.
  const inString = new Array<boolean>(end).fill(false);
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < end; i++) {
    const ch = source[i];
    if (quote) {
      inString[i] = true;
      if (ch === "\\") {
        // Skip the escaped char.
        if (i + 1 < end) inString[i + 1] = true;
        i++;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      inString[i] = true;
      quote = ch;
    }
  }

  let depth = 0;
  for (let i = end - 1; i >= 0; i--) {
    if (inString[i]) continue;
    const ch = source[i];
    if (ch === ")") {
      depth++;
    } else if (ch === "(") {
      if (depth === 0) {
        let j = i - 1;
        while (j >= 0 && /[A-Za-z0-9_]/.test(source[j] as string)) j--;
        const name = source.substring(j + 1, i);
        return name.length > 0 ? name : null;
      }
      depth--;
    }
  }
  return null;
}

/** Incremental call hints tolerate incomplete text while honoring strict comments/strings. */
function strictEnclosingCall(source: string, cursor: number): string | null {
  const end = Math.min(cursor, source.length);
  const stack: Array<string | null> = [];
  const identifier = /[\p{L}_][\p{L}\p{N}_]*/uy;
  let name: string | null = null;
  for (let i = 0; i < end;) {
    const character = source[i]!;
    if (/\s/.test(character)) { i++; continue; }
    if (character === "#") {
      while (i < end && source[i] !== "\n") i++;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      i++;
      while (i < end) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i++] === quote) break;
      }
      name = null;
      continue;
    }
    identifier.lastIndex = i;
    const match = identifier.exec(source);
    if (match) { name = match[0]; i = identifier.lastIndex; continue; }
    if (character === "(") stack.push(name);
    else if (character === ")") stack.pop();
    name = null;
    i++;
  }
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i]) return stack[i]!;
  return null;
}
