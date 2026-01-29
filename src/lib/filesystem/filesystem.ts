import { either } from "fp-ts";
import { encodeFrontMatter, decodeFrontMatter } from "../metadata";

export abstract class IFile {
  abstract get basename(): string;
  abstract get path(): string;

  abstract write(content: string): Promise<void>;
  abstract read(): Promise<string>;
  abstract delete(): Promise<void>;
  abstract readTags(): Set<string>;

  async readValues(): Promise<Record<string, any>> {
    const data = await this.read();

    const values = decodeFrontMatter(data);

    return either.isRight(values) ? values.right : {};
  }

  async writeValues(values: Record<string, any>): Promise<void> {
    const data = await this.read();

    const updatedData = encodeFrontMatter(data, values, "PLAIN");

    if (either.isRight(updatedData)) {
      this.write(updatedData.right);
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
