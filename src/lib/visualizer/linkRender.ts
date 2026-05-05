/**
 * PARITY-001 — Render URL/Email/Phone string values as anchor href.
 *
 * Single source of truth for the link-href derivation so DataTable
 * and Visualizer (and future Board card body) agree on the policy.
 *
 * Pure module — no DOM. Returns the href + display label; caller
 * renders the `<a>` element with `rel="noopener noreferrer"` and
 * `target="_blank"` (URLs only) according to its surface conventions.
 */

export type LinkKind = "url" | "email" | "phone";

export interface LinkRenderable {
  readonly href: string;
  readonly label: string;
  readonly kind: LinkKind;
  /** True when href points outside the vault (always for url/email/phone). */
  readonly external: boolean;
}

const TRIM_RE = /^\s+|\s+$/g;
const URL_TRIM_RE = /^[\s<]+|[\s>]+$/g;
const PHONE_STRIP_RE = /[^\d+]/g;

/**
 * Build a renderable link descriptor from a raw cell value.
 * Returns `null` for blank/non-string input so the caller can fall back
 * to plain rendering.
 */
export function buildLinkHref(
  raw: unknown,
  kind: LinkKind,
): LinkRenderable | null {
  if (typeof raw !== "string") return null;
  // URL: also strip surrounding angle brackets (markdown autolink shape).
  // Email: do NOT strip angle brackets — they delimit "Name <addr>" form.
  const text = (kind === "url" ? raw.replace(URL_TRIM_RE, "") : raw.replace(TRIM_RE, ""));
  if (text === "") return null;

  switch (kind) {
    case "url": {
      // Allow protocol-relative entries by prefixing https://. Reject
      // anything containing whitespace post-trim to avoid javascript:
      // smuggling via "javascript: alert(1)".
      if (/\s/.test(text)) return null;
      const lower = text.toLowerCase();
      // OWASP A03 — disallow dangerous schemes outright.
      if (
        lower.startsWith("javascript:") ||
        lower.startsWith("data:") ||
        lower.startsWith("vbscript:") ||
        lower.startsWith("file:")
      ) {
        return null;
      }
      const href = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
      return { href, label: text, kind, external: true };
    }
    case "email": {
      // Tolerate "Name <addr@example.com>" by extracting the bracketed
      // address; otherwise expect a bare address.
      const match = /<([^>]+)>/.exec(text);
      const addr = match ? match[1]!.trim() : text;
      if (!addr || /\s/.test(addr) || !addr.includes("@")) return null;
      return {
        href: `mailto:${encodeURI(addr)}`,
        label: text,
        kind,
        external: true,
      };
    }
    case "phone": {
      const digits = text.replace(PHONE_STRIP_RE, "");
      if (digits.replace(/\D/g, "").length < 5) return null;
      return { href: `tel:${digits}`, label: text, kind, external: true };
    }
  }
}
