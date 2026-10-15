import {
  isString,
  type DataField,
  type DataRecord,
} from "src/lib/dataframe/dataframe";
import { parseObsidianLink } from "./helpers";
import type { App } from "obsidian";

export function getCoverRealPath(
  app: App,
  record: DataRecord,
  coverField?: DataField
) {
  if (!coverField) {
    return null;
  }

  const coverPath = record.values[coverField.name];

  if (!coverPath) {
    return null;
  }

  if (isString(coverPath)) {
    return getResourcePathFromLinkText(app, coverPath);
  }

  return null;
}

function getResourcePathFromLinkText(app: App, text: string) {
  const linkText = parseObsidianLink(text)?.linkText || text;
  if (linkText.startsWith("http://") || linkText.startsWith("https://")) {
    return linkText;
  }

  const file = app.metadataCache.getFirstLinkpathDest(linkText, "");

  if (file) {
    if (
      ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"].includes(
        file.extension
      )
    ) {
      return app.vault.getResourcePath(file);
    }
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
  | { readonly kind: "ok"; readonly src: string; readonly raw: string }
  | { readonly kind: "broken"; readonly raw: string };

export function coverOf(app: App, record: DataRecord, coverField?: DataField): CoverState {
  if (!coverField) return { kind: "none" };
  const value = record.values[coverField.name];
  if (value === undefined || value === null || value === "") return { kind: "none" };
  const raw = isString(value) ? value : String(value);
  const src = isString(value) ? getResourcePathFromLinkText(app, value) : null;
  return src ? { kind: "ok", src, raw } : { kind: "broken", raw };
}
