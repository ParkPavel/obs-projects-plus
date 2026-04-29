import { either } from "fp-ts";
import { encodeFrontMatter, decodeFrontMatter } from "../metadata";

export abstract class IFile {
  abstract get basename(): string;
  abstract get path(): string;

  abstract write(content: string): Promise<void>;
  abstract read(): Promise<string>;
  abstract delete(): Promise<void>;
  abstract readTags(): Set<string>;

  /**
   * Safe frontmatter mutation that preserves the file body.
   *
   * Optional: returns `true` and resolves once the callback has applied
   * changes through the underlying platform API (Obsidian's
   * `fileManager.processFrontMatter`, which takes a write lock and
   * leaves the body intact). Returns `false` on filesystem
   * implementations that do not support it — callers must fall back to
   * the read-modify-write path.
   *
   * Closes F6 (Phase 3): inline DataTable edits no longer risk losing
   * user edits made concurrently in the native editor.
   */
  async processFrontMatter(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _fn: (frontmatter: Record<string, unknown>) => void,
  ): Promise<boolean> {
    return false;
  }

   
  async readValues(): Promise<Record<string, any>> {
    const data = await this.read();

    const values = decodeFrontMatter(data);

    return either.isRight(values) ? values.right : {};
  }

   
  async writeValues(values: Record<string, any>): Promise<void> {
    const data = await this.read();

    const updatedData = encodeFrontMatter(data, values, "PLAIN");

    if (either.isRight(updatedData)) {
      await this.write(updatedData.right);
    }
  }
}

export interface IFileSystem {
  create(path: string, content: string): Promise<IFile>;
  getFile(path: string): IFile | null;
  getAllFiles(): IFile[];
}

export interface IFileSystemWatcher {
  onCreate(callback: (file: IFile) => Promise<void>): void;
  onDelete(callback: (file: IFile) => Promise<void>): void;
  onChange(callback: (file: IFile) => Promise<void>): void;
  onRename(callback: (file: IFile, oldPath: string) => Promise<void>): void;
}
