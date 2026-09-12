# Filesystem abstraction

[filesystem.ts](filesystem.ts) separates note operations from the Obsidian runtime. It defines `IFile`, `IFileSystem` and `IFileSystemWatcher`.

The [Obsidian implementation](obsidian) accesses vault files. The [in-memory implementation](inmem) lets tests exercise note behavior without starting Obsidian.

`IFile` exposes file content, path, tags and timestamps. Its optional `processFrontMatter` operation returns whether the implementation supports a platform-managed frontmatter mutation. Callers need to handle the unsupported case; the default implementation returns `false`.

Use the existing [data API](../dataApi.ts) for product editing flows so filesystem writes remain coordinated with records and error reporting. These abstractions are implementation details, not a public plugin API.
