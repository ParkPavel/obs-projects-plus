# Custom view types

[Русский](README-RU.md)

This package contains the `ProjectView` base class and TypeScript declarations used by third-party views for Projects Plus. It originates from the custom view extension in Marcus Olsson's [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects).

Start with the [English API reference](../docs/api.md) or [русский справочник](../docs/api-RU.md) for registration, lifecycle and an example.

## Compatibility

The API is experimental. This directory declares package version `3.0.0`; that version is separate from the plugin version. Compare [index.ts](index.ts) with the host's [customViewApi.ts](../src/customViewApi.ts) when targeting a release. The package is not a complete mirror of the current host: notably, it lacks `updateProps` and the complete filter payload. The API reference documents the differences relevant to view authors.

Use the `viewApi` instance supplied by the host. The class in this package contains empty method bodies for typing; constructing it does not create a working persistence service, and its class identity is not the host implementation's identity.

## License

[package.json](package.json) declares the MIT license for this package. Preserve applicable upstream attribution when redistributing it. The host plugin has its own [Apache 2.0 license](../LICENSE).
