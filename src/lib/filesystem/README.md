# Filesystem abstraction

[filesystem.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/filesystem/filesystem.ts) separates note operations from the Obsidian runtime. It defines `IFile`, `IFileSystem` and `IFileSystemWatcher`.

The [Obsidian implementation](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/filesystem/obsidian) accesses vault files. The [in-memory implementation](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/filesystem/inmem) lets tests exercise note behavior without starting Obsidian.

`IFile` exposes file content, path, tags and timestamps. Its optional `processFrontMatter` operation returns whether the implementation supports a platform-managed frontmatter mutation. Callers need to handle the unsupported case; the default implementation returns `false`.

Use the existing [data API](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/dataApi.ts) for product editing flows so filesystem writes remain coordinated with records and error reporting. These abstractions are implementation details, not a public plugin API.
