import {
  isString,
  type DataField,
  type DataRecord,
  type DataValue,
  type Optional,
} from "src/lib/dataframe/dataframe";
import { parseObsidianLink } from "./helpers";
import type { App } from "obsidian";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif"];

/**
 * i3-gallery — the text a cover value names. A list (`cover: ["[[a.png]]"]`,
 * a multitext property, a relation-like list of links) gives its first
 * non-empty item, as Bases and Notion take the first file of a files property.
 * Null for an absent or empty value; any other scalar reads as its text, so it
 * can be reported as a broken cover rather than silently ignored.
 */
export function coverText(value: Optional<DataValue>): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = coverText(item);
      if (text !== null) return text;
    }
    return null;
  }
  return isString(value) ? value.trim() || null : String(value);
}

export function getCoverRealPath(
  app: App,
  record: DataRecord,
  coverField?: DataField
) {
  if (!coverField) {
    return null;
  }
  const value = record.values[coverField.name];
  if (!isString(value) && !Array.isArray(value)) return null;
  const text = coverText(value);
  // i3-gallery: a link resolves from the note that holds it (its folder
  // decides between two images of one name), not from the vault root.
  return text === null ? null : resolveImageLink(app, text, record.id);
}

/** i3-gallery: an external URL whose path ends in an image extension. */
function isImageUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? "";
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * The resource URL of the image a link text names, or null. Accepts a bare
 * path, a wikilink (`[[a.png]]`, `![[a.png|200]]`) and a markdown link or
 * embed (`![](a%20b.png)`, `![](<a b.png>)`); a web URL is used as it is.
 * `sourcePath` is the note the link is written in (i3-gallery).
 */
export function resolveImageLink(app: App, text: string, sourcePath: string): string | null {
  const parsed = parseObsidianLink(text.trim())?.linkText ?? text.trim();
  if (parsed.startsWith("http://") || parsed.startsWith("https://")) {
    return parsed;
  }
  let linkText = parsed.replace(/^<(.*)>$/, "$1");
  try {
    linkText = decodeURI(linkText);
  } catch {
    // A lone "%" is a valid file name character: keep the text as written.
  }
  // A heading or block reference does not change which file is meant.
  linkText = linkText.split("#")[0] ?? linkText;
  if (!linkText) return null;

  const file = app.metadataCache?.getFirstLinkpathDest?.(linkText, sourcePath);
  if (file && IMAGE_EXTENSIONS.includes(file.extension.toLowerCase())) {
    return app.vault.getResourcePath(file);
  }
  return null;
}

/**
 * i3-gallery — the first image embedded in a note's body (`![[a.png]]`,
 * `![](a.png)`, an external `![](https://…/a.png)`), from the metadata
 * cache, in document order. Null when the cache is not there (a test, a note
 * not indexed yet) or the note embeds no image. Notion's "page content"
 * preview takes the first image the same way.
 */
export function firstEmbeddedImage(app: App, notePath: string): string | null {
  const cache = app.metadataCache?.getCache?.(notePath);
  for (const embed of cache?.embeds ?? []) {
    const link = embed.link;
    if (/^https?:\/\//.test(link)) {
      if (isImageUrl(link)) return link;
      continue;
    }
    const src = resolveImageLink(app, link, notePath);
    if (src) return src;
  }
  return null;
}

/**
 * B9 — what a card's cover area shows. `none`: the record has no cover value
 * (the plain image placeholder); `ok`: a resolved image; `broken`: a value that
 * names no image the vault or the web can give (a moved file, a typo, a
 * non-image), so the card can say so and where to fix it instead of looking
 * exactly like a record that never had a cover.
 */
export type CoverState =
  | { readonly kind: "none" }
  | { readonly kind: "ok"; readonly src: string; readonly raw: string; readonly embedded?: true }
  | { readonly kind: "broken"; readonly raw: string };

/**
 * The cover of one card. i3-gallery: `fallbackToEmbed` (the `cover` and
 * `content` previews) shows the note's first embedded image when the cover
 * property is absent or empty — never in place of a value that is set but
 * broken, which keeps saying where to fix it.
 */
export function coverOf(
  app: App,
  record: DataRecord,
  coverField?: DataField,
  fallbackToEmbed = false
): CoverState {
  const raw = coverField ? coverText(record.values[coverField.name]) : null;
  if (raw === null) {
    const embedded = fallbackToEmbed ? firstEmbeddedImage(app, record.id) : null;
    return embedded ? { kind: "ok", src: embedded, raw: embedded, embedded: true } : { kind: "none" };
  }
  const value = coverField ? record.values[coverField.name] : undefined;
  // A non-text scalar (a number, a date) names no image.
  const linkLike = isString(value) || Array.isArray(value);
  const src = linkLike ? resolveImageLink(app, raw, record.id) : null;
  return src ? { kind: "ok", src, raw } : { kind: "broken", raw };
}

/**
 * i3-gallery — the first paragraph of a note as plain text, for the
 * `content` preview: the frontmatter, headings, code, embeds, tables,
 * comments and rules are skipped; links read as their text; list, quote and
 * task markers and inline emphasis are dropped. At most `max` characters,
 * ending in an ellipsis when cut. Empty when the note has no prose.
 */
export function firstParagraph(markdown: string, max = 280): string {
  let text = markdown.replace(/^﻿/, "");
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
  text = text.replace(/```[\s\S]*?(?:```|$)/g, "\n\n").replace(/%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "" && !/^(#{1,6}\s|\||(-{3,}|\*{3,}|_{3,})$)/.test(line));
    const plain = lines
      .map((line) =>
        line
          .replace(/^(?:>\s*)+/, "")
          .replace(/^(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?/, "")
          .replace(/!\[\[[^\]]*\]\]/g, "")
          .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
          .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
          .replace(/\[\[([^\]]*)\]\]/g, (_m, link: string) => link.split("#")[0] ?? link)
          .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/(\*\*|__|~~|==|`)/g, "")
          .replace(/(^|\s)[*_](\S[^*_]*)[*_](?=\s|$|[.,;:!?])/g, "$1$2")
          .replace(/(^|\s)#[\w/-]+/g, "$1")
          .trim()
      )
      .filter((line) => line !== "")
      .join(" ");
    if (plain) return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
  }
  return "";
}
