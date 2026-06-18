import {
  getAllFormulaMetadata,
  type FormulaCategory,
} from "src/lib/dashboard-engine/formulaMetadata";

export interface HelpEntry {
  readonly signature: string;
  readonly doc?: string;
}

export interface HelpGroup {
  readonly category: FormulaCategory;
  readonly entries: ReadonlyArray<HelpEntry>;
}

const CATEGORY_ORDER: readonly FormulaCategory[] = [
  "logical",
  "math",
  "string",
  "date",
  "conversion",
  "array",
  "statistical",
  "financial",
  "utility",
];

export function groupFormulaMetadata(): HelpGroup[] {
  const byCategory = new Map<FormulaCategory, HelpEntry[]>();
  for (const meta of getAllFormulaMetadata()) {
    const bucket = byCategory.get(meta.category) ?? [];
    bucket.push({ signature: meta.signature, doc: meta.doc });
    byCategory.set(meta.category, bucket);
  }
  const groups: HelpGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const entries = byCategory.get(category);
    if (entries && entries.length > 0) {
      groups.push({ category, entries });
    }
  }
  return groups;
}
