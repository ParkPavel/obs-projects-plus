import type { App, TFile } from "obsidian";
import {
  PROPERTY_TYPES,
  TYPES_KEY,
  type PropertyType,
} from "./propertyTypes";

type ProcessFn = (
  file: TFile,
  fn: (frontmatter: Record<string, unknown>) => void,
) => Promise<void>;

function getProcessFrontMatter(app: App): ProcessFn | null {
  const fm = (app.fileManager as unknown as {
    processFrontMatter?: ProcessFn;
  }).processFrontMatter;
  return typeof fm === "function" ? fm.bind(app.fileManager) : null;
}

const VALID = new Set<string>(PROPERTY_TYPES);

/**
 * Set or clear the type override for `propertyKey` on the given file.
 * Pass `null` to clear; passing an unknown type is silently ignored.
 *
 * When the resulting map is empty, the `pp_types` key is removed entirely.
 */
export async function setPropertyType(
  app: App,
  file: TFile,
  propertyKey: string,
  type: PropertyType | null,
): Promise<boolean> {
  const processFn = getProcessFrontMatter(app);
  if (!processFn) return false;

  await processFn(file, (frontmatter) => {
    const existing = frontmatter[TYPES_KEY];
    const map: Record<string, string> =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...(existing as Record<string, string>) }
        : {};

    if (type === null) {
      delete map[propertyKey];
    } else if (VALID.has(type)) {
      map[propertyKey] = type;
    } else {
      return; // unknown type → no-op
    }

    if (Object.keys(map).length === 0) {
      delete frontmatter[TYPES_KEY];
    } else {
      frontmatter[TYPES_KEY] = map;
    }
  });

  return true;
}
