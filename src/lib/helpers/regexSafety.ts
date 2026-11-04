type CharacterRange = readonly [number, number];

interface FirstCharacters {
  ranges: CharacterRange[];
  unknown: boolean;
}

interface RegexPart {
  first: FirstCharacters;
  nullable: boolean;
  hasRepeat: boolean;
  ambiguous: boolean;
  repeatMax?: number;
}

const EMPTY: FirstCharacters = { ranges: [], unknown: false };
const MAX_REGEX_REPEAT_BOUND = 10_000;

function caseFold(first: FirstCharacters, ignoreCase: boolean): FirstCharacters {
  if (!ignoreCase) return first;
  const ranges = [...first.ranges];
  let unknown = first.unknown;
  for (const [start, end] of first.ranges) {
    if (end > 0x7f) unknown = true;
    const upperStart = Math.max(start, 65);
    const upperEnd = Math.min(end, 90);
    if (upperStart <= upperEnd) ranges.push([upperStart + 32, upperEnd + 32]);
    const lowerStart = Math.max(start, 97);
    const lowerEnd = Math.min(end, 122);
    if (lowerStart <= lowerEnd) ranges.push([lowerStart - 32, lowerEnd - 32]);
  }
  return { ranges, unknown };
}

function character(codePoint: number, ignoreCase: boolean): FirstCharacters {
  return caseFold({ ranges: [[codePoint, codePoint]], unknown: false }, ignoreCase);
}

function union(left: FirstCharacters, right: FirstCharacters): FirstCharacters {
  return {
    ranges: [...left.ranges, ...right.ranges],
    unknown: left.unknown || right.unknown,
  };
}

function overlaps(left: FirstCharacters, right: FirstCharacters): boolean {
  if (left.unknown || right.unknown) return true;
  return left.ranges.some(([aStart, aEnd]) =>
    right.ranges.some(([bStart, bEnd]) => aStart <= bEnd && bStart <= aEnd)
  );
}

function asciiWordCharacters(): FirstCharacters {
  return {
    ranges: [
      [48, 57],
      [65, 90],
      [95, 95],
      [97, 122],
    ],
    unknown: false,
  };
}

function asciiDigitCharacters(): FirstCharacters {
  return { ranges: [[48, 57]], unknown: false };
}

function whitespaceCharacters(): FirstCharacters {
  return { ranges: [[9, 13], [32, 32]], unknown: true };
}

function analyzePattern(pattern: string, flags: string): boolean {
  let index = 0;
  let unsafe = false;
  const ignoreCase = flags.includes("i");

  const readCodePoint = (): number => {
    const codePoint = pattern.codePointAt(index);
    if (codePoint === undefined) return 0;
    index += codePoint > 0xffff ? 2 : 1;
    return codePoint;
  };

  const readHex = (count: number): number | undefined => {
    const value = pattern.slice(index, index + count);
    if (value.length !== count || !/^[0-9a-f]+$/i.test(value)) return undefined;
    index += count;
    return Number.parseInt(/* coercion-exempt: Class B - parse validated hex digits */ value, 16);
  };

  const parseEscape = (inClass: boolean): FirstCharacters => {
    if (index >= pattern.length) {
      unsafe = true;
      return { ranges: [], unknown: true };
    }

    const escaped = pattern[index++];
    if (escaped === undefined) {
      unsafe = true;
      return { ranges: [], unknown: true };
    }

    switch (escaped) {
      case "d":
        return asciiDigitCharacters();
      case "w":
        return asciiWordCharacters();
      case "s":
        return whitespaceCharacters();
      case "D":
      case "W":
      case "S":
        return { ranges: [], unknown: true };
      case "b":
        return inClass ? character(8, ignoreCase) : EMPTY;
      case "B":
        return inClass ? character(66, ignoreCase) : EMPTY;
      case "f":
        return character(12, ignoreCase);
      case "n":
        return character(10, ignoreCase);
      case "r":
        return character(13, ignoreCase);
      case "t":
        return character(9, ignoreCase);
      case "v":
        return character(11, ignoreCase);
      case "c": {
        const control = pattern[index++];
        if (!control || !/[a-z]/i.test(control)) {
          unsafe = true;
          return { ranges: [], unknown: true };
        }
        return character(control.toUpperCase().charCodeAt(0) % 32, ignoreCase);
      }
      case "x": {
        const codePoint = readHex(2);
        if (codePoint === undefined) {
          unsafe = true;
          return { ranges: [], unknown: true };
        }
        return character(codePoint, ignoreCase);
      }
      case "u": {
        if (pattern[index] === "{") return character(117, ignoreCase);
        const codePoint = readHex(4);
        if (codePoint === undefined) {
          unsafe = true;
          return { ranges: [], unknown: true };
        }
        return character(codePoint, ignoreCase);
      }
      case "0":
        if (/\d/.test(pattern[index] ?? "")) unsafe = true;
        return character(0, ignoreCase);
      case "k":
        unsafe = true;
        return { ranges: [], unknown: true };
      default:
        if (/\d/.test(escaped)) {
          unsafe = true;
          return { ranges: [], unknown: true };
        }
        return character(escaped.codePointAt(0) ?? 0, ignoreCase);
    }
  };

  const parseClass = (): FirstCharacters => {
    index++;
    const negated = pattern[index] === "^";
    if (negated) index++;

    const ranges: CharacterRange[] = [];
    let unknown = negated;
    let first = true;
    let closed = false;

    while (index < pattern.length) {
      if (pattern[index] === "]" && !first) {
        index++;
        closed = true;
        break;
      }

      const start = pattern[index] === "\\"
        ? (index++, parseEscape(true))
        : character(readCodePoint(), ignoreCase);
      first = false;

      if (
        (start.ranges.length === 1 || (ignoreCase && start.ranges.length === 2)) &&
        !start.unknown &&
        pattern[index] === "-" &&
        pattern[index + 1] !== "]" &&
        pattern[index + 1] !== undefined
      ) {
        index++;
        const end = pattern[index] === "\\"
          ? (index++, parseEscape(true))
          : character(readCodePoint(), ignoreCase);
        const startRange = start.ranges[0];
        const endRange = end.ranges[0];
        if (
          !startRange ||
          !endRange ||
          (end.ranges.length !== 1 && !(ignoreCase && end.ranges.length === 2)) ||
          end.unknown ||
          startRange[0] > endRange[0]
        ) {
          unknown = true;
        } else {
          ranges.push([startRange[0], endRange[0]]);
        }
      } else {
        ranges.push(...start.ranges);
        unknown ||= start.unknown;
      }
    }

    if (!closed) unsafe = true;
    return caseFold({ ranges, unknown }, ignoreCase);
  };

  const parseAlternation = (): RegexPart => {
    const branches = [parseSequence()];
    while (pattern[index] === "|") {
      index++;
      branches.push(parseSequence());
    }

    let first = EMPTY;
    for (const branch of branches) first = union(first, branch.first);

    let ambiguous = branches.some((branch) => branch.ambiguous);
    for (let left = 0; left < branches.length; left++) {
      for (let right = left + 1; right < branches.length; right++) {
        const a = branches[left];
        const b = branches[right];
        if (!a || !b) continue;
        if ((a.nullable && b.nullable) || overlaps(a.first, b.first)) ambiguous = true;
      }
    }

    return {
      first,
      nullable: branches.some((branch) => branch.nullable),
      hasRepeat: branches.some((branch) => branch.hasRepeat),
      ambiguous,
    };
  };

  const parseGroup = (): RegexPart => {
    index++;
    if (pattern[index] === "?") {
      if (pattern[index + 1] === ":") {
        index += 2;
      } else if (pattern[index + 1] === "<" && pattern[index + 2] !== "=" && pattern[index + 2] !== "!") {
        index += 2;
        const end = pattern.indexOf(">", index);
        if (end < 0 || end === index) unsafe = true;
        else index = end + 1;
      } else {
        unsafe = true;
      }
    }

    const group = parseAlternation();
    if (pattern[index] !== ")") unsafe = true;
    else index++;
    return group;
  };

  const parseAtom = (): RegexPart => {
    const current = pattern[index];
    if (current === undefined) {
      unsafe = true;
      return { first: EMPTY, nullable: true, hasRepeat: false, ambiguous: false };
    }

    if (current === "(") return parseGroup();
    if (current === "[") {
      return {
        first: parseClass(),
        nullable: false,
        hasRepeat: false,
        ambiguous: false,
      };
    }
    if (current === "\\") {
      index++;
      const escaped = pattern[index];
      return {
        first: parseEscape(false),
        nullable: escaped === "b" || escaped === "B",
        hasRepeat: false,
        ambiguous: false,
      };
    }
    if (current === ".") {
      index++;
      return {
        first: { ranges: [[0, 0x10ffff]], unknown: false },
        nullable: false,
        hasRepeat: false,
        ambiguous: false,
      };
    }
    if (current === "^" || current === "$") {
      index++;
      return { first: EMPTY, nullable: true, hasRepeat: false, ambiguous: false };
    }
    if (current === ")" || current === "|" || current === "*" || current === "+" || current === "?") {
      unsafe = true;
      index++;
      return { first: EMPTY, nullable: true, hasRepeat: false, ambiguous: false };
    }

    index++;
    return {
      first: character(current.codePointAt(0) ?? 0, ignoreCase),
      nullable: false,
      hasRepeat: false,
      ambiguous: false,
    };
  };

  const parseQuantifier = (): { min: number; max: number } | null => {
    const current = pattern[index];
    let min: number;
    let max: number;

    if (current === "*") {
      min = 0;
      max = Number.POSITIVE_INFINITY;
      index++;
    } else if (current === "+") {
      min = 1;
      max = Number.POSITIVE_INFINITY;
      index++;
    } else if (current === "?") {
      min = 0;
      max = 1;
      index++;
    } else if (current === "{") {
      const match = /^\{(\d+)(?:,(\d*)?)?\}/.exec(pattern.slice(index));
      if (!match) return null;
      min = Number.parseInt(/* coercion-exempt: Class B - parse validated repeat bound */ match[1] ?? "", 10);
      max = match[2] === undefined
        ? min
        : match[2] === ""
          ? Number.POSITIVE_INFINITY
          : Number.parseInt(/* coercion-exempt: Class B - parse validated repeat bound */ match[2], 10);
      index += match[0].length;
      if (max < min) unsafe = true;
    } else {
      return null;
    }

    if (Number.isFinite(max) && max > MAX_REGEX_REPEAT_BOUND) unsafe = true;
    if (pattern[index] === "?") index++;
    return { min, max };
  };

  const parseSequence = (): RegexPart => {
    const parts: RegexPart[] = [];
    const activeRepeats: FirstCharacters[] = [];

    while (index < pattern.length && pattern[index] !== "|" && pattern[index] !== ")") {
      const atom = parseAtom();
      const quantifier = parseQuantifier();
      const part = quantifier
        ? {
            ...atom,
            nullable: quantifier.min === 0 || atom.nullable,
            hasRepeat: true,
            repeatMax: quantifier.max,
          }
        : atom;

      if (part.hasRepeat && activeRepeats.some((first) => overlaps(first, part.first))) unsafe = true;
      if (quantifier && quantifier.max > 1) {
        if (atom.hasRepeat || atom.ambiguous || atom.nullable) unsafe = true;
        activeRepeats.push(part.first);
      } else if (!part.nullable && activeRepeats.every((first) => !overlaps(first, part.first))) {
        // A repeated character can also consume this literal: `a+aa+` still
        // has competing partitions. Only a disjoint separator ends that risk.
        activeRepeats.length = 0;
      }
      parts.push(part);
    }

    let first = EMPTY;
    let nullable = true;
    for (const part of parts) {
      first = union(first, part.first);
      if (!part.nullable) {
        nullable = false;
        break;
      }
    }

    return {
      first,
      nullable,
      hasRepeat: parts.some((part) => part.hasRepeat),
      ambiguous: parts.some((part) => part.ambiguous),
    };
  };

  parseAlternation();
  if (index !== pattern.length) unsafe = true;
  return unsafe;
}

/**
 * Conservatively reject regex constructs whose backtracking cost cannot be
 * bounded by our pattern/input limits. Pass execution flags so case folding
 * is included in overlap analysis.
 */
export function isUnsafePattern(pattern: string, flags = ""): boolean {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return true;
  return analyzePattern(pattern, flags);
}

export type RegexPatternIssue = "invalid" | "unsafe" | "too-long";

export type SafeRegexResult =
  | { ok: true; regex: RegExp }
  | { ok: false; issue: RegexPatternIssue };

export interface SafeRegexOptions {
  /** Require the whole input to match without changing capture-group indexes. */
  fullMatch?: boolean;
}

/** Validate syntax and complexity before any caller executes a pattern. */
export function compileSafeRegex(
  pattern: string,
  flags = "",
  options: SafeRegexOptions = {}
): SafeRegexResult {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return { ok: false, issue: "too-long" };

  const source = options.fullMatch ? `^(?:${pattern})$` : pattern;
  let regex: RegExp;
  try {
    regex = new RegExp(source, flags);
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, issue: "invalid" };
    throw error;
  }

  if (isUnsafePattern(pattern, flags)) return { ok: false, issue: "unsafe" };
  return { ok: true, regex };
}

export function getRegexPatternIssue(pattern: string, flags = ""): RegexPatternIssue | null {
  const result = compileSafeRegex(pattern, flags);
  return result.ok ? null : result.issue;
}

/** Maximum input string length for regex operations */
export const MAX_REGEX_INPUT_LENGTH = 10_000;

/** Maximum length of a user-supplied pattern. */
export const MAX_REGEX_PATTERN_LENGTH = 200;
