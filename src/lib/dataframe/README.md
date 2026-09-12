# Data frames

A data frame is the shared representation of a project's notes. [dataframe.ts](dataframe.ts) defines the types used by sources, views, filters and calculations.

- `fields` describes the columns: name, type and flags such as `derived`.
- `records` contains rows. Each record's `id` is its vault path, and `values` holds the field values.
- `errors`, when present, reports note parsing problems.

For example, a note at `Writing/Draft.md` can contribute a record with `status` and `due_date` values. Its field definitions describe how those values are displayed and interpreted.

In the host types, a missing property and an explicit `null` value are distinct. Do not collapse them when implementing filters. Derived values, such as formula results, are not stored frontmatter fields.

These are implementation types. Third-party views should consult the [custom view API](../../../docs/api.md), including its package compatibility limits.
