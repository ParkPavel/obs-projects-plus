/**
 * R0.26 — every documentation link works on GitHub and in Obsidian.
 *
 * The documentation is read in two places: on GitHub, and in Obsidian with
 * the repository opened as a vault. A live measurement on 2026-09-23
 * (Obsidian 1.13.7, 234 links in 23 pages) found what each accepts. A
 * relative link to another `.md` page works in both. Everything else splits
 * them: Obsidian does nothing for a link to a folder or to an extensionless
 * `LICENSE`, hands a `.ts` file to whatever the OS maps to that extension (a
 * video player on the maintainer's machine), and matches an anchor against
 * the heading's text while GitHub matches it against a slug.
 *
 * So the rule is the common subset:
 *  - a relative link must point at an existing `.md` page;
 *  - an anchor must be what both of them derive from the same heading: its
 *    text for Obsidian and its slug for GitHub (`#ppp-101` for `## PPP-101`);
 *    a multi-word heading or one with punctuation GitHub drops cannot qualify;
 *  - code, folders, extensionless files and data go through the canonical
 *    GitHub URL (`…/blob/main/<file>`, `…/tree/main/<folder>`), which opens a
 *    browser from Obsidian instead of a local program, and must name
 *    something that exists;
 *  - an embedded image (`![alt](file.png)`) may stay local: it renders in
 *    both, it is not navigation.
 *
 * No network access: canonical URLs are checked against the working tree.
 */

import { existsSync, statSync } from "fs";
import { dirname, posix, relative, resolve } from "path";
import { ROOT, read, discoverDocumentationPages } from "./support/documentationPages";

const DOC_DIRS = ["docs", "demo-vault", "templates", "obsidian-projects-types", "src"];
const CANONICAL = /^https:\/\/github\.com\/ParkPavel\/obs-projects-plus\/(blob|tree)\/main\/([^#?]*)/;
const IMAGE = /\.(png|jpe?g|gif|svg|webp)$/i;
const FENCE = /^\s*(```|~~~)/;

interface Link { line: number; destination: string; embed: boolean }

/** Inline links, images and reference definitions, outside fenced code and inline code spans. */
const extractLinks = (text: string): Link[] => {
  const links: Link[] = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((raw, index) => {
    if (FENCE.test(raw)) { fenced = !fenced; return; }
    if (fenced) return;
    const line = raw.replace(/`[^`]*`/g, "");
    // Destination bare or in <angle brackets>; optional title in "", '' or () — all CommonMark.
    for (const m of line.matchAll(/(!?)\[[^\]]*\]\(\s*(?:<([^>]*)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g)) {
      links.push({ line: index + 1, destination: m[2] ?? m[3] ?? "", embed: m[1] === "!" });
    }
    const def = line.match(/^\s*\[[^\]]+\]:\s*<?(\S+?)>?(\s|$)/);
    if (def) links.push({ line: index + 1, destination: def[1] ?? "", embed: false });
  });
  return links;
};

/** Heading texts of a page, outside fenced code. */
const headings = (text: string): string[] => {
  const out: string[] = [];
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    if (FENCE.test(line)) { fenced = !fenced; continue; }
    const m = !fenced && line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (m) out.push((m[1] ?? "").trim());
  }
  return out;
};

const inside = (absolute: string) => {
  const rel = relative(ROOT, absolute);
  return rel !== "" && !rel.startsWith("..") && !posix.isAbsolute(rel.replace(/\\/g, "/"));
};

/** GitHub's section slug: lower-case, punctuation other than - and _ dropped, spaces to hyphens. */
const githubSlug = (heading: string) =>
  heading.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");

/** Obsidian matches the heading text, GitHub its slug; an anchor must satisfy both. */
const anchorProblem = (anchor: string, headingTexts: readonly string[]): string | null => {
  const token = decodeURIComponent(anchor);
  if (/\s/.test(token)) return "anchor has spaces (GitHub and Obsidian disagree)";
  const lower = token.toLowerCase();
  const agreed = headingTexts.some((h) => h.toLowerCase() === lower && githubSlug(h) === lower);
  return agreed ? null : "anchor is not both a heading text and its GitHub slug";
};

const checkAnchor = (anchor: string, targetPage: string): string | null => anchorProblem(anchor, headings(read(targetPage)));

const checkLink = (page: string, link: Link): string | null => {
  const { destination } = link;
  if (/^(mailto:|obsidian:)/i.test(destination)) return null;
  const canonical = destination.match(CANONICAL);
  if (canonical) {
    const target = resolve(ROOT, decodeURIComponent(canonical[2] ?? ""));
    if (!inside(target) || !existsSync(target)) return "canonical URL names nothing in the repository";
    const isDir = statSync(target).isDirectory();
    if (canonical[1] === "tree" && !isDir) return "tree/ URL names a file";
    if (canonical[1] === "blob" && isDir) return "blob/ URL names a folder";
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(destination)) return null; // other external URLs
  const [pathPart, anchor] = destination.split("#", 2);
  if (!pathPart) return anchor === undefined ? null : checkAnchor(anchor, page);
  const target = resolve(ROOT, dirname(page), decodeURIComponent(pathPart));
  if (!inside(target)) return "leaves the repository";
  if (!existsSync(target)) return "missing target";
  if (statSync(target).isDirectory()) return "links a folder (use …/tree/main/<folder>)";
  if (link.embed && IMAGE.test(target)) return null;
  if (!target.endsWith(".md")) return "links a non-Markdown file (use …/blob/main/<file>)";
  if (anchor !== undefined) return checkAnchor(anchor, relative(ROOT, target).replace(/\\/g, "/"));
  return null;
};

describe("R0.26 — documentation links work on GitHub and in Obsidian", () => {
  const pages = discoverDocumentationPages(DOC_DIRS);

  it("finds the documentation, including module READMEs under src", () => {
    expect(pages).toEqual(expect.arrayContaining(["README.md", "docs/api.md", "src/lib/datasources/README.md"]));
  });

  it("has no link that only one of the two platforms can follow", () => {
    const errors: string[] = [];
    for (const page of pages) {
      for (const link of extractLinks(read(page))) {
        const problem = checkLink(page, link);
        if (problem) errors.push(`${page}:${link.line}: ${problem} — ${link.destination}`);
      }
    }
    expect(errors).toEqual([]);
  });
});

describe("R0.26 — the rules themselves", () => {
  it("extracts links whatever title syntax CommonMark allows", () => {
    const text = [
      '[a](one.md "double")',
      "[b](two.md 'single')",
      "[c](three.md (paren))",
      "[d](<four five.md>)",
    ].join("\n");
    expect(extractLinks(text).map((l) => l.destination)).toEqual(["one.md", "two.md", "three.md", "four five.md"]);
  });

  it("accepts an anchor only when Obsidian's heading text and GitHub's slug agree", () => {
    expect(anchorProblem("ppp-101", ["PPP-101"])).toBeNull();
    expect(anchorProblem("foo.bar", ["foo.bar"])).not.toBeNull(); // GitHub slug is foobar
    expect(anchorProblem("minimal-example", ["Minimal example"])).not.toBeNull(); // Obsidian needs the text
    expect(anchorProblem("missing", ["Other"])).not.toBeNull();
  });
});
