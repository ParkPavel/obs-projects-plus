# Data sources

A data source converts a project selection into a [data frame](../dataframe/README.md). The contract and factory are in [index.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/datasources/index.ts).

| Source | Selection |
| --- | --- |
| [Folder](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/datasources/folder) | Notes under a configured path |
| [Tag](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/datasources/tag) | Notes matching a tag |
| [Native query](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/datasources/native-query) | The plugin's own query implementation |
| [Dataview](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/datasources/dataview) | A query evaluated through the optional Dataview plugin |

[Frontmatter](https://github.com/ParkPavel/obs-projects-plus/tree/main/src/lib/datasources/frontmatter) supplies shared parsing for sources that read note properties. Source selection and merging helpers in this directory support projects with additional sources.

The `DataSource` contract includes `queryAll()`, `queryOne(file, fields)`, `includes(path)` and `readonly()`. Implementations with their own caches can supply `refresh()`.

The factory returns a resolution object. In particular, missing Dataview produces an `unavailable` result; callers should display that state rather than treating it as an empty successful query.

These source interfaces are internal to the plugin. See the [architecture map](../../../docs/architecture.md) for their callers.
