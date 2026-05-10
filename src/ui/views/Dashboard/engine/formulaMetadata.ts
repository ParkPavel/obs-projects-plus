// src/ui/views/Dashboard/engine/formulaMetadata.ts
// Static metadata registry for every function exposed by formulaEngine.
// Powers IntelliSense signature popovers in FormulaBar (Phase 4).

export type FormulaCategory =
  | "logical"
  | "math"
  | "string"
  | "date"
  | "financial"
  | "statistical"
  | "array"
  | "conversion"
  | "utility";

export interface FormulaMetadata {
  readonly name: string;
  readonly signature: string;
  readonly returnType: string;
  readonly doc: string;
  readonly category: FormulaCategory;
}

const M: Record<string, FormulaMetadata> = {
  // ── Logical ──────────────────────────────────────────────────
  IF: { name: "IF", signature: "IF(condition, then, else?)", returnType: "any", doc: "Returns `then` if condition is truthy, else `else` (or null).", category: "logical" },
  IFS: { name: "IFS", signature: "IFS(cond1, val1, cond2, val2, ...)", returnType: "any", doc: "Returns the value paired with the first truthy condition.", category: "logical" },
  SWITCH: { name: "SWITCH", signature: "SWITCH(expr, case1, val1, ..., default?)", returnType: "any", doc: "Matches `expr` against cases; returns matched value or default.", category: "logical" },
  AND: { name: "AND", signature: "AND(a, b, ...)", returnType: "boolean", doc: "True if every argument is truthy.", category: "logical" },
  OR: { name: "OR", signature: "OR(a, b, ...)", returnType: "boolean", doc: "True if any argument is truthy.", category: "logical" },
  NOT: { name: "NOT", signature: "NOT(value)", returnType: "boolean", doc: "Logical negation.", category: "logical" },
  EMPTY: { name: "EMPTY", signature: "EMPTY(value)", returnType: "boolean", doc: "True if value is null, empty string, or empty array.", category: "logical" },
  IFBLANK: { name: "IFBLANK", signature: "IFBLANK(value, fallback)", returnType: "any", doc: "Returns fallback if value is blank; otherwise value.", category: "logical" },

  // ── Math ────────────────────────────────────────────────────
  ROUND: { name: "ROUND", signature: "ROUND(value, decimals?)", returnType: "number", doc: "Rounds to the given number of decimal places.", category: "math" },
  CEIL: { name: "CEIL", signature: "CEIL(value)", returnType: "number", doc: "Smallest integer ≥ value.", category: "math" },
  FLOOR: { name: "FLOOR", signature: "FLOOR(value)", returnType: "number", doc: "Largest integer ≤ value.", category: "math" },
  ABS: { name: "ABS", signature: "ABS(value)", returnType: "number", doc: "Absolute value.", category: "math" },
  SQRT: { name: "SQRT", signature: "SQRT(value)", returnType: "number", doc: "Square root; null for negative input.", category: "math" },
  POWER: { name: "POWER", signature: "POWER(base, exponent)", returnType: "number", doc: "Raises base to exponent.", category: "math" },
  LOG: { name: "LOG", signature: "LOG(value, base?)", returnType: "number", doc: "Logarithm of value; default base is e.", category: "math" },
  SIGN: { name: "SIGN", signature: "SIGN(value)", returnType: "number", doc: "-1, 0, or 1 depending on sign of value.", category: "math" },
  MOD: { name: "MOD", signature: "MOD(a, b)", returnType: "number", doc: "Remainder of a divided by b.", category: "math" },
  EVEN: { name: "EVEN", signature: "EVEN(value)", returnType: "boolean", doc: "True if value is an even integer.", category: "math" },
  ODD: { name: "ODD", signature: "ODD(value)", returnType: "boolean", doc: "True if value is an odd integer.", category: "math" },
  PI: { name: "PI", signature: "PI()", returnType: "number", doc: "Returns π (3.14159…).", category: "math" },
  RANDOM_INT: { name: "RANDOM_INT", signature: "RANDOM_INT(min, max)", returnType: "number", doc: "Random integer in [min, max] inclusive.", category: "math" },
  PRODUCT: { name: "PRODUCT", signature: "PRODUCT(a, b, ...)", returnType: "number", doc: "Product of all numeric arguments.", category: "math" },

  // ── String ──────────────────────────────────────────────────
  TRIM: { name: "TRIM", signature: "TRIM(text)", returnType: "string", doc: "Removes leading/trailing whitespace.", category: "string" },
  LOWER: { name: "LOWER", signature: "LOWER(text)", returnType: "string", doc: "Lowercase.", category: "string" },
  UPPER: { name: "UPPER", signature: "UPPER(text)", returnType: "string", doc: "Uppercase.", category: "string" },
  LENGTH: { name: "LENGTH", signature: "LENGTH(value)", returnType: "number", doc: "Length of string or array.", category: "string" },
  SUBSTRING: { name: "SUBSTRING", signature: "SUBSTRING(text, start, end?)", returnType: "string", doc: "Substring between indices.", category: "string" },
  REPLACE: { name: "REPLACE", signature: "REPLACE(text, search, replacement)", returnType: "string", doc: "Replaces all occurrences of search.", category: "string" },
  CONTAINS: { name: "CONTAINS", signature: "CONTAINS(value, search)", returnType: "boolean", doc: "True if value (string/array) contains search.", category: "string" },
  STARTS_WITH: { name: "STARTS_WITH", signature: "STARTS_WITH(text, prefix)", returnType: "boolean", doc: "True if text starts with prefix.", category: "string" },
  ENDS_WITH: { name: "ENDS_WITH", signature: "ENDS_WITH(text, suffix)", returnType: "boolean", doc: "True if text ends with suffix.", category: "string" },
  SPLIT: { name: "SPLIT", signature: "SPLIT(text, separator)", returnType: "string[]", doc: "Splits text by separator.", category: "string" },
  JOIN: { name: "JOIN", signature: "JOIN(array, separator?)", returnType: "string", doc: "Joins array elements with separator (default \", \").", category: "string" },
  REPEAT: { name: "REPEAT", signature: "REPEAT(text, count)", returnType: "string", doc: "Repeats text `count` times.", category: "string" },
  LEFT: { name: "LEFT", signature: "LEFT(text, n)", returnType: "string", doc: "First n characters of text.", category: "string" },
  RIGHT: { name: "RIGHT", signature: "RIGHT(text, n)", returnType: "string", doc: "Last n characters of text.", category: "string" },
  MID: { name: "MID", signature: "MID(text, start, length)", returnType: "string", doc: "Substring starting at `start` with `length` chars.", category: "string" },
  FORMAT: { name: "FORMAT", signature: "FORMAT(template, ...values)", returnType: "string", doc: "Fills `{0}`, `{1}`, … placeholders.", category: "string" },
  ENCODE_URL: { name: "ENCODE_URL", signature: "ENCODE_URL(text)", returnType: "string", doc: "URL-encodes text.", category: "string" },
  REGEX_MATCH: { name: "REGEX_MATCH", signature: "REGEX_MATCH(text, pattern)", returnType: "boolean", doc: "True if pattern matches text.", category: "string" },
  REGEX_REPLACE: { name: "REGEX_REPLACE", signature: "REGEX_REPLACE(text, pattern, replacement)", returnType: "string", doc: "Replaces matches using pattern.", category: "string" },

  // ── Date ────────────────────────────────────────────────────
  TODAY: { name: "TODAY", signature: "TODAY()", returnType: "date", doc: "Today's date at midnight.", category: "date" },
  NOW: { name: "NOW", signature: "NOW()", returnType: "date", doc: "Current date and time.", category: "date" },
  DATE_ADD: { name: "DATE_ADD", signature: "DATE_ADD(date, amount, unit)", returnType: "date", doc: "Adds a duration (unit: day/week/month/year/hour/minute).", category: "date" },
  DATE_SUB: { name: "DATE_SUB", signature: "DATE_SUB(date, amount, unit)", returnType: "date", doc: "Subtracts a duration.", category: "date" },
  DATE_BETWEEN: { name: "DATE_BETWEEN", signature: "DATE_BETWEEN(a, b, unit?)", returnType: "number", doc: "Difference between dates (default unit: day).", category: "date" },
  FORMAT_DATE: { name: "FORMAT_DATE", signature: "FORMAT_DATE(date, pattern)", returnType: "string", doc: "Formats date using a dayjs pattern.", category: "date" },
  PARSE_DATE: { name: "PARSE_DATE", signature: "PARSE_DATE(text, pattern?)", returnType: "date", doc: "Parses text into a date.", category: "date" },
  YEAR: { name: "YEAR", signature: "YEAR(date)", returnType: "number", doc: "Year component.", category: "date" },
  MONTH: { name: "MONTH", signature: "MONTH(date)", returnType: "number", doc: "Month (1–12).", category: "date" },
  DAY: { name: "DAY", signature: "DAY(date)", returnType: "number", doc: "Day of month (1–31).", category: "date" },
  HOUR: { name: "HOUR", signature: "HOUR(date)", returnType: "number", doc: "Hour (0–23).", category: "date" },
  MINUTE: { name: "MINUTE", signature: "MINUTE(date)", returnType: "number", doc: "Minute (0–59).", category: "date" },
  WEEK: { name: "WEEK", signature: "WEEK(date)", returnType: "number", doc: "ISO week number.", category: "date" },
  WEEKDAY_NAME: { name: "WEEKDAY_NAME", signature: "WEEKDAY_NAME(date)", returnType: "string", doc: "Localized weekday name.", category: "date" },
  ISO_WEEK: { name: "ISO_WEEK", signature: "ISO_WEEK(date)", returnType: "string", doc: "ISO week string (YYYY-Www).", category: "date" },
  END_OF_MONTH: { name: "END_OF_MONTH", signature: "END_OF_MONTH(date)", returnType: "date", doc: "Last day of the date's month.", category: "date" },
  DAYS: { name: "DAYS", signature: "DAYS(from, to)", returnType: "number", doc: "Whole days between two dates.", category: "date" },
  HOURS: { name: "HOURS", signature: "HOURS(from, to)", returnType: "number", doc: "Whole hours between two dates.", category: "date" },
  MINUTES: { name: "MINUTES", signature: "MINUTES(from, to)", returnType: "number", doc: "Whole minutes between two dates.", category: "date" },
  TO_DAYS: { name: "TO_DAYS", signature: "TO_DAYS(ms)", returnType: "number", doc: "Converts milliseconds to days.", category: "date" },
  TO_HOURS: { name: "TO_HOURS", signature: "TO_HOURS(ms)", returnType: "number", doc: "Converts milliseconds to hours.", category: "date" },
  WORKDAYS: { name: "WORKDAYS", signature: "WORKDAYS(from, to)", returnType: "number", doc: "Business days (Mon–Fri) between dates.", category: "date" },

  // ── Conversion ──────────────────────────────────────────────
  TO_NUMBER: { name: "TO_NUMBER", signature: "TO_NUMBER(value)", returnType: "number", doc: "Coerces value to a number (null if not parseable).", category: "conversion" },
  TO_TEXT: { name: "TO_TEXT", signature: "TO_TEXT(value)", returnType: "string", doc: "Coerces value to a string.", category: "conversion" },
  TO_DATE: { name: "TO_DATE", signature: "TO_DATE(value)", returnType: "date", doc: "Coerces value to a date.", category: "conversion" },
  TO_CURRENCY: { name: "TO_CURRENCY", signature: "TO_CURRENCY(value, currency?)", returnType: "string", doc: "Formats number as currency (default USD).", category: "conversion" },
  TO_PERCENT: { name: "TO_PERCENT", signature: "TO_PERCENT(value, decimals?)", returnType: "string", doc: "Formats number as percent.", category: "conversion" },

  // ── Financial ───────────────────────────────────────────────
  PMT: { name: "PMT", signature: "PMT(rate, nper, pv, fv?, type?)", returnType: "number", doc: "Periodic loan payment.", category: "financial" },
  FV: { name: "FV", signature: "FV(rate, nper, pmt, pv?, type?)", returnType: "number", doc: "Future value.", category: "financial" },
  PV: { name: "PV", signature: "PV(rate, nper, pmt, fv?, type?)", returnType: "number", doc: "Present value.", category: "financial" },
  NPV: { name: "NPV", signature: "NPV(rate, cashflows...)", returnType: "number", doc: "Net present value of cash flows.", category: "financial" },
  IRR: { name: "IRR", signature: "IRR(cashflows, guess?)", returnType: "number", doc: "Internal rate of return.", category: "financial" },
  RATE: { name: "RATE", signature: "RATE(nper, pmt, pv, fv?, type?, guess?)", returnType: "number", doc: "Periodic interest rate.", category: "financial" },
  IPMT: { name: "IPMT", signature: "IPMT(rate, period, nper, pv, fv?, type?)", returnType: "number", doc: "Interest portion of a payment.", category: "financial" },
  PPMT: { name: "PPMT", signature: "PPMT(rate, period, nper, pv, fv?, type?)", returnType: "number", doc: "Principal portion of a payment.", category: "financial" },
  NPER: { name: "NPER", signature: "NPER(rate, pmt, pv, fv?, type?)", returnType: "number", doc: "Number of periods.", category: "financial" },
  CUMPRINC: { name: "CUMPRINC", signature: "CUMPRINC(rate, nper, pv, start, end, type?)", returnType: "number", doc: "Cumulative principal between periods.", category: "financial" },
  CUMIPMT: { name: "CUMIPMT", signature: "CUMIPMT(rate, nper, pv, start, end, type?)", returnType: "number", doc: "Cumulative interest between periods.", category: "financial" },

  // ── Statistical ─────────────────────────────────────────────
  SUM: { name: "SUM", signature: "SUM(values...)", returnType: "number", doc: "Sum of numeric values.", category: "statistical" },
  AVG: { name: "AVG", signature: "AVG(values...)", returnType: "number", doc: "Arithmetic mean.", category: "statistical" },
  COUNT: { name: "COUNT", signature: "COUNT(values...)", returnType: "number", doc: "Count of non-null values.", category: "statistical" },
  MIN: { name: "MIN", signature: "MIN(values...)", returnType: "number", doc: "Minimum numeric value.", category: "statistical" },
  MAX: { name: "MAX", signature: "MAX(values...)", returnType: "number", doc: "Maximum numeric value.", category: "statistical" },
  STD_DEV: { name: "STD_DEV", signature: "STD_DEV(values...)", returnType: "number", doc: "Population standard deviation.", category: "statistical" },
  STD_DEV_S: { name: "STD_DEV_S", signature: "STD_DEV_S(values...)", returnType: "number", doc: "Sample standard deviation.", category: "statistical" },
  VARIANCE: { name: "VARIANCE", signature: "VARIANCE(values...)", returnType: "number", doc: "Population variance.", category: "statistical" },
  VARIANCE_S: { name: "VARIANCE_S", signature: "VARIANCE_S(values...)", returnType: "number", doc: "Sample variance.", category: "statistical" },
  MEDIAN: { name: "MEDIAN", signature: "MEDIAN(values...)", returnType: "number", doc: "Median value.", category: "statistical" },
  MODE: { name: "MODE", signature: "MODE(values...)", returnType: "number", doc: "Most frequent value.", category: "statistical" },
  PERCENTILE: { name: "PERCENTILE", signature: "PERCENTILE(values, k)", returnType: "number", doc: "k-th percentile (0..1).", category: "statistical" },
  QUARTILE: { name: "QUARTILE", signature: "QUARTILE(values, quart)", returnType: "number", doc: "Quartile (0..4).", category: "statistical" },
  CORREL: { name: "CORREL", signature: "CORREL(xs, ys)", returnType: "number", doc: "Pearson correlation coefficient.", category: "statistical" },
  RANK: { name: "RANK", signature: "RANK(value, values, asc?)", returnType: "number", doc: "Rank of value within list.", category: "statistical" },
  SUMIF: { name: "SUMIF", signature: "SUMIF(values, predicate)", returnType: "number", doc: "Sum of values where predicate holds.", category: "statistical" },
  COUNTIF: { name: "COUNTIF", signature: "COUNTIF(values, predicate)", returnType: "number", doc: "Count of values where predicate holds.", category: "statistical" },
  AVERAGEIF: { name: "AVERAGEIF", signature: "AVERAGEIF(values, predicate)", returnType: "number", doc: "Mean of values where predicate holds.", category: "statistical" },

  // ── Array / higher-order ───────────────────────────────────
  MAP: { name: "MAP", signature: "MAP(array, var, expr)", returnType: "array", doc: "Maps each item via expression. Example: `MAP(sets, s, s.weight)`.", category: "array" },
  FILTER: { name: "FILTER", signature: "FILTER(array, var, predicate)", returnType: "array", doc: "Keeps items matching predicate.", category: "array" },
  REDUCE: { name: "REDUCE", signature: "REDUCE(array, var, acc, init, expr)", returnType: "any", doc: "Reduces array using accumulator expression.", category: "array" },
  ZIP: { name: "ZIP", signature: "ZIP(array1, array2, ...)", returnType: "array", doc: "Combines N lists pairwise into a list of N-tuples. Truncates to the shortest input.", category: "array" },
  EXTRACT: { name: "EXTRACT", signature: "EXTRACT(array, index)", returnType: "any", doc: "Returns the element at `index` (0-based, negative counts from end).", category: "array" },

  // ── Utility ────────────────────────────────────────────────
  LET: { name: "LET", signature: "LET(name, value, body)", returnType: "any", doc: "Binds a variable; evaluates body with the binding in scope.", category: "utility" },
  LETS: { name: "LETS", signature: "LETS(name1, val1, ..., nameN, valN, body)", returnType: "any", doc: "Binds multiple variables in sequence; evaluates body with all bindings in scope.", category: "utility" },
  PROP: { name: "PROP", signature: 'PROP("fieldName")', returnType: "any", doc: "Returns the value of a field by name. Equivalent to a bare field reference but allows dynamic names.", category: "utility" },
  ID: { name: "ID", signature: "ID()", returnType: "string", doc: "Returns the unique identifier of the current record.", category: "utility" },
  STYLE: { name: "STYLE", signature: "STYLE(text, color?, weight?)", returnType: "styled", doc: "Wraps text with a visual CSS class (color/weight whitelist).", category: "utility" },
};

/**
 * Look up metadata for a function by name (case-insensitive).
 * Returns undefined if the name is not a recognised formula function.
 */
export function getFormulaMetadata(name: string): FormulaMetadata | undefined {
  if (!name) return undefined;
  return M[name.toUpperCase()];
}

/**
 * All registered formula function metadata entries.
 */
export function getAllFormulaMetadata(): readonly FormulaMetadata[] {
  return Object.values(M);
}

/**
 * Walks backwards from `cursor` through `source` to find the name of the
 * innermost function call whose opening `(` has not yet been closed.
 * Used by FormulaBar to pick the signature popover when typing inside a call.
 *
 * String-literal aware: skips parentheses that sit inside "..." / '...' spans,
 * respecting backslash escapes.
 */
export function findEnclosingCall(source: string, cursor: number): string | null {
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
