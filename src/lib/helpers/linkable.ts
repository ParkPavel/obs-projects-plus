// MPLAN-002 — Detect URL/email/phone in plain-text cell values.
//
// Returns a normalized href + kind when the trimmed value is a single
// recognisable URL, email, or phone number. Returns null otherwise so the
// caller renders plain text.
//
// Detection is deliberately strict (anchored, no embedded whitespace) to
// avoid false positives on free-form note content.

export type LinkableKind = "url" | "email" | "phone";

export interface Linkable {
  readonly kind: LinkableKind;
  readonly href: string;
}

const URL_RE = /^(https?:\/\/|mailto:|tel:)\S+$/i;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[\d][\d\s\-().]{5,}$/;

export function detectLinkable(raw: string | null | undefined): Linkable | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (URL_RE.test(value)) {
    if (/^mailto:/i.test(value)) return { kind: "email", href: value };
    if (/^tel:/i.test(value)) return { kind: "phone", href: value };
    return { kind: "url", href: value };
  }

  if (EMAIL_RE.test(value)) {
    return { kind: "email", href: `mailto:${value}` };
  }

  if (PHONE_RE.test(value)) {
    const digits = value.replace(/[^\d+]/g, "");
    if (digits.replace(/^\+/, "").length >= 6) {
      return { kind: "phone", href: `tel:${digits}` };
    }
  }

  return null;
}
