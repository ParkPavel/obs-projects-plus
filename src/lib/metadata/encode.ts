import { either as E, function as F } from "fp-ts";
import { stringify } from "yaml";
import { parseYaml } from "./decode";

/**
 * Updates the front matter of a note.
 *
 * @param data - The current content of the note, including front matter.
 * @param frontmatter - The front matter to add to the note.
 * @returns Data with the updated front matter.
 */
export function encodeFrontMatter(
  data: string,
  frontmatter: Record<string, any>,
  defaultStringType: "PLAIN" | "QUOTE_DOUBLE"
): E.Either<Error, string> {
  const delim = "---";

  const startPosition = data.indexOf(delim);
  const endPosition = startPosition >= 0 ? data.indexOf(delim, startPosition + delim.length) : -1;

  const isStart = startPosition === 0;
  const hasFrontMatter = isStart && endPosition > startPosition + delim.length;

  return F.pipe(
    parseYaml(hasFrontMatter ? data.slice(startPosition + delim.length, endPosition) : ""),
    E.map((existing) => {
      const result = { ...existing };
      
      // Process frontmatter properties
      for (const [key, value] of Object.entries(frontmatter)) {
        if (value === undefined) {
          // Skip undefined values completely
          continue;
        }
        // For all other values, use the provided value
        result[key] = value;
      }
      
      return result;
    }),
    E.map((fm) => {
      // Filter out undefined values before stringifyYaml
      const filteredFm = Object.fromEntries(
        Object.entries(fm).filter(([_, value]) => value !== undefined)
      );
      
      if (Object.entries(filteredFm).length) {
        const d = stringifyYaml(filteredFm, defaultStringType);

        if (hasFrontMatter) {
          // Replace existing frontmatter - find the exact end position
          const frontmatterEnd = data.indexOf('\n', endPosition);
          const afterFrontmatter = frontmatterEnd !== -1 ? data.slice(frontmatterEnd + 1) : '';
          return delim + "\n" + d + delim + "\n" + afterFrontmatter;
        } else {
          // Add new frontmatter at the beginning
          return delim + "\n" + d + delim + "\n\n" + data;
        }
      }

      if (hasFrontMatter) {
        // Remove existing frontmatter
        const frontmatterEnd = data.indexOf('\n', endPosition);
        const afterFrontmatter = frontmatterEnd !== -1 ? data.slice(frontmatterEnd + 1) : '';
        return afterFrontmatter;
      }
      
      return data;
    })
  );
}

/**
 * stringifyYaml converts a value to YAML.
 */
export function stringifyYaml(
  value: any,
  defaultStringType: "PLAIN" | "QUOTE_DOUBLE" = "PLAIN"
): string {
  return F.pipe(value, (value) =>
    stringify(value, {
      lineWidth: 0,
      nullStr: "",
      defaultStringType: defaultStringType,
      defaultKeyType: "PLAIN",
      simpleKeys: false,
    })
  );
}

