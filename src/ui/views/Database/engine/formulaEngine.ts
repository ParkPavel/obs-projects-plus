// src/ui/views/Database/engine/formulaEngine.ts
// Extended formula evaluator for FormulaField (computed columns).
// Returns DataValue (not boolean) — builds on existing formulaParser AST.

import type { DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { type FormulaNode, parseFormula, tokenize } from "src/lib/helpers/formulaParser";
import { isUnsafePattern, MAX_REGEX_INPUT_LENGTH } from "src/lib/helpers/regexSafety";
import dayjs from "dayjs";

// ── Styled value support ─────────────────────────────────────

/** Result of style() formula — carries CSS class info for visual rendering */
export interface StyledValue {
  __styled: true;
  text: string;
  cssClass: string;
}

export function isStyledValue(v: unknown): v is StyledValue {
  return v != null && typeof v === "object" && (v as StyledValue).__styled === true;
}

/** Allowed color names → CSS class mapping (security whitelist) */
const STYLE_COLORS: Record<string, string> = {
  red: "ppp-formula-red",
  orange: "ppp-formula-orange",
  yellow: "ppp-formula-yellow",
  green: "ppp-formula-green",
  blue: "ppp-formula-blue",
  purple: "ppp-formula-purple",
  pink: "ppp-formula-pink",
  gray: "ppp-formula-gray",
  grey: "ppp-formula-gray",
};
const STYLE_WEIGHTS: Record<string, string> = {
  b: "ppp-formula-bold",
  bold: "ppp-formula-bold",
  i: "ppp-formula-italic",
  italic: "ppp-formula-italic",
  s: "ppp-formula-strikethrough",
  strikethrough: "ppp-formula-strikethrough",
  u: "ppp-formula-underline",
  underline: "ppp-formula-underline",
};

function buildSafeClass(color?: string, weight?: string): string {
  const parts: string[] = [];
  if (color) {
    const cls = STYLE_COLORS[color.toLowerCase()];
    if (cls) parts.push(cls);
  }
  if (weight) {
    const cls = STYLE_WEIGHTS[weight.toLowerCase()];
    if (cls) parts.push(cls);
  }
  return parts.join(" ");
}

// ── Formula result with error tracking ───────────────────────

/** Extended result type that carries error information */
export interface FormulaResult {
  value: Optional<DataValue>;
  error?: string;
}

// ── Extended function registry ───────────────────────────────

/**
 * All functions supported in FormulaField expressions.
 * Format: FUNCTION_NAME → handler(args, evaluate)
 * Evaluate function includes scope for LET variable binding.
 */
type FormulaFn = (
  args: FormulaNode[],
  evaluate: (node: FormulaNode) => Optional<DataValue>
) => Optional<DataValue>;

// ── Financial helpers (shared across PMT/IPMT/PPMT/CUMPRINC/CUMIPMT) ──

/** Core PMT calculation: payment per period */
function pmtCore(rate: number, nper: number, pv: number, fv: number, type: number): number {
  if (rate === 0) return -(pv + fv) / nper;
  const pvif = Math.pow(1 + rate, nper);
  return -(rate * (pv * pvif + fv)) / (pvif - 1) / (1 + rate * type);
}

/** Future value at period (per-1): used for interest/principal split */
function fvBeforePeriod(rate: number, per: number, pv: number, pmt: number, type: number): number {
  if (rate === 0) return -(pv + pmt * (per - 1));
  return -(pv * Math.pow(1 + rate, per - 1) + pmt * (1 + rate * type) * ((Math.pow(1 + rate, per - 1) - 1) / rate));
}

/** Interest portion for a single period */
function ipmtForPeriod(rate: number, per: number, pv: number, pmt: number, type: number): number {
  const fvBefore = fvBeforePeriod(rate, per, pv, pmt, type);
  if (type === 1 && per === 1) return 0;
  if (type === 1) return (fvBefore - pmt) * rate;
  return fvBefore * rate;
}

const EXTENDED_FUNCTIONS: Record<string, FormulaFn> = {
  // ── Existing (re-export for completeness) ──────────────────
  IF: (args, evaluate) => {
    if (args.length < 2) return null;
    const cond = evaluate(args[0] as FormulaNode);
    return cond ? evaluate(args[1] as FormulaNode) : (args[2] ? evaluate(args[2] as FormulaNode) : null);
  },

  IFS: (args, evaluate) => {
    // IFS(cond1, val1, cond2, val2, ...)
    for (let i = 0; i + 1 < args.length; i += 2) {
      if (evaluate(args[i] as FormulaNode)) {
        return evaluate(args[i + 1] as FormulaNode);
      }
    }
    return null;
  },

  SWITCH: (args, evaluate) => {
    // SWITCH(expr, case1, val1, case2, val2, ..., default?)
    if (args.length < 3) return null;
    const expr = evaluate(args[0] as FormulaNode);
    for (let i = 1; i + 1 < args.length; i += 2) {
      if (String(evaluate(args[i] as FormulaNode)) === String(expr)) {
        return evaluate(args[i + 1] as FormulaNode);
      }
    }
    // Odd remaining arg = default
    if (args.length % 2 === 0) {
      return evaluate(args[args.length - 1] as FormulaNode);
    }
    return null;
  },

  AND: (args, evaluate) => args.every((a) => Boolean(evaluate(a))),
  OR: (args, evaluate) => args.some((a) => Boolean(evaluate(a))),
  NOT: (args, evaluate) => !evaluate(args[0] as FormulaNode),

  EMPTY: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    return val == null || val === "" || (Array.isArray(val) && val.length === 0);
  },

  // ── Math ───────────────────────────────────────────────────
  ROUND: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    const decimals = args[1] ? Number(evaluate(args[1] as FormulaNode)) : 0;
    if (isNaN(val)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  },

  CEIL: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    return isNaN(val) ? null : Math.ceil(val);
  },

  FLOOR: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    return isNaN(val) ? null : Math.floor(val);
  },

  ABS: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    return isNaN(val) ? null : Math.abs(val);
  },

  SQRT: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    return isNaN(val) || val < 0 ? null : Math.sqrt(val);
  },

  POWER: (args, evaluate) => {
    const base = Number(evaluate(args[0] as FormulaNode));
    const exp = Number(evaluate(args[1] as FormulaNode));
    if (isNaN(base) || isNaN(exp)) return null;
    const result = Math.pow(base, exp);
    return isFinite(result) ? result : null;
  },

  LOG: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    if (isNaN(val) || val <= 0) return null;
    const base = args[1] ? Number(evaluate(args[1] as FormulaNode)) : Math.E;
    if (base <= 0 || base === 1) return null;
    return base === Math.E ? Math.log(val) : Math.log(val) / Math.log(base);
  },

  SIGN: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    return isNaN(val) ? null : Math.sign(val);
  },

  // ── String ─────────────────────────────────────────────────
  TRIM: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    return val != null ? String(val).trim() : null;
  },

  LOWER: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    return val != null ? String(val).toLowerCase() : null;
  },

  UPPER: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    return val != null ? String(val).toUpperCase() : null;
  },

  LENGTH: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    return val != null ? String(val).length : 0;
  },

  SUBSTRING: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const start = Number(evaluate(args[1] as FormulaNode));
    const end = args[2] ? Number(evaluate(args[2] as FormulaNode)) : undefined;
    return str.substring(start, end);
  },

  REPLACE: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const search = String(evaluate(args[1] as FormulaNode) ?? "");
    const replacement = String(evaluate(args[2] as FormulaNode) ?? "");
    return str.split(search).join(replacement);
  },

  CONTAINS: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "").toLowerCase();
    const sub = String(evaluate(args[1] as FormulaNode) ?? "").toLowerCase();
    return str.includes(sub);
  },

  STARTS_WITH: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const prefix = String(evaluate(args[1] as FormulaNode) ?? "");
    return str.startsWith(prefix);
  },

  ENDS_WITH: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const suffix = String(evaluate(args[1] as FormulaNode) ?? "");
    return str.endsWith(suffix);
  },

  SPLIT: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const delim = String(evaluate(args[1] as FormulaNode) ?? ",");
    return str.split(delim) as unknown as DataValue;
  },

  FORMAT: (args, evaluate) => {
    // FORMAT(value, pattern) — basic number formatting
    const val = evaluate(args[0] as FormulaNode);
    if (val == null) return "";
    return String(val);
  },

  // ── Date ───────────────────────────────────────────────────
  TODAY: () => dayjs().format("YYYY-MM-DD"),
  NOW: () => dayjs().toISOString(),

  DATE_ADD: (args, evaluate) => {
    const date = dayjs(String(evaluate(args[0] as FormulaNode)));
    const amount = Number(evaluate(args[1] as FormulaNode));
    const unit = String(evaluate(args[2] as FormulaNode)) as dayjs.ManipulateType;
    if (!date.isValid() || isNaN(amount)) return null;
    return date.add(amount, unit).format("YYYY-MM-DD");
  },

  DATE_SUB: (args, evaluate) => {
    const date = dayjs(String(evaluate(args[0] as FormulaNode)));
    const amount = Number(evaluate(args[1] as FormulaNode));
    const unit = String(evaluate(args[2] as FormulaNode)) as dayjs.ManipulateType;
    if (!date.isValid() || isNaN(amount)) return null;
    return date.subtract(amount, unit).format("YYYY-MM-DD");
  },

  DATE_BETWEEN: (args, evaluate) => {
    const d1 = dayjs(String(evaluate(args[0] as FormulaNode)));
    const d2 = dayjs(String(evaluate(args[1] as FormulaNode)));
    const unit = (args[2] ? String(evaluate(args[2] as FormulaNode)) : "day") as dayjs.QUnitType;
    if (!d1.isValid() || !d2.isValid()) return null;
    return d2.diff(d1, unit);
  },

  FORMAT_DATE: (args, evaluate) => {
    const date = dayjs(String(evaluate(args[0] as FormulaNode)));
    const fmt = String(evaluate(args[1] as FormulaNode) ?? "YYYY-MM-DD");
    return date.isValid() ? date.format(fmt) : null;
  },

  PARSE_DATE: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const d = dayjs(str);
    return d.isValid() ? d.format("YYYY-MM-DD") : null;
  },

  YEAR: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    return d.isValid() ? d.year() : null;
  },

  MONTH: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    return d.isValid() ? d.month() + 1 : null;
  },

  DAY: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    return d.isValid() ? d.date() : null;
  },

  HOUR: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    return d.isValid() ? d.hour() : null;
  },

  MINUTE: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    return d.isValid() ? d.minute() : null;
  },

  WEEK: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    if (!d.isValid()) return null;
    // ISO 8601 week number — Thursday rule
    const date = d.toDate();
    const thu = new Date(date.getTime());
    thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7));
    const jan4 = new Date(thu.getFullYear(), 0, 4);
    return 1 + Math.round(((thu.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  },

  // ── Type conversion ────────────────────────────────────────
  TO_NUMBER: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    if (val == null) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  },

  TO_TEXT: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    return val != null ? String(val) : "";
  },

  TO_DATE: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    if (val == null) return null;
    const d = dayjs(String(val));
    return d.isValid() ? d.format("YYYY-MM-DD") : null;
  },

  // ── Financial ──────────────────────────────────────────────

  /** Payment for a loan: PMT(rate, nper, pv, [fv], [type]) */
  PMT: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    const nper = Number(evaluate(args[1] as FormulaNode));
    const pv = Number(evaluate(args[2] as FormulaNode));
    const fv = args[3] ? Number(evaluate(args[3] as FormulaNode)) : 0;
    const type = args[4] ? Number(evaluate(args[4] as FormulaNode)) : 0;
    if (isNaN(rate) || isNaN(nper) || isNaN(pv) || nper === 0) return null;
    return pmtCore(rate, nper, pv, fv, type);
  },

  /** Future value: FV(rate, nper, pmt, [pv], [type]) */
  FV: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    const nper = Number(evaluate(args[1] as FormulaNode));
    const pmt = Number(evaluate(args[2] as FormulaNode));
    const pv = args[3] ? Number(evaluate(args[3] as FormulaNode)) : 0;
    const type = args[4] ? Number(evaluate(args[4] as FormulaNode)) : 0;
    if (isNaN(rate) || isNaN(nper) || isNaN(pmt)) return null;
    if (rate === 0) return -(pv + pmt * nper);
    const pvif = Math.pow(1 + rate, nper);
    return -(pv * pvif + pmt * (1 + rate * type) * ((pvif - 1) / rate));
  },

  /** Present value: PV(rate, nper, pmt, [fv], [type]) */
  PV: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    const nper = Number(evaluate(args[1] as FormulaNode));
    const pmt = Number(evaluate(args[2] as FormulaNode));
    const fv = args[3] ? Number(evaluate(args[3] as FormulaNode)) : 0;
    const type = args[4] ? Number(evaluate(args[4] as FormulaNode)) : 0;
    if (isNaN(rate) || isNaN(nper) || isNaN(pmt)) return null;
    if (rate === 0) return -(fv + pmt * nper);
    const pvif = Math.pow(1 + rate, nper);
    return -(pmt * (1 + rate * type) * ((pvif - 1) / rate) + fv) / pvif;
  },

  /** Net present value: NPV(rate, cf1, cf2, ...) */
  NPV: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    if (isNaN(rate) || rate === -1) return null;
    let npv = 0;
    for (let i = 1; i < args.length; i++) {
      const cf = Number(evaluate(args[i] as FormulaNode));
      if (isNaN(cf)) return null;
      npv += cf / Math.pow(1 + rate, i);
    }
    return npv;
  },

  /** Internal rate of return: IRR(cf1, cf2, ..., [guess]) — Newton-Raphson */
  IRR: (args, evaluate) => {
    // Collect cash flows
    const cfs: number[] = [];
    let guess = 0.1;
    for (let i = 0; i < args.length; i++) {
      const val = Number(evaluate(args[i] as FormulaNode));
      if (isNaN(val)) return null;
      cfs.push(val);
    }
    // Last arg might be guess if there are sign changes in the rest
    if (cfs.length >= 3) {
      const last = cfs[cfs.length - 1]!;
      if (Math.abs(last) < 1) {
        // Heuristic: if last value looks like a guess (< 1), use it
        // But only if removing it still leaves valid cash flows
        const remaining = cfs.slice(0, -1);
        const hasPos = remaining.some(v => v > 0);
        const hasNeg = remaining.some(v => v < 0);
        if (hasPos && hasNeg) {
          guess = last;
          cfs.pop();
        }
      }
    }

    let rate = guess;
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0, dnpv = 0;
      for (let i = 0; i < cfs.length; i++) {
        const pow = Math.pow(1 + rate, i);
        npv += cfs[i]! / pow;
        dnpv -= i * cfs[i]! / (pow * (1 + rate));
      }
      if (Math.abs(npv) < 1e-7) return rate;
      if (dnpv === 0) return null;
      rate -= npv / dnpv;
      if (!isFinite(rate)) return null;
    }
    return null; // Did not converge
  },

  /** Interest rate per period: RATE(nper, pmt, pv, [fv], [type], [guess]) — Newton-Raphson */
  RATE: (args, evaluate) => {
    const nper = Number(evaluate(args[0] as FormulaNode));
    const pmt = Number(evaluate(args[1] as FormulaNode));
    const pv = Number(evaluate(args[2] as FormulaNode));
    const fv = args[3] ? Number(evaluate(args[3] as FormulaNode)) : 0;
    const type = args[4] ? Number(evaluate(args[4] as FormulaNode)) : 0;
    let rate = args[5] ? Number(evaluate(args[5] as FormulaNode)) : 0.1;
    if (isNaN(nper) || isNaN(pmt) || isNaN(pv) || nper <= 0) return null;

    for (let iter = 0; iter < 100; iter++) {
      if (rate === 0) {
        // Special case
        const f = pv + pmt * nper + fv;
        if (Math.abs(f) < 1e-7) return 0;
        rate = 0.001; // nudge
        continue;
      }
      const pvif = Math.pow(1 + rate, nper);
      const y = pv * pvif + pmt * (1 + rate * type) * ((pvif - 1) / rate) + fv;
      // Derivative
      const dy = nper * pv * Math.pow(1 + rate, nper - 1)
        + pmt * type * ((pvif - 1) / rate)
        + pmt * (1 + rate * type) * (nper * Math.pow(1 + rate, nper - 1) / rate - (pvif - 1) / (rate * rate));
      if (Math.abs(y) < 1e-7) return rate;
      if (dy === 0) return null;
      rate -= y / dy;
      if (!isFinite(rate)) return null;
    }
    return null;
  },

  /** Interest portion: IPMT(rate, per, nper, pv, [fv], [type]) */
  IPMT: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    const per = Number(evaluate(args[1] as FormulaNode));
    const nper = Number(evaluate(args[2] as FormulaNode));
    const pv = Number(evaluate(args[3] as FormulaNode));
    const fv = args[4] ? Number(evaluate(args[4] as FormulaNode)) : 0;
    const type = args[5] ? Number(evaluate(args[5] as FormulaNode)) : 0;
    if (isNaN(rate) || isNaN(per) || isNaN(nper) || per < 1 || per > nper) return null;
    const pmt = pmtCore(rate, nper, pv, fv, type);
    return ipmtForPeriod(rate, per, pv, pmt, type);
  },

  /** Principal portion: PPMT(rate, per, nper, pv, [fv], [type]) */
  PPMT: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    const per = Number(evaluate(args[1] as FormulaNode));
    const nper = Number(evaluate(args[2] as FormulaNode));
    const pv = Number(evaluate(args[3] as FormulaNode));
    const fv = args[4] ? Number(evaluate(args[4] as FormulaNode)) : 0;
    const type = args[5] ? Number(evaluate(args[5] as FormulaNode)) : 0;
    if (isNaN(rate) || isNaN(per) || isNaN(nper) || per < 1 || per > nper) return null;
    const pmt = pmtCore(rate, nper, pv, fv, type);
    return pmt - ipmtForPeriod(rate, per, pv, pmt, type);
  },

  /** Number of periods: NPER(rate, pmt, pv, [fv], [type]) */
  NPER: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    const pmt = Number(evaluate(args[1] as FormulaNode));
    const pv = Number(evaluate(args[2] as FormulaNode));
    const fv = args[3] ? Number(evaluate(args[3] as FormulaNode)) : 0;
    const type = args[4] ? Number(evaluate(args[4] as FormulaNode)) : 0;
    if (isNaN(rate) || isNaN(pmt) || isNaN(pv)) return null;
    if (rate === 0) {
      if (pmt === 0) return null;
      return -(pv + fv) / pmt;
    }
    const z = pmt * (1 + rate * type);
    const num = z - fv * rate;
    const den = pv * rate + z;
    if (num <= 0 || den <= 0 || num / den <= 0) return null;
    return Math.log(num / den) / Math.log(1 + rate);
  },

  /** Cumulative principal: CUMPRINC(rate, nper, pv, start, end, type) */
  CUMPRINC: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    const nper = Number(evaluate(args[1] as FormulaNode));
    const pv = Number(evaluate(args[2] as FormulaNode));
    const start = Number(evaluate(args[3] as FormulaNode));
    const end = Number(evaluate(args[4] as FormulaNode));
    const type = Number(evaluate(args[5] as FormulaNode));
    if (isNaN(rate) || isNaN(nper) || isNaN(pv) || rate <= 0 || nper <= 0 || pv <= 0) return null;
    if (start < 1 || end < start || end > nper) return null;
    const pmt = pmtCore(rate, nper, pv, 0, type);
    let cum = 0;
    for (let per = start; per <= end; per++) {
      cum += pmt - ipmtForPeriod(rate, per, pv, pmt, type);
    }
    return cum;
  },

  /** Cumulative interest: CUMIPMT(rate, nper, pv, start, end, type) */
  CUMIPMT: (args, evaluate) => {
    const rate = Number(evaluate(args[0] as FormulaNode));
    const nper = Number(evaluate(args[1] as FormulaNode));
    const pv = Number(evaluate(args[2] as FormulaNode));
    const start = Number(evaluate(args[3] as FormulaNode));
    const end = Number(evaluate(args[4] as FormulaNode));
    const type = Number(evaluate(args[5] as FormulaNode));
    if (isNaN(rate) || isNaN(nper) || isNaN(pv) || rate <= 0 || nper <= 0 || pv <= 0) return null;
    if (start < 1 || end < start || end > nper) return null;
    const pmt = pmtCore(rate, nper, pv, 0, type);
    let cum = 0;
    for (let per = start; per <= end; per++) {
      cum += ipmtForPeriod(rate, per, pv, pmt, type);
    }
    return cum;
  },

  // ── Statistical ────────────────────────────────────────────

  /** Population variance */
  VARIANCE: (args, evaluate) => {
    const nums = args.map(a => Number(evaluate(a))).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
    return nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length;
  },

  /** Sample variance */
  VARIANCE_S: (args, evaluate) => {
    const nums = args.map(a => Number(evaluate(a))).filter(n => !isNaN(n));
    if (nums.length < 2) return null;
    const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
    return nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (nums.length - 1);
  },

  /** k-th percentile (k in 0-1) */
  PERCENTILE: (args, evaluate) => {
    if (args.length < 2) return null;
    const arr = args.slice(0, -1).map(a => Number(evaluate(a))).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const k = Number(evaluate(args[args.length - 1] as FormulaNode));
    if (arr.length === 0 || isNaN(k) || k < 0 || k > 1) return null;
    if (arr.length === 1) return arr[0]!;
    const idx = k * (arr.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return arr[lo]! + (arr[hi]! - arr[lo]!) * (idx - lo);
  },

  /** Quartile (quart: 0-4) */
  QUARTILE: (args, evaluate) => {
    if (args.length < 2) return null;
    const arr = args.slice(0, -1).map(a => Number(evaluate(a))).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const q = Number(evaluate(args[args.length - 1] as FormulaNode));
    if (arr.length === 0 || isNaN(q) || q < 0 || q > 4) return null;
    const k = q / 4;
    if (arr.length === 1) return arr[0]!;
    const idx = k * (arr.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return arr[lo]! + (arr[hi]! - arr[lo]!) * (idx - lo);
  },

  /** Pearson correlation */
  CORREL: (args, evaluate) => {
    // CORREL(x1, y1, x2, y2, ...) — alternating x/y pairs
    if (args.length < 4 || args.length % 2 !== 0) return null;
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < args.length; i += 2) {
      const x = Number(evaluate(args[i] as FormulaNode));
      const y = Number(evaluate(args[i + 1] as FormulaNode));
      if (!isNaN(x) && !isNaN(y)) { xs.push(x); ys.push(y); }
    }
    if (xs.length < 2) return null;
    const n = xs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i]! - mx, dy = ys[i]! - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    const denom = Math.sqrt(sxx * syy);
    return denom === 0 ? null : sxy / denom;
  },

  /** Most frequent value */
  MODE: (args, evaluate) => {
    const nums = args.map(a => Number(evaluate(a))).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    const freq = new Map<number, number>();
    for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1);
    let maxFreq = 0, mode: number | null = null;
    for (const [val, count] of freq) {
      if (count > maxFreq) { maxFreq = count; mode = val; }
    }
    return maxFreq > 1 ? mode : null; // No mode if all unique
  },

  /** Rank of value in array: RANK(value, v1, v2, ..., [order]) */
  RANK: (args, evaluate) => {
    if (args.length < 2) return null;
    const value = Number(evaluate(args[0] as FormulaNode));
    if (isNaN(value)) return null;
    // Last arg might be order (0=desc, 1=asc) if it's 0 or 1
    const allVals = args.slice(1).map(a => Number(evaluate(a))).filter(n => !isNaN(n));
    const sorted = [...allVals].sort((a, b) => b - a); // desc by default
    const idx = sorted.indexOf(value);
    return idx === -1 ? null : idx + 1;
  },

  /** Sample standard deviation */
  STD_DEV_S: (args, evaluate) => {
    const nums = args.map(a => Number(evaluate(a))).filter(n => !isNaN(n));
    if (nums.length < 2) return null;
    const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
    return Math.sqrt(nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (nums.length - 1));
  },

  // ── Enhanced Math ──────────────────────────────────────────

  MEDIAN: (args, evaluate) => {
    const nums = args.map(a => Number(evaluate(a))).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length === 0) return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 === 0 ? ((nums[mid - 1]! + nums[mid]!) / 2) : nums[mid]!;
  },

  PRODUCT: (args, evaluate) => {
    const nums = args.map(a => Number(evaluate(a))).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    return nums.reduce((p, v) => p * v, 1);
  },

  MOD: (args, evaluate) => {
    const a = Number(evaluate(args[0] as FormulaNode));
    const b = Number(evaluate(args[1] as FormulaNode));
    if (isNaN(a) || isNaN(b) || b === 0) return null;
    return a % b;
  },

  EVEN: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    if (isNaN(val)) return null;
    const c = Math.ceil(Math.abs(val));
    const even = c % 2 === 0 ? c : c + 1;
    return val >= 0 ? even : -even;
  },

  ODD: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    if (isNaN(val)) return null;
    const c = Math.ceil(Math.abs(val));
    const odd = c % 2 === 1 ? c : c + 1;
    return val >= 0 ? odd : -odd;
  },

  PI: () => Math.PI,

  RANDOM_INT: (args, evaluate) => {
    const min = Number(evaluate(args[0] as FormulaNode));
    const max = Number(evaluate(args[1] as FormulaNode));
    if (isNaN(min) || isNaN(max)) return null;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // ── Enhanced String ────────────────────────────────────────

  LEFT: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const n = args[1] ? Number(evaluate(args[1] as FormulaNode)) : 1;
    return str.substring(0, n);
  },

  RIGHT: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const n = args[1] ? Number(evaluate(args[1] as FormulaNode)) : 1;
    return str.substring(Math.max(0, str.length - n));
  },

  MID: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const start = Number(evaluate(args[1] as FormulaNode));
    const len = Number(evaluate(args[2] as FormulaNode));
    if (isNaN(start) || isNaN(len)) return null;
    return str.substring(start, start + len);
  },

  REGEX_MATCH: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const pattern = String(evaluate(args[1] as FormulaNode) ?? "");
    if (!pattern || pattern.length > 200 || isUnsafePattern(pattern)) return false;
    if (str.length > MAX_REGEX_INPUT_LENGTH) return false;
    try { return new RegExp(pattern).test(str); } catch { return false; }
  },

  REGEX_REPLACE: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const pattern = String(evaluate(args[1] as FormulaNode) ?? "");
    const replacement = String(evaluate(args[2] as FormulaNode) ?? "");
    if (!pattern || pattern.length > 200 || isUnsafePattern(pattern)) return str;
    if (str.length > MAX_REGEX_INPUT_LENGTH) return str;
    try { return str.replace(new RegExp(pattern, "g"), replacement); } catch { return str; }
  },

  JOIN: (args, evaluate) => {
    if (args.length < 2) return null;
    const delim = String(evaluate(args[0] as FormulaNode) ?? "");
    const parts = args.slice(1).map(a => String(evaluate(a) ?? ""));
    return parts.join(delim);
  },

  REPEAT: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    const n = Number(evaluate(args[1] as FormulaNode));
    if (isNaN(n) || n < 0 || n > 1000) return null;
    return str.repeat(n);
  },

  ENCODE_URL: (args, evaluate) => {
    const str = String(evaluate(args[0] as FormulaNode) ?? "");
    return encodeURIComponent(str);
  },

  // ── Conversion (enhanced) ──────────────────────────────────

  TO_CURRENCY: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    const code = args[1] ? String(evaluate(args[1] as FormulaNode)) : "USD";
    if (isNaN(val)) return null;
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(val);
    } catch { return val.toFixed(2); }
  },

  TO_PERCENT: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    if (isNaN(val)) return null;
    return `${(val * 100).toFixed(2)}%`;
  },

  // ── Logic (enhanced) ───────────────────────────────────────

  // LET, STYLE, MAP, FILTER, REDUCE are handled specially in evaluateNode
  // (they need scope access). Registered here for validation/discovery.
  LET: (_args, _evaluate) => null,
  STYLE: (_args, _evaluate) => null,
  MAP: (_args, _evaluate) => null,
  FILTER: (_args, _evaluate) => null,
  REDUCE: (_args, _evaluate) => null,

  IFBLANK: (args, evaluate) => {
    const val = evaluate(args[0] as FormulaNode);
    if (val == null || val === "" || (typeof val === "number" && isNaN(val))) {
      return args[1] ? evaluate(args[1] as FormulaNode) : null;
    }
    return val;
  },

  // ── Date (enhanced) ────────────────────────────────────────

  END_OF_MONTH: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    if (!d.isValid()) return null;
    return d.endOf("month").format("YYYY-MM-DD");
  },

  WEEKDAY_NAME: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    if (!d.isValid()) return null;
    return d.format("dddd");
  },

  ISO_WEEK: (args, evaluate) => {
    const d = dayjs(String(evaluate(args[0] as FormulaNode)));
    if (!d.isValid()) return null;
    return d.isoWeek();
  },

  // ── Duration ───────────────────────────────────────────────

  /** Create duration of n days (returns number for arithmetic) */
  DAYS: (args, evaluate) => {
    const n = Number(evaluate(args[0] as FormulaNode));
    return isNaN(n) ? null : n;
  },

  HOURS: (args, evaluate) => {
    const n = Number(evaluate(args[0] as FormulaNode));
    return isNaN(n) ? null : n / 24;
  },

  MINUTES: (args, evaluate) => {
    const n = Number(evaluate(args[0] as FormulaNode));
    return isNaN(n) ? null : n / 1440;
  },

  TO_DAYS: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    return isNaN(val) ? null : val;
  },

  TO_HOURS: (args, evaluate) => {
    const val = Number(evaluate(args[0] as FormulaNode));
    return isNaN(val) ? null : val * 24;
  },

  WORKDAYS: (args, evaluate) => {
    const startStr = String(evaluate(args[0] as FormulaNode));
    const endStr = String(evaluate(args[1] as FormulaNode));
    const start = dayjs(startStr), end = dayjs(endStr);
    if (!start.isValid() || !end.isValid()) return null;
    // Count business days (Mon-Fri) between start and end (exclusive of start, inclusive of end)
    let count = 0;
    let current = start.add(1, "day");
    const limit = Math.abs(end.diff(start, "day")) + 1;
    if (limit > 36600) return null; // Safety: max ~100 years
    while (current.isBefore(end, "day") || current.isSame(end, "day")) {
      const dow = current.day();
      if (dow !== 0 && dow !== 6) count++;
      current = current.add(1, "day");
    }
    return end.isBefore(start) ? -count : count;
  },

  // ── Conditional Aggregation ────────────────────────────────
  // Note: These operate on flat argument lists since we don't have @column references yet.
  // Usage: SUMIF(v1, v2, v3, ..., criteria) — sums values matching criteria

  SUMIF: (args, evaluate) => {
    if (args.length < 2) return null;
    const criteria = Number(evaluate(args[args.length - 1] as FormulaNode));
    let sum = 0;
    for (let i = 0; i < args.length - 1; i++) {
      const val = Number(evaluate(args[i] as FormulaNode));
      if (!isNaN(val) && val === criteria) sum += val;
    }
    return sum;
  },

  COUNTIF: (args, evaluate) => {
    if (args.length < 2) return null;
    const criteria = String(evaluate(args[args.length - 1] as FormulaNode));
    let count = 0;
    for (let i = 0; i < args.length - 1; i++) {
      const val = String(evaluate(args[i] as FormulaNode));
      if (val === criteria) count++;
    }
    return count;
  },

  AVERAGEIF: (args, evaluate) => {
    if (args.length < 2) return null;
    const criteria = Number(evaluate(args[args.length - 1] as FormulaNode));
    let sum = 0, count = 0;
    for (let i = 0; i < args.length - 1; i++) {
      const val = Number(evaluate(args[i] as FormulaNode));
      if (!isNaN(val) && val === criteria) { sum += val; count++; }
    }
    return count > 0 ? sum / count : null;
  },

  // ── Aggregate-aware functions (work with @column arrays) ───

  SUM: (args, evaluate) => {
    let total = 0;
    for (const a of args) {
      const val = evaluate(a);
      if (Array.isArray(val)) {
        for (const v of val) { const n = Number(v); if (!isNaN(n)) total += n; }
      } else {
        const n = Number(val); if (!isNaN(n)) total += n;
      }
    }
    return total;
  },

  AVG: (args, evaluate) => {
    let total = 0, count = 0;
    for (const a of args) {
      const val = evaluate(a);
      if (Array.isArray(val)) {
        for (const v of val) { const n = Number(v); if (!isNaN(n)) { total += n; count++; } }
      } else {
        const n = Number(val); if (!isNaN(n)) { total += n; count++; }
      }
    }
    return count > 0 ? total / count : null;
  },

  COUNT: (args, evaluate) => {
    let count = 0;
    for (const a of args) {
      const val = evaluate(a);
      if (Array.isArray(val)) count += val.length;
      else if (val != null) count++;
    }
    return count;
  },

  MIN: (args, evaluate) => {
    let min = Infinity;
    for (const a of args) {
      const val = evaluate(a);
      if (Array.isArray(val)) {
        for (const v of val) { const n = Number(v); if (!isNaN(n) && n < min) min = n; }
      } else {
        const n = Number(val); if (!isNaN(n) && n < min) min = n;
      }
    }
    return min === Infinity ? null : min;
  },

  MAX: (args, evaluate) => {
    let max = -Infinity;
    for (const a of args) {
      const val = evaluate(a);
      if (Array.isArray(val)) {
        for (const v of val) { const n = Number(v); if (!isNaN(n) && n > max) max = n; }
      } else {
        const n = Number(val); if (!isNaN(n) && n > max) max = n;
      }
    }
    return max === -Infinity ? null : max;
  },

  /** Population standard deviation (supports @column) */
  STD_DEV: (args, evaluate) => {
    const nums: number[] = [];
    for (const a of args) {
      const val = evaluate(a);
      if (Array.isArray(val)) {
        for (const v of val) { const n = Number(v); if (!isNaN(n)) nums.push(n); }
      } else {
        const n = Number(val); if (!isNaN(n)) nums.push(n);
      }
    }
    if (nums.length === 0) return null;
    const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
    return Math.sqrt(nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length);
  },
};

// ── Public API ───────────────────────────────────────────────

/**
 * Evaluate a formula expression and return a DataValue.
 * Unlike evaluateFormula (which returns boolean for filters),
 * this returns the actual computed value for display.
 */
export function evaluateFormulaValue(
  expression: string,
  record: DataRecord,
  dataFrame?: DataFrame
): Optional<DataValue> {
  const result = evaluateFormulaWithError(expression, record, dataFrame);
  return result.value;
}

/**
 * Evaluate with full error reporting.
 * Returns { value, error? } so callers can show diagnostics.
 */
export function evaluateFormulaWithError(
  expression: string,
  record: DataRecord,
  dataFrame?: DataFrame
): FormulaResult {
  try {
    const ast = parseFormula(expression);
    const value = evaluateNode(ast, record, dataFrame);
    return { value };
  } catch (e) {
    return {
      value: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Validate a formula expression for FormulaField.
 * Returns error messages, or empty array if valid.
 */
export function validateFormulaExpression(
  expression: string,
  availableFields: string[]
): string[] {
  const errors: string[] = [];

  try {
    const tokens = tokenize(expression);

    // Check for unknown functions
    for (const token of tokens) {
      if (token.type === "FUNCTION" && !(token.value in EXTENDED_FUNCTIONS)) {
        errors.push(`Unknown function: ${token.value}`);
      }
    }

    // Parse to AST to validate syntax + check field references
    const ast = parseFormula(expression);
    checkFieldRefs(ast, availableFields, errors);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return errors;
}

/**
 * Get list of all supported formula functions.
 */
export function getFormulaFunctions(): string[] {
  return Object.keys(EXTENDED_FUNCTIONS);
}

// ── Internal ─────────────────────────────────────────────────

const MAX_EVAL_DEPTH = 64;
const MAX_LIST_ITEMS = 10_000;

function evaluateNode(
  node: FormulaNode,
  record: DataRecord,
  dataFrame?: DataFrame,
  scope?: Map<string, DataValue>,
  depth: number = 0
): Optional<DataValue> {
  if (depth > MAX_EVAL_DEPTH) return null;
  // Cache for @column references (computed once per evaluation)
  const columnCache = new Map<string, number[]>();

  function resolveColumn(name: string): number[] {
    if (columnCache.has(name)) return columnCache.get(name)!;
    if (!dataFrame) return [];
    const vals = dataFrame.records.map(r => {
      const v = r.values[name];
      return typeof v === "number" ? v : Number(v);
    }).filter(n => !isNaN(n));
    columnCache.set(name, vals);
    return vals;
  }

   
  function evaluate(n: FormulaNode): any {
    switch (n.type) {
      case "literal":
        return n.value;

      case "field": {
        // Scope variables take precedence over record fields
        if (scope?.has(n.name)) {
          return scope.get(n.name);
        }
        const val = record.values[n.name];
        if (val === undefined) return null;
        // Strip wiki-link syntax
        if (typeof val === "string") {
          const m = val.match(/^\[\[([^\]]+)\]\]$/);
          if (m?.[1]) {
            const inner = m[1];
            const pipe = inner.indexOf("|");
            return pipe >= 0 ? inner.substring(pipe + 1) : inner;
          }
        }
        return val;
      }

      case "column_ref":
        // Returns array of all numeric values in that column
        return resolveColumn(n.name) as unknown as DataValue;

      case "array":
        return n.items.map((item) => evaluate(item));

      case "operator": {
        const left = evaluate(n.left);
        const right = evaluate(n.right);

        switch (n.operator) {
          case "=":
            return smartEq(left, right);
          case "!=":
            return !smartEq(left, right);
          case ">":
            return toNum(left) > toNum(right);
          case "<":
            return toNum(left) < toNum(right);
          case ">=":
            return toNum(left) >= toNum(right);
          case "<=":
            return toNum(left) <= toNum(right);
          case "+": {
            const ln = Number(left), rn = Number(right);
            if (!isNaN(ln) && !isNaN(rn)) return ln + rn;
            return String(left ?? "") + String(right ?? "");
          }
          case "-":
            return toNum(left) - toNum(right);
          case "*":
            return toNum(left) * toNum(right);
          case "/": {
            const d = toNum(right);
            return d === 0 ? null : toNum(left) / d;
          }
          default:
            return null;
        }
      }

      case "function": {
        // ── Special scope-aware functions (cannot use FormulaFn signature) ──

        if (n.name === "LET") {
          // LET(varName, value, expression)
          // Binds varName to evaluated value in a child scope
          if (n.args.length < 3) return null;
          const nameNode = n.args[0] as FormulaNode;
          // Variable name: either a literal string or a field-like identifier
          const varName =
            nameNode.type === "literal" ? String(nameNode.value) :
            nameNode.type === "field" ? nameNode.name : null;
          if (!varName) return null;
          const value = evaluate(n.args[1] as FormulaNode);
          // Create child scope with binding
          const childScope = new Map<string, DataValue>(scope ?? []);
          childScope.set(varName, value as DataValue);
          return evaluateNode(n.args[2] as FormulaNode, record, dataFrame, childScope, depth + 1);
        }

        if (n.name === "STYLE") {
          // STYLE(text, color?, weight?)
          // Returns StyledValue with sanitized CSS classes
          if (n.args.length < 1) return null;
          const text = String(evaluate(n.args[0] as FormulaNode) ?? "");
          const color = n.args[1] ? String(evaluate(n.args[1] as FormulaNode) ?? "") : undefined;
          const weight = n.args[2] ? String(evaluate(n.args[2] as FormulaNode) ?? "") : undefined;
          const cssClass = buildSafeClass(color, weight);
          return { __styled: true, text, cssClass } as unknown as DataValue;
        }

        if (n.name === "MAP") {
          // MAP(list, varName, expression)
          // Iterates over array, binds each element to varName, evaluates expression
          if (n.args.length < 3) return null;
          const listVal = evaluate(n.args[0] as FormulaNode);
          const rawList = Array.isArray(listVal) ? listVal : (listVal != null ? [listVal] : []);
          const list = rawList.length > MAX_LIST_ITEMS ? rawList.slice(0, MAX_LIST_ITEMS) : rawList;
          const iterNameNode = n.args[1] as FormulaNode;
          const iterName =
            iterNameNode.type === "literal" ? String(iterNameNode.value) :
            iterNameNode.type === "field" ? iterNameNode.name : "item";
          return list.map(item => {
            const iterScope = new Map<string, DataValue>(scope ?? []);
            iterScope.set(iterName, item as DataValue);
            return evaluateNode(n.args[2] as FormulaNode, record, dataFrame, iterScope, depth + 1);
          }) as unknown as DataValue;
        }

        if (n.name === "FILTER") {
          // FILTER(list, varName, predicate)
          // Returns elements where predicate is truthy
          if (n.args.length < 3) return null;
          const listVal = evaluate(n.args[0] as FormulaNode);
          const rawList = Array.isArray(listVal) ? listVal : (listVal != null ? [listVal] : []);
          const list = rawList.length > MAX_LIST_ITEMS ? rawList.slice(0, MAX_LIST_ITEMS) : rawList;
          const iterNameNode = n.args[1] as FormulaNode;
          const iterName =
            iterNameNode.type === "literal" ? String(iterNameNode.value) :
            iterNameNode.type === "field" ? iterNameNode.name : "item";
          return list.filter(item => {
            const iterScope = new Map<string, DataValue>(scope ?? []);
            iterScope.set(iterName, item as DataValue);
            return Boolean(evaluateNode(n.args[2] as FormulaNode, record, dataFrame, iterScope, depth + 1));
          }) as unknown as DataValue;
        }

        if (n.name === "REDUCE") {
          // REDUCE(list, varName, accName, initial, expression)
          // Accumulates over list: acc = expression(item, acc)
          if (n.args.length < 5) return null;
          const listVal = evaluate(n.args[0] as FormulaNode);
          const rawList = Array.isArray(listVal) ? listVal : (listVal != null ? [listVal] : []);
          const list = rawList.length > MAX_LIST_ITEMS ? rawList.slice(0, MAX_LIST_ITEMS) : rawList;
          const iterNameNode = n.args[1] as FormulaNode;
          const iterName =
            iterNameNode.type === "literal" ? String(iterNameNode.value) :
            iterNameNode.type === "field" ? iterNameNode.name : "item";
          const accNameNode = n.args[2] as FormulaNode;
          const accName =
            accNameNode.type === "literal" ? String(accNameNode.value) :
            accNameNode.type === "field" ? accNameNode.name : "acc";
          let acc: DataValue = evaluate(n.args[3] as FormulaNode) as DataValue;
          for (const item of list) {
            const iterScope = new Map<string, DataValue>(scope ?? []);
            iterScope.set(iterName, item as DataValue);
            iterScope.set(accName, acc);
            acc = evaluateNode(n.args[4] as FormulaNode, record, dataFrame, iterScope, depth + 1) as DataValue;
          }
          return acc;
        }

        // ── Standard functions (from registry) ──
        const fn = EXTENDED_FUNCTIONS[n.name];
        if (fn) {
          return fn(n.args, evaluate);
        }
        return null;
      }

      default:
        return null;
    }
  }

  return evaluate(node) as Optional<DataValue>;
}

 
function smartEq(a: any, b: any): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "string" && typeof b === "string") {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return a === b;
}

 
function toNum(val: any): number {
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function checkFieldRefs(
  node: FormulaNode,
  fields: string[],
  errors: string[]
): void {
  if (node.type === "field") {
    if (!fields.includes(node.name)) {
      errors.push(`Unknown field: ${node.name}`);
    }
  } else if (node.type === "function") {
    for (const arg of node.args) checkFieldRefs(arg, fields, errors);
  } else if (node.type === "operator") {
    checkFieldRefs(node.left, fields, errors);
    checkFieldRefs(node.right, fields, errors);
  } else if (node.type === "array") {
    for (const item of node.items) checkFieldRefs(item, fields, errors);
  }
}
