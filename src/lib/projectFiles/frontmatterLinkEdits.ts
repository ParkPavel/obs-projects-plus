import { isAlias, isMap, isScalar, isSeq, parseDocument, Scalar, type Range } from "yaml";

import { projectFileError } from "./document";

/** One cached frontmatter link: the raw `original` text and its `link` target. */
export interface FrontmatterLinkReference {
  readonly original: string;
  readonly link: string;
}

/** A replacement inside the original note text; `from`/`to` are absolute offsets. */
export interface FrontmatterLinkEdit {
  readonly from: number;
  readonly to: number;
  readonly replacement: string;
}

const MAX_LINK_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_LINK_REFERENCES = 4096;
const MAX_LINK_NODES = 16384;
const MAX_LINK_DEPTH = 32;
const OPEN_DELIMITER = /^---[ \t]*(?:\r?\n|$)/;
const CLOSE_DELIMITER = /(?:^|\r?\n)(?:---|\.\.\.)[ \t]*(?:\r?\n[ \t]*)*$/;
const ANCHOR_TOKEN = /(?:^|\s)(&[^\s]+)\s*$/;

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

/**
 * Validates the frontmatter range and strips its `---` delimiter lines, so all
 * YAML offsets stay relative to the parsed content.
 */
function frontmatterSlice(text: string, range: { from: number; to: number }): { offset: number; content: string } {
  if (!range || !Number.isInteger(range.from) || !Number.isInteger(range.to) ||
      range.from < 0 || range.to <= range.from || range.to > text.length) throw projectFileError("invalid frontmatter range");
  const slice = text.slice(range.from, range.to);
  const open = OPEN_DELIMITER.exec(slice);
  const offset = range.from + (open ? open[0].length : 0);
  const body = open ? slice.slice(open[0].length) : slice;
  const close = CLOSE_DELIMITER.exec(body);
  return { offset, content: close ? body.slice(0, close.index) : body };
}

/**
 * Refuses scalar styles whose source range cannot be replaced safely. Plain,
 * quoted and multi-line plain scalars are quotable; tagged and block scalars
 * would change meaning, and an anchor is only kept when its token sits
 * immediately before the replaced range.
 */
function assertEditable(node: Scalar, range: Range, content: string): void {
  if (node.tag !== undefined) throw projectFileError("unsupported tagged scalar");
  if (node.type === Scalar.BLOCK_LITERAL || node.type === Scalar.BLOCK_FOLDED) throw projectFileError("unsupported block scalar");
  const anchor = node.anchor;
  if (anchor === undefined) return;
  const match = ANCHOR_TOKEN.exec(content.slice(0, range[0]));
  if (!match || match[1] !== `&${anchor}`) throw projectFileError("unsupported anchored scalar");
}

/**
 * Computes position-preserving wikilink replacements for one YAML frontmatter.
 *
 * Only string scalar values are inspected; mapping keys, aliases and anchors on
 * untouched nodes keep their original bytes. Each changed scalar is replaced as
 * a whole with `JSON.stringify(value)`, a valid quoted YAML string, and the
 * trailing comment of the scalar stays outside the replaced range. References
 * that cannot be found in a value are refused instead of silently omitted.
 * The result is an immutable, ascending, non-overlapping list; applying it in
 * reverse order reproduces the new note text.
 */
export function frontmatterLinkEdits(
  text: string,
  range: { from: number; to: number },
  references: readonly FrontmatterLinkReference[],
  rewrite: (original: string, link: string) => string,
): readonly FrontmatterLinkEdit[] {
  if (typeof text !== "string" || text.length > MAX_LINK_TEXT_BYTES || utf8Length(text) > MAX_LINK_TEXT_BYTES) throw projectFileError("link input too large");
  if (!Array.isArray(references)) throw projectFileError("invalid link references");
  const links: readonly FrontmatterLinkReference[] = references;
  if (links.length > MAX_LINK_REFERENCES) throw projectFileError("too many link references");
  if (typeof rewrite !== "function") throw projectFileError("invalid rewrite callback");

  const { offset, content } = frontmatterSlice(text, range);
  const document = parseDocument(content, { keepSourceTokens: true });
  const [parseError] = document.errors;
  if (parseError) throw projectFileError(`invalid frontmatter yaml: ${parseError.message}`);

  const candidates: { readonly node: Scalar; readonly value: string }[] = [];
  const stack: { node: unknown; depth: number; key: boolean }[] = [{ node: document.contents, depth: 0, key: false }];
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > MAX_LINK_NODES || item.depth > MAX_LINK_DEPTH) throw projectFileError("frontmatter too complex");
    const node = item.node;
    if (node === null || node === undefined) continue;
    if (isScalar(node)) {
      if (!item.key && typeof node.value === "string") candidates.push({ node, value: node.value });
      continue;
    }
    if (isMap(node)) {
      // Pushed in reverse so the stack pops pairs in document order.
      for (let index = node.items.length - 1; index >= 0; index--) {
        const pair = node.items[index]!;
        stack.push({ node: pair.value, depth: item.depth + 1, key: item.key });
        stack.push({ node: pair.key, depth: item.depth + 1, key: true });
      }
      continue;
    }
    if (isSeq(node)) {
      for (let index = node.items.length - 1; index >= 0; index--) stack.push({ node: node.items[index], depth: item.depth + 1, key: item.key });
      continue;
    }
    if (isAlias(node)) continue;
    throw projectFileError("unsupported frontmatter node");
  }

  // References are consumed in the given order, the order CachedMetadata lists
  // them. Each scalar keeps its original value plus a cursor, so a replacement
  // is never matched again and inserted text cannot be rewritten twice.
  const drafts = new Map<Scalar, { readonly original: string; value: string; cursor: number }>();
  let scanned = 0;
  for (const [index, reference] of links.entries()) {
    if (!reference || typeof reference.original !== "string" || !reference.original || typeof reference.link !== "string") {
      throw projectFileError(`invalid link reference ${index}`);
    }
    let found = false;
    for (const candidate of candidates) {
      const draft = drafts.get(candidate.node);
      const current = draft ? draft.value : candidate.value;
      if ((scanned += current.length) > 16 * 1024 * 1024) throw projectFileError("frontmatter link work too complex");
      const at = current.indexOf(reference.original, draft ? draft.cursor : 0);
      if (at < 0) continue;
      const replacement = rewrite(reference.original, reference.link);
      if (typeof replacement !== "string") throw projectFileError("invalid rewrite result");
      if (replacement.length > MAX_LINK_TEXT_BYTES) throw projectFileError("rewrite result too large");
      const next = current.slice(0, at) + replacement + current.slice(at + reference.original.length);
      if (next.length > MAX_LINK_TEXT_BYTES || utf8Length(next) > MAX_LINK_TEXT_BYTES) throw projectFileError("rewritten scalar too large");
      drafts.set(candidate.node, { original: candidate.value, value: next, cursor: at + replacement.length });
      found = true;
      break;
    }
    if (!found) throw projectFileError(`cached link not found: ${reference.original}`);
  }

  const edits: FrontmatterLinkEdit[] = [];
  for (const [node, draft] of drafts) {
    if (draft.value === draft.original) continue;
    const nodeRange = node.range;
    if (!nodeRange) throw projectFileError("missing scalar range");
    assertEditable(node, nodeRange, content);
    edits.push(Object.freeze({
      from: offset + nodeRange[0],
      to: offset + nodeRange[1],
      replacement: JSON.stringify(draft.value),
    }));
  }
  if (edits.length > MAX_LINK_REFERENCES) throw projectFileError("too many link edits");
  edits.sort((left, right) => left.from - right.from || left.to - right.to);
  let previousTo = -1;
  for (const edit of edits) {
    if (edit.from < previousTo || edit.from < range.from || edit.to > range.to || edit.from >= edit.to) throw projectFileError("invalid frontmatter edit range");
    previousTo = edit.to;
  }
  return Object.freeze(edits);
}
