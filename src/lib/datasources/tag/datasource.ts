import type { IFileSystem } from "src/lib/filesystem/filesystem";
import { normalizeTag } from "src/lib/helpers";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";

import { FrontMatterDataSource } from "../frontmatter/datasource";

/**
 * TagDataSource returns a collection of notes that contains a specific tag.
 */
export class TagDataSource extends FrontMatterDataSource {
  constructor(
    readonly fileSystem: IFileSystem,
    project: ProjectDefinition,
    preferences: ProjectsPluginPreferences
  ) {
    super(fileSystem, project, preferences);
  }

  includes(path: string): boolean {
    if (this.project.dataSource.kind !== "tag") {
      return false;
    }

    if (this.project.excludedNotes?.includes(path)) {
      return false;
    }

    const tag = normalizeTag(this.project.dataSource.config.tag);
    if (!tag) return false;

    const file = this.fileSystem.getFile(path);

    if (file) {
      const fileTags = file.readTags();
      if (this.project.dataSource.config.hierarchy) {
        for (const fileTag of fileTags) {
          if (fileTag.startsWith(tag)) {
            return true;
          }
        }
      } else {
        return fileTags.has(tag);
      }
    }

    return false;
  }
}
