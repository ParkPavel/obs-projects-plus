import type { CachedMetadata } from "obsidian";
import type { PackageManifest } from "./package";
import { projectFileError } from "./document";
import type { PackageConfigPathPreview, ConfigPathBindingOption, ConfigPathIssue, ConfigPathChange } from "./packageConfigPaths";
import { createConfigPathBindings, type ConfigPathChoice } from "./packagePathBindings";
import type { VaultPathEntry } from "./packageFilePlan";
import type { NativeNoteInspection } from "./nativeNoteInspection";
import { frontmatterLinkEdits } from "./frontmatterLinkEdits";
import { PACKAGE_LIMITS } from "./packagePolicy";

type Span = { from: number; to: number; original: string; link: string; syntax: "wiki" | "markdown" | "definition" | "yaml" };
const external = (link: string) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(link);
const fail = () => { throw projectFileError("unsupported or stale note link"); };
const splitLink = (link: string) => { const at = link.indexOf("#"); return at < 0 ? { path: link, suffix: "" } : { path: link.slice(0, at), suffix: link.slice(at) }; };
function relative(from: string, target: string): string {
  const a = from.split("/").slice(0, -1), b = target.split("/");
  while (a.length && b.length && a[0] === b[0]) { a.shift(); b.shift(); }
  return [...a.map(() => ".."), ...b].map(part => encodeURIComponent(part)).join("/");
}
function resolveRelative(source: string, path: string): string | undefined {
  const parts = path.startsWith("/") ? [] : source.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!parts.length) return; parts.pop(); }
    else parts.push(part);
  }
  return parts.join("/");
}
/** Find just the Markdown destination, preserving label, whitespace and title. */
function markdownDestination(original: string, definition: boolean): { from: number; to: number } {
  let at = definition ? original.indexOf("]:") + 2 : -1;
  if (!definition) {
    let depth = 0;
    for (let i = original.startsWith("!") ? 1 : 0; i < original.length; i++) {
      if (original[i] === "\\") { i++; continue; }
      if (original[i] === "[") depth++;
      if (original[i] === "]" && --depth === 0 && original[i + 1] === "(") { at = i + 2; break; }
    }
  }
  if (at < 1) return fail();
  while (/\s/.test(original[at] ?? "") && at < original.length) at++;
  if (original[at] === "<") {
    const end = original.indexOf(">", at + 1); if (end < 0) return fail();
    return { from: at + 1, to: end };
  }
  const start = at; let depth = 0;
  for (; at < original.length; at++) {
    const c = original[at];
    if (c === "\\") { at++; continue; }
    if (c === "(") depth++;
    else if (c === ")") { if (!depth) break; depth--; }
    else if (/\s/.test(c!) && depth === 0) break;
  }
  if (at === start || depth) return fail();
  return { from: start, to: at };
}
function rewrite(span: Span, target: string, destination: string): string {
  const { suffix } = splitLink(span.link);
  if (span.syntax === "wiki" || span.syntax === "yaml") {
    if (target.includes("[") || target.includes("]") || target.includes("#")) return fail();
    const start = span.original.indexOf("[["), end = span.original.lastIndexOf("]]");
    if (start < 0 || end < start + 2) return fail();
    const pipe = span.original.indexOf("|", start + 2), to = pipe >= 0 && pipe < end ? pipe : end;
    return span.original.slice(0, start + 2) + target + suffix + span.original.slice(to);
  }
  const position = markdownDestination(span.original, span.syntax === "definition");
  const old = span.original.slice(position.from, position.to).replace(/\\([\\()[\] ])/g, "$1");
  if (old !== span.link && decodeURIComponent(old) !== decodeURIComponent(span.link)) return fail();
  return span.original.slice(0, position.from) + relative(destination, target) + suffix + span.original.slice(position.to);
}
function spans(text: string, cache: CachedMetadata): Span[] {
  const result: Span[] = [];
  for (const item of [...(cache.links ?? []), ...(cache.embeds ?? [])]) {
    const { start, end } = item.position, original = text.slice(start.offset, end.offset);
    if (original !== item.original || start.offset < 0 || end.offset <= start.offset || end.offset > text.length) return fail();
    if (external(item.link) || item.link.startsWith("#")) continue;
    if (!original.includes("[[") && !original.includes("](")) {
      if (cache.referenceLinks?.some(reference => reference.link === item.link)) continue;
      return fail();
    }
    result.push({ from: start.offset, to: end.offset, original, link: item.link, syntax: original.includes("[[") ? "wiki" : "markdown" });
  }
  for (const item of cache.referenceLinks ?? []) {
    if (external(item.link) || item.link.startsWith("#")) continue;
    const { start, end } = item.position;
    if (start.offset < 0 || end.offset <= start.offset || end.offset > text.length) return fail();
    result.push({ from: start.offset, to: end.offset, original: text.slice(start.offset, end.offset), link: item.link, syntax: "definition" });
  }
  for (const item of cache.frontmatterLinks ?? []) if (!external(item.link) && !item.link.startsWith("#")) result.push({ from: -1, to: -1, original: item.original, link: item.link, syntax: "yaml" });
  if (result.length > PACKAGE_LIMITS.dependencies) return fail();
  return result;
}

/** Native syntax capture plus explicit wiki/external bindings; never guesses basename equivalence. */
export function previewPackageNoteLinks(configuration: PackageConfigPathPreview, manifest: PackageManifest, notes: ReadonlyMap<string, NativeNoteInspection>,
  choices: readonly ConfigPathChoice[], existing: readonly VaultPathEntry[], configDir: string, roots: readonly string[]) {
  const files = configuration.files, explicit = createConfigPathBindings(files, existing, configDir, roots, choices);
  const bindings: ConfigPathBindingOption[] = [], issues: ConfigPathIssue[] = [], changes: ConfigPathChange[] = [], content = new Map<string, Uint8Array>();
  let total = 0, work = 0;
  for (const [fi, file] of files.files.entries()) {
    if (file.role !== "note") continue;
    const inspected = notes.get(file.source), projectId = manifest.rootProjectId, at = ["packageFiles", fi];
    if (!inspected) { issues.push({ projectId, location: at, code: "note-inspection-required" }); continue; }
    const { text, cache } = inspected, edits: { from: number; to: number; replacement: string }[] = [], yaml = new Map<string, string>();
    try {
      for (const [ri, span] of spans(text, cache).entries()) {
        if (++work > PACKAGE_LIMITS.dependencies) return fail();
        const location = [...at, "links", ri], source = span.link, path = splitLink(source).path;
        let defaultTarget: string | undefined;
        // Wiki paths have no sender resolution catalogue in schema1. Even a
        // single selected basename is not evidence that it was the original target.
        if (span.syntax === "markdown" || span.syntax === "definition" || path.startsWith("./") || path.startsWith("../") || path.startsWith("/")) {
          const resolved = resolveRelative(file.source, decodeURIComponent(path));
          if (resolved) try { defaultTarget = files.fileDestination(resolved); } catch { /* Requires an explicit recipient binding. */ }
        }
        const selected = explicit.resolve(projectId, location, source, "file"), target = selected.status === "chosen" ? selected.target.path : selected.status === "invalid" ? undefined : defaultTarget;
        bindings.push({ projectId, location, source, kind: "file", purpose: "note-link", context: file.source,
          mode: selected.status === "chosen" ? "explicit" : selected.status === "invalid" ? "invalid" : defaultTarget ? "selected" : "missing", defaultMode: defaultTarget ? "selected" : "missing",
          ...(defaultTarget ? { defaultTarget } : {}), ...(target ? { target, origin: selected.status === "chosen" ? selected.target.origin : "planned" as const } : {}) });
        if (!target) { issues.push({ projectId, location, source, code: selected.status === "invalid" ? "invalid-binding" : "unbound-file" }); continue; }
        const replacement = rewrite(span, target, file.destination);
        changes.push({ projectId, location, source, destination: target });
        if (span.syntax === "yaml") {
          const key = JSON.stringify([span.original, span.link]), prior = yaml.get(key);
          if (prior !== undefined && prior !== replacement) return fail();
          yaml.set(key, replacement);
        } else edits.push({ from: span.from, to: span.to, replacement });
      }
      if (yaml.size) {
        const position = cache.frontmatterPosition; if (!position) return fail();
        edits.push(...frontmatterLinkEdits(text, { from: position.start.offset, to: position.end.offset }, cache.frontmatterLinks ?? [], (original, link) => yaml.get(JSON.stringify([original, link])) ?? original));
      }
      edits.sort((a, b) => b.from - a.from);
      let output = text, previous = text.length;
      for (const edit of edits) {
        if (edit.from < 0 || edit.to > previous || edit.from >= edit.to) return fail();
        output = output.slice(0, edit.from) + edit.replacement + output.slice(edit.to); previous = edit.from;
      }
      const bytes = new TextEncoder().encode(output); total += bytes.length;
      if (bytes.length > PACKAGE_LIMITS.fileBytes || total > PACKAGE_LIMITS.totalBytes) return fail();
      content.set(file.destination, bytes);
    } catch {
      issues.push({ projectId, location: at, code: "unsupported-note-link" });
    }
  }
  for (const unused of explicit.unused()) issues.push({ projectId: unused.projectId, location: unused.location, source: unused.source, code: "stale-binding" });
  return { content, bindings, issues, changes };
}
