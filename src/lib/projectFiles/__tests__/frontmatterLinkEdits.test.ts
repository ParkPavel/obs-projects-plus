export {};
// The repository-wide `src/__mocks__/yaml.js` stub exposes only parse/stringify,
// while this module needs the real CST parser, so load the installed build here.
jest.mock("yaml", () => {
  const nodePath = require("node:path");
  const packageRoot = nodePath.dirname(require.resolve("yaml/package.json"));
  return jest.requireActual(nodePath.join(packageRoot, "dist", "index.js"));
});

type LinkEdit = { readonly from: number; readonly to: number; readonly replacement: string };

const yaml = require("yaml") as typeof import("yaml");
const { frontmatterLinkEdits } = require("../frontmatterLinkEdits") as typeof import("../frontmatterLinkEdits");

const wrap = (frontmatter: string): { text: string; range: { from: number; to: number } } => {
  const text = `---\n${frontmatter}\n---\nBody [[Note]] stays.\n`;
  return { text, range: { from: 0, to: 4 + frontmatter.length + 4 } };
};

test("does not enter compound mapping keys and bounds repeated whole-scalar copying", () => {
  const { text, range } = wrap("? { nested: '[[Note]]' }\n: key value\nvalue: '[[Note]]'");
  const edits = frontmatterLinkEdits(text, range, [{ original: "[[Note]]", link: "Note" }], () => "[[Target]]");
  expect(edits).toHaveLength(1);
  expect(text.slice(edits[0]!.from, edits[0]!.to)).toBe("'[[Note]]'");
  expect(text.slice(0, edits[0]!.from)).toContain("nested: '[[Note]]'");
  const large = wrap(`value: '${"[[Note]] ".repeat(20)}${"a".repeat(2 * 1024 * 1024)}'`);
  expect(() => frontmatterLinkEdits(large.text, large.range, Array.from({ length: 20 }, () => ({ original: "[[Note]]", link: "Note" })), () => "[[Target]]")).toThrow(/work too complex/);
});

const apply = (text: string, edits: readonly LinkEdit[]): string => {
  let result = text;
  for (const edit of [...edits].reverse()) result = result.slice(0, edit.from) + edit.replacement + result.slice(edit.to);
  return result;
};

const split = (text: string): { frontmatter: string; body: string } => {
  const close = text.indexOf("\n---", 4);
  if (close < 0) return { frontmatter: text.slice(4), body: "" };
  const bodyStart = text.indexOf("\n", close + 4);
  return { frontmatter: text.slice(4, close), body: text.slice(bodyStart < 0 ? text.length : bodyStart + 1) };
};

const parseFrontmatter = (value: string): Record<string, unknown> => {
  const doc = yaml.parseDocument(value) as { errors: { message: string }[]; toJS: () => Record<string, unknown> };
  expect(doc.errors.map(error => error.message)).toEqual([]);
  return doc.toJS();
};

const rename = (original: string): string => original.replace("Note", "NewNote");

test("edits quoted and plain values, keeps comments, body and Unicode intact", () => {
  const { text, range } = wrap('title: "Проект — [[Note]] 🌍"\nsummary: See Note here # keep me\ncount: 2\n');
  const edits = frontmatterLinkEdits(text, range, [{ original: "Note", link: "Note" }, { original: "Note", link: "Note" }], rename);
  expect(edits).toHaveLength(2);
  expect(Object.isFrozen(edits)).toBe(true);
  expect(Object.isFrozen(edits[0])).toBe(true);
  expect(edits[0]!.from).toBeLessThan(edits[1]!.from);
  for (const edit of edits) {
    expect(edit.from).toBeGreaterThanOrEqual(range.from);
    expect(edit.to).toBeLessThanOrEqual(range.to);
  }
  const updated = split(apply(text, edits));
  expect(updated.body).toBe("Body [[Note]] stays.\n");
  expect(updated.frontmatter).toContain('title: "Проект — [[NewNote]] 🌍"');
  expect(updated.frontmatter).toContain('summary: "See NewNote here" # keep me');
  expect(updated.frontmatter).toContain("count: 2\n");
  const data = parseFrontmatter(updated.frontmatter);
  expect(data['title']).toBe("Проект — [[NewNote]] 🌍");
  expect(data['summary']).toBe("See NewNote here");
  expect(data['count']).toBe(2);
});

test("edits two references inside one scalar as a single replacement", () => {
  const { text, range } = wrap('links: "[[A]] and [[B]]"\n');
  const edits = frontmatterLinkEdits(text, range, [{ original: "A", link: "A" }, { original: "B", link: "B" }], original => `${original}2`);
  expect(edits).toHaveLength(1);
  const data = parseFrontmatter(split(apply(text, edits)).frontmatter);
  expect(data['links']).toBe("[[A2]] and [[B2]]");
});

test("consumes references in document order across scalars", () => {
  const { text, range } = wrap('first: "[[Note]]"\nsecond: "[[Note]]"\n');
  const edits = frontmatterLinkEdits(text, range, [{ original: "Note", link: "A" }, { original: "Note", link: "B" }], (_original, link) => link);
  expect(edits).toHaveLength(2);
  const data = parseFrontmatter(split(apply(text, edits)).frontmatter);
  expect(data['first']).toBe("[[A]]");
  expect(data['second']).toBe("[[B]]");
});

test("keeps mapping keys unchanged while editing the value", () => {
  const { text, range } = wrap('"[[Note]]": "[[Note]]"\n');
  const edits = frontmatterLinkEdits(text, range, [{ original: "Note", link: "Note" }], () => "NewNote");
  expect(edits).toHaveLength(1);
  const frontmatter = split(apply(text, edits)).frontmatter;
  expect(frontmatter).toContain('"[[Note]]": "[[NewNote]]"');
  expect(parseFrontmatter(frontmatter)).toEqual({ "[[Note]]": "[[NewNote]]" });
});

test("edits nested maps and arrays but leaves unrelated scalars alone", () => {
  const { text, range } = wrap('meta:\n  title: "[[Note]]"\n  tags:\n    - "[[Note]]"\n    - plain\n');
  const edits = frontmatterLinkEdits(text, range, [{ original: "Note", link: "Note" }, { original: "Note", link: "Note" }], () => "NewNote");
  expect(edits).toHaveLength(2);
  const data = parseFrontmatter(split(apply(text, edits)).frontmatter) as { meta: { title: string; tags: string[] } };
  expect(data.meta.title).toBe("[[NewNote]]");
  expect(data.meta.tags).toEqual(["[[NewNote]]", "plain"]);
});

test("preserves anchors and aliases when the anchored scalar is edited", () => {
  const { text, range } = wrap('title: &t "keep [[Note]]"\nalias: *t\n');
  const edits = frontmatterLinkEdits(text, range, [{ original: "Note", link: "Note" }], () => "NewNote");
  expect(edits).toHaveLength(1);
  const updated = apply(text, edits);
  expect(updated).toContain('title: &t "keep [[NewNote]]"');
  expect(parseFrontmatter(split(updated).frontmatter)).toEqual({ title: "keep [[NewNote]]", alias: "keep [[NewNote]]" });
});

test("refuses tagged, block and unprovable anchored scalars explicitly", () => {
  const tagged = wrap('title: !!str "keep [[Note]]"\n');
  expect(() => frontmatterLinkEdits(tagged.text, tagged.range, [{ original: "Note", link: "Note" }], () => "x")).toThrow(/tagged/);
  const block = wrap('title: |\n  keep [[Note]]');
  expect(() => frontmatterLinkEdits(block.text, block.range, [{ original: "Note", link: "Note" }], () => "x")).toThrow(/block/);
  const anchored = wrap('title: &t # comment\n  "keep [[Note]]"');
  expect(() => frontmatterLinkEdits(anchored.text, anchored.range, [{ original: "Note", link: "Note" }], () => "x")).toThrow(/anchored/);
});

test("rewrites every occurrence even when the replacement contains the original", () => {
  const { text, range } = wrap('title: "[[Note]] and [[Note]]"\n');
  const edits = frontmatterLinkEdits(text, range, [{ original: "Note", link: "Note" }, { original: "Note", link: "Note" }], () => "NewNote");
  expect(edits).toHaveLength(1);
  const data = parseFrontmatter(split(apply(text, edits)).frontmatter);
  expect(data['title']).toBe("[[NewNote]] and [[NewNote]]");
});

test("round-trips escaped newlines and multi-line plain values as quoted YAML", () => {
  const escaped = wrap('title: "line1\\nline2 [[Note]]"');
  const escapedEdits = frontmatterLinkEdits(escaped.text, escaped.range, [{ original: "Note", link: "Note" }], () => "NewNote");
  const escapedText = apply(escaped.text, escapedEdits);
  expect(escapedText).toContain('title: "line1\\nline2 [[NewNote]]"');
  expect(parseFrontmatter(split(escapedText).frontmatter)['title']).toBe("line1\nline2 [[NewNote]]");

  const plain = wrap('title: See Note\n  here');
  const plainEdits = frontmatterLinkEdits(plain.text, plain.range, [{ original: "Note", link: "Note" }], () => "NewNote");
  const plainText = apply(plain.text, plainEdits);
  expect(plainText).toContain('title: "See NewNote here"');
  expect(parseFrontmatter(split(plainText).frontmatter)['title']).toBe("See NewNote here");
});

test("returns no edits when nothing changes and accepts empty references", () => {
  const { text, range } = wrap('title: "[[Note]]"\n');
  expect(frontmatterLinkEdits(text, range, [], () => "x")).toEqual([]);
  expect(frontmatterLinkEdits(text, range, [{ original: "Note", link: "Note" }], original => original)).toEqual([]);
});

test("refuses malformed ranges, yaml, complexity, missing references and bad callbacks", () => {
  const { text, range } = wrap('title: "[[Note]]"\n');
  const reference = [{ original: "Note", link: "Note" }];
  expect(() => frontmatterLinkEdits(text, null as unknown as { from: number; to: number }, [], () => "")).toThrow();
  expect(() => frontmatterLinkEdits(text, { from: 2, to: 1 }, [], () => "")).toThrow();
  expect(() => frontmatterLinkEdits(text, { from: 0, to: text.length + 1 }, [], () => "")).toThrow();
  expect(() => frontmatterLinkEdits(text, { from: 0, to: 1.5 }, [], () => "")).toThrow();

  const broken = wrap('title: [unclosed');
  expect(() => frontmatterLinkEdits(broken.text, broken.range, [], () => "")).toThrow(/yaml/);
  expect(() => frontmatterLinkEdits(text, range, [{ original: "Missing", link: "Missing" }], () => "x")).toThrow(/not found/);
  expect(() => frontmatterLinkEdits(text, range, reference, () => 4 as unknown as string)).toThrow(/rewrite/);

  const deep = wrap(`title: ${"[".repeat(40)}x${"]".repeat(40)}`);
  expect(() => frontmatterLinkEdits(deep.text, deep.range, [], () => "")).toThrow(/complex/);
  const many = wrap(`title: [${new Array(20000).fill("0").join(",")}]`);
  expect(() => frontmatterLinkEdits(many.text, many.range, [], () => "")).toThrow(/complex/);
  const tooMany = new Array(4097).fill({ original: "Note", link: "Note" });
  expect(() => frontmatterLinkEdits(text, range, tooMany, () => "x")).toThrow(/references/);
  const huge = "a".repeat(4 * 1024 * 1024 + 1);
  expect(() => frontmatterLinkEdits(huge, { from: 0, to: 1 }, [], () => "")).toThrow(/large/);
});
