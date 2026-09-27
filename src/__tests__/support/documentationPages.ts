/**
 * Which files are documentation pages. Shared by R0.25 (pages come in pairs)
 * and R0.26 (links work on GitHub and in Obsidian), so both tests judge the
 * same set: root-level pages plus everything under the given directories,
 * minus what git ignores and what carries frontmatter (vault content — a demo
 * note, a Templater template — is not documentation).
 */

import { execFileSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

export const ROOT = resolve(__dirname, "..", "..", "..");

export const read = (relative: string) => readFileSync(resolve(ROOT, relative), "utf8");

/**
 * Directories that are never documentation, wherever they occur. Dot-folders
 * are skipped by shape rather than by name: the vault's configuration folder
 * is whatever the user called it, and naming it here would be a guess.
 */
const SKIPPED_DIR_NAMES = new Set(["node_modules"]);
const isHiddenDir = (name: string) => name.startsWith(".");

/**
 * A page git would not track is not a documentation page a reader can reach —
 * this is what keeps a deleted `docs/internal/` or a workspace-local root file
 * out of the set without naming either one here.
 */
const isGitIgnored = (relative: string): boolean => {
  try {
    execFileSync("git", ["check-ignore", "-q", relative], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
};

const hasFrontmatter = (text: string) => text.trimStart().startsWith("---");

const walk = (dir: string, relativeDir: string, out: string[]): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIR_NAMES.has(entry.name) || isHiddenDir(entry.name)) continue;
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(resolve(dir, entry.name), relativePath, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(relativePath);
    }
  }
};

export const discoverDocumentationPages = (dirs: readonly string[]): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) found.push(entry.name);
  }
  for (const dir of dirs) walk(resolve(ROOT, dir), dir, found);
  return found
    .filter((relative) => !isGitIgnored(relative))
    .filter((relative) => !hasFrontmatter(read(relative)))
    .sort();
};
