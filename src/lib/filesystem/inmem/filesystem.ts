import { IFile, type IFileSystem } from "../filesystem";

class InMemFile extends IFile {
  constructor(
    private readonly _path: string,
    private _content: string,
    private fileSystem: InMemFileSystem
  ) {
    super();
  }

  get basename(): string {
    return this._path.split("/").at(-1) ?? this.path;
  }

  get path(): string {
    return this._path;
  }

  read(): Promise<string> {
    return Promise.resolve(this._content);
  }

  async write(content: string): Promise<void> {
    this._content = content;
  }

  async delete(): Promise<void> {
    this.fileSystem.delete(this._path);
  }

  readTags(): Set<string> {
    const tags = new Set<string>();

    const content = this._content ?? "";

    // 1) Markdown inline tags like #tag, #multi-word_tag, #tag/sub
    const inlineTagRegex = /(^|\s)#([\p{L}\p{N}_\-\/]+)\b/gu;
    for (const match of content.matchAll(inlineTagRegex)) {
      const tag = `#${match[2]}`;
      tags.add(tag);
    }

    // 2) Front matter tags: supports string ("a, b") or array ([a, b])
    //    Simple YAML front matter extraction (--- ... --- at top of file)
    if (content.startsWith("---\n")) {
      const end = content.indexOf("\n---", 4);
      if (end !== -1) {
        const frontMatter = content.slice(4, end + 1);

        // tags:
        //   - tag1
        //   - tag2
        // или: tags: tag1, tag2
        const tagsLine = frontMatter.match(/^tags\s*:\s*([^\n]+)$/m);
        const tagBlock = frontMatter.match(/^tags\s*:\s*\n([\s\S]*?)(?=^[^\s-]|$)/m);

        const tagsLineValue = tagsLine?.[1] ?? "";
        if (tagsLineValue) {
          // comma separated
          const values = tagsLineValue
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          for (const v of values) {
            tags.add(`#${v}`);
          }
        } else {
          const tagBlockValue = tagBlock?.[1] ?? "";
          if (tagBlockValue) {
            // YAML list
            const lines = tagBlockValue
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.startsWith("- "))
              .map((l) => l.slice(2).trim())
              .filter(Boolean);
            for (const v of lines) {
              tags.add(`#${v}`);
            }
          }
        }

        // also support singular 'tag:' similar to obsidian FS
        const singularLine = frontMatter.match(/^tag\s*:\s*([^\n]+)$/m);
        const singularValue = singularLine?.[1] ?? "";
        if (singularValue) {
          const values = singularValue
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          for (const v of values) {
            tags.add(`#${v}`);
          }
        }
      }
    }

    return tags;
  }
}

export class InMemFileSystem implements IFileSystem {
  constructor(readonly files: Record<string, InMemFile>) {}

  create(path: string, content: string): Promise<IFile> {
    if (this.files[path]) {
      throw new Error("File already exist");
    }

    const file = new InMemFile(path, content, this);

    this.files[path] = file;

    return Promise.resolve(file);
  }

  delete(path: string): Promise<void> {
    delete this.files[path];
    return Promise.resolve();
  }

  getAllFiles(): IFile[] {
    return Object.values(this.files);
  }

  getFile(path: string): IFile | null {
    return this.files[path] ?? null;
  }
}
