# Frontmatter metadata

This module converts between a note's YAML frontmatter and structured values.

- [decodeFrontMatter](decode.ts) reads frontmatter from note text.
- [encodeFrontMatter](encode.ts) applies values to note text.
- [index.ts](index.ts) exports both operations.

The operations return `Either` results; inspect the error branch instead of assuming conversion succeeded. The adjacent tests cover parsing and serialization behavior.

This module handles text conversion. File persistence and editing coordination belong to the [data API](../dataApi.ts) and [filesystem layer](../filesystem/README.md).
