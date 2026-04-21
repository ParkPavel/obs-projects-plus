// src/lib/helpers/sanitizeHtml.ts
// Whitelist-based HTML sanitizer for developer-controlled i18n strings.

const ALLOWED_TAGS = new Set(["strong", "em", "code", "kbd", "b", "i"]);

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\s*\/?>/g;

/**
 * Strip all HTML tags except whitelisted formatting tags.
 * Self-closing and attribute-bearing tags are removed.
 */
export function sanitizeHtml(html: string): string {
  return html.replace(TAG_RE, (match, tagName: string) => {
    return ALLOWED_TAGS.has(tagName.toLowerCase()) ? match : "";
  });
}
