import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";

/**
 * i2-data (D20): the formula editor showed the parser's own words — «Unknown
 * field: Paid», «Unexpected token: OPERATOR». Each raw message is turned into
 * a sentence that says what is wrong and what to do; anything unrecognised is
 * passed through unchanged rather than hidden.
 */
export function humanFormulaError(raw: string, fields: readonly string[] = []): string {
  const t = (key: string, opts: Record<string, string> = {}): string => {
    const text = get(i18n).t(`formula-errors.${key}`, opts);
    return text === `formula-errors.${key}` ? raw : text; // no translations loaded: keep the raw words
  };
  let m: RegExpExecArray | null;
  if (/^Formula (?:work|evaluation|parsing|input|list|financial (?:work|range)) limit exceeded$/.test(raw)) return t("limit");
  if ((m = /^Unknown field: (.+)$/.exec(raw))) {
    const hint = closestField(m[1]!, fields);
    return hint ? t("unknown-field-hint", { name: m[1]!, hint }) : t("unknown-field", { name: m[1]! });
  }
  if ((m = /^Unknown function: (.+)$/.exec(raw))) return t("unknown-function", { name: m[1]! });
  if (/Unexpected end of input|Unexpected token: EOF/.test(raw)) return t("unfinished");
  if (/Unexpected token: OPERATOR/.test(raw)) return t("operator");
  if ((m = /^Unexpected character at position \d+: (.)$/.exec(raw))) return t("character", { char: m[1]! });
  if (/^Expected \w+ but got \w+/.test(raw)) return t("bracket");
  // i3-final: «DATE_ADD expects 3 arguments (date, amount, unit)» is the same sentence.
  if ((m = /^(\w+) expects (\d+) arguments?(?: \(.*\))?$/.exec(raw))) return t("arguments", { name: m[1]!, count: m[2]! });
  if (/^Unexpected token: \w+$/.test(raw)) return t("token");
  if (/^Missing argument at index \d+$/.test(raw)) return t("missing-argument");
  if ((m = /^Unknown operator: (.+)$/.exec(raw))) return t("unknown-operator", { op: m[1]! });
  // i3-final: nothing reaches the person in the parser's English alone — an
  // unrecognised message is framed in their language, its detail kept.
  return t("invalid", { detail: raw });
}

/** A field whose name starts like the unknown one, ignoring case — a hint, not a correction. */
function closestField(name: string, fields: readonly string[]): string | undefined {
  const n = name.toLowerCase();
  return fields.find((f) => f.toLowerCase().startsWith(n.slice(0, 3))) ?? undefined;
}

/**
 * Field names in formulas are matched without regard to case, as people
 * type them: `Paid` reaches the property `paid`. An exact match wins.
 */
export function resolveFieldName(name: string, available: Iterable<string>): string | undefined {
  const lower = name.toLowerCase();
  let found: string | undefined;
  for (const f of available) {
    if (f === name) return f;
    if (found === undefined && f.toLowerCase() === lower) found = f;
  }
  return found;
}
