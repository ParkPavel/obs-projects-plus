import type { FormulaNode } from "./syntax";
import { COMPUTED_FUNCTIONS, type FormulaFn } from "./computedFunctions";
import { LEGACY_FUNCTIONS } from "./legacyFunctions";
import { FORMULA_METADATA, type FormulaMetadata } from "./metadata";
import dayjs from "dayjs";

const SEMANTICS = ["legacy-filter", "legacy-computed", "unified-v1"] as const;
export type FormulaSemantics = typeof SEMANTICS[number];
export function isFormulaSemantics(value: unknown): value is FormulaSemantics {
  return SEMANTICS.some(semantics => semantics === value);
}

export interface FormulaFunctionContext {
  readonly semantics: FormulaSemantics;
  readonly referenceTime: number;
}

export interface FormulaDefinition {
  readonly name: string;
  readonly metadata: FormulaMetadata;
  readonly profiles: readonly FormulaSemantics[];
  readonly invoke: (
    args: FormulaNode[],
    evaluate: Parameters<FormulaFn>[1],
    range: Parameters<FormulaFn>[2],
    context: FormulaFunctionContext
  ) => ReturnType<FormulaFn>;
}

const CALENDAR_METADATA: Record<string, FormulaMetadata> = {
  IS_EMPTY: { name: "IS_EMPTY", signature: "IS_EMPTY(value)", returnType: "boolean", category: "logical", doc: "True for a missing value, empty text or empty list. Zero and false are filled values." },
  IS_NOT_EMPTY: { name: "IS_NOT_EMPTY", signature: "IS_NOT_EMPTY(value)", returnType: "boolean", category: "logical", doc: "True when the value is not missing, empty text or an empty list." },
  NOT_CONTAINS: { name: "NOT_CONTAINS", signature: "NOT_CONTAINS(value, text)", returnType: "boolean", category: "string", doc: "Case-insensitive negation of CONTAINS." },
  TOMORROW: { name: "TOMORROW", signature: "TOMORROW()", returnType: "date", category: "date", doc: "The day after the context's reference date." },
  YESTERDAY: { name: "YESTERDAY", signature: "YESTERDAY()", returnType: "date", category: "date", doc: "The day before the context's reference date." },
  IS_TODAY: { name: "IS_TODAY", signature: "IS_TODAY(date)", returnType: "boolean", category: "date", doc: "True when date is on the context's reference day." },
  IS_THIS_WEEK: { name: "IS_THIS_WEEK", signature: "IS_THIS_WEEK(date)", returnType: "boolean", category: "date", doc: "True when date is in the reference week, using the active date locale." },
  IS_THIS_MONTH: { name: "IS_THIS_MONTH", signature: "IS_THIS_MONTH(date)", returnType: "boolean", category: "date", doc: "True when date is in the context's reference month." },
  IS_BEFORE: { name: "IS_BEFORE", signature: "IS_BEFORE(date, other)", returnType: "boolean", category: "date", doc: "True when date is before the other calendar day." },
  IS_AFTER: { name: "IS_AFTER", signature: "IS_AFTER(date, other)", returnType: "boolean", category: "date", doc: "True when date is after the other calendar day." },
  IS_ON_AND_BEFORE: { name: "IS_ON_AND_BEFORE", signature: "IS_ON_AND_BEFORE(date, other)", returnType: "boolean", category: "date", doc: "True when date is on or before the other calendar day." },
  IS_ON_AND_AFTER: { name: "IS_ON_AND_AFTER", signature: "IS_ON_AND_AFTER(date, other)", returnType: "boolean", category: "date", doc: "True when date is on or after the other calendar day." },
  IS_OVERDUE: { name: "IS_OVERDUE", signature: "IS_OVERDUE(date)", returnType: "boolean", category: "date", doc: "True for a valid day strictly before the context's reference day." },
  IS_UPCOMING: { name: "IS_UPCOMING", signature: "IS_UPCOMING(date)", returnType: "boolean", category: "date", doc: "True for a valid day strictly after the context's reference day." },
  HAS_ANY_OF: { name: "HAS_ANY_OF", signature: "HAS_ANY_OF(list, values)", returnType: "boolean", category: "array", doc: "True if the two lists share an item, using strict item equality." },
  HAS_ALL_OF: { name: "HAS_ALL_OF", signature: "HAS_ALL_OF(list, values)", returnType: "boolean", category: "array", doc: "True if list includes every item of values, using strict item equality." },
  HAS_NONE_OF: { name: "HAS_NONE_OF", signature: "HAS_NONE_OF(list, values)", returnType: "boolean", category: "array", doc: "True if the two lists share no items, using strict item equality." },
};

const metadata = { ...FORMULA_METADATA, ...CALENDAR_METADATA };
const definitions = new Map<string, FormulaDefinition>();
for (const [name, info] of Object.entries(metadata)) {
  const computed = COMPUTED_FUNCTIONS[name];
  const legacy = LEGACY_FUNCTIONS[name];
  if (!computed && !legacy) throw new Error(`Formula metadata without implementation: ${name}`);
  const profiles: FormulaSemantics[] = ["unified-v1"];
  if (computed) profiles.push("legacy-computed");
  if (legacy) profiles.push("legacy-filter");
  definitions.set(name, {
    name, metadata: info, profiles,
    invoke(args, evaluate, range, context) {
      // A shared clock is explicit in the new profile; compatibility APIs
      // retain their previous implementation of every overlapping function.
      if (legacy && (context.semantics === "legacy-filter" || !computed ||
        (context.semantics === "unified-v1" && (name === "TODAY" || name === "NOW")))) {
        return legacy(args, evaluate, dayjs(context.referenceTime));
      }
      return computed ? computed(args, evaluate, range) : null;
    },
  });
}
for (const name of new Set([...Object.keys(COMPUTED_FUNCTIONS), ...Object.keys(LEGACY_FUNCTIONS)])) {
  if (!definitions.has(name)) throw new Error(`Formula implementation without metadata: ${name}`);
}

const profileDocs: Partial<Record<FormulaSemantics, Record<string, string>>> = {
  "legacy-filter": {
    AND: "True if every argument is the boolean true; other truthy values do not match.",
    OR: "True if any argument is the boolean true; other truthy values do not match.",
  },
  "unified-v1": {
    TODAY: "The context's reference day, as YYYY-MM-DD.",
    NOW: "The fixed reference instant of this evaluation context.",
  },
};
const profileDefinitions = new Map<string, FormulaDefinition>();
for (const [profile, docs] of Object.entries(profileDocs)) {
  for (const [name, doc] of Object.entries(docs)) {
    const definition = definitions.get(name)!;
    profileDefinitions.set(profile + ":" + name, { ...definition, metadata: { ...definition.metadata, doc } });
  }
}

// This list is also the lexer's reserved callable-name set. It is derived
// from executable definitions, rather than maintained as another inventory.
export const FORMULA_FUNCTION_NAMES: readonly string[] = Object.freeze(Array.from(definitions.keys()));

export function getFormulaDefinition(name: string, semantics: FormulaSemantics): FormulaDefinition | undefined {
  const upper = name.toUpperCase();
  const definition = profileDefinitions.get(semantics + ":" + upper) ?? definitions.get(upper);
  return definition?.profiles.includes(semantics) ? definition : undefined;
}

export function getFormulaCatalog(semantics: FormulaSemantics): readonly FormulaDefinition[] {
  return Array.from(definitions.values()).filter(definition => definition.profiles.includes(semantics)).map(definition => getFormulaDefinition(definition.name, semantics)!);
}

export function formulaFunctionNames(semantics: FormulaSemantics): string[] {
  // Preserve the public computed API's insertion order for existing callers.
  if (semantics === "legacy-computed") return Object.keys(COMPUTED_FUNCTIONS);
  return getFormulaCatalog(semantics).map(definition => definition.name);
}
