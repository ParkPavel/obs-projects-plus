import { isSafePattern } from "redos-detector";

type Admission = "unsafe" | "unverified" | null;
const MAX_ADMISSIONS = 256;
const UNVERIFIED_TTL_MS = 15_000;
const admissions = new Map<string, { issue: Admission; expires: number }>();
// Literals with optional anchors or one capture have no branching/quantification.
const LITERAL = /^\^?[\p{L}\p{N}_ \t,:@#%&=/-]*\$?$/u;

function isLiteral(source: string): boolean {
  const captured = /^\^?\((?:\?<[^>]+>)?([^()]*)\)\$?$/u.exec(source)?.[1];
  return LITERAL.test(source)
    || (captured !== undefined && LITERAL.test(captured))
    || (source.startsWith("^(?:") && source.endsWith(")$") && LITERAL.test(source.slice(4, -2)));
}

/** Cache syntax facts only; native RegExp objects and lastIndex are never shared. */
export function regexAdmission(source: string, flags: string, knownUnsafe: () => boolean): Admission {
  const key = JSON.stringify([source, flags]);
  const now = performance.now();
  const known = admissions.get(key);
  if (known && now < known.expires) {
    admissions.delete(key);
    admissions.set(key, known);
    return known.issue;
  }
  let issue: Admission = "unverified";
  try {
    if (knownUnsafe()) issue = "unsafe";
    else if (!/[^dgimsuy]/.test(flags)) {
      if (isLiteral(source)) issue = null;
      else {
        const result = isSafePattern(source, {
          caseInsensitive: flags.includes("i"), unicode: flags.includes("u"),
          dotAll: flags.includes("s"), multiLine: flags.includes("m"),
          maxScore: 200, maxSteps: 20_000, timeout: 25, downgradePattern: true,
        });
        if (result.safe && result.error === null && !result.score.infinite && result.score.value <= 200) issue = null;
        else if (result.error === "hitMaxScore" || (result.error === null && result.score.infinite)) issue = "unsafe";
      }
    }
  } catch { /* Unsupported syntax or analysis failure is unverified, never admitted. */ }
  if (admissions.size >= MAX_ADMISSIONS) {
    const oldest = admissions.keys().next().value;
    if (oldest !== undefined) admissions.delete(oldest);
  }
  admissions.set(key, { issue, expires: issue === "unverified" ? now + UNVERIFIED_TTL_MS : Infinity });
  return issue;
}
