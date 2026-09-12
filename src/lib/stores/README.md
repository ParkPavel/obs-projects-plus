# Application stores

This directory contains Svelte stores and related coordination helpers used by the plugin.

| File | Responsibility |
| --- | --- |
| [dataframe.ts](dataframe.ts) | Current records, fields, source and data invalidation |
| [settings.ts](settings.ts) | Reactive plugin settings |
| [obsidian.ts](obsidian.ts) | Obsidian app and plugin references |
| [customViews.ts](customViews.ts) | Registered view instances |
| [commandBus.ts](commandBus.ts) | Application command delivery |
| [i18n.ts](i18n.ts) | Interface language and translation setup |
| [translations](translations) | English, Russian, Ukrainian and Simplified Chinese strings |

The dataframe store notifies registered invalidation callbacks before applying mutations. Consumers with derived caches rely on that ordering. Release registrations and subscriptions when their owner is disposed.

Stores are internal implementation interfaces. Use the [custom view contract](../../../docs/api.md) when integrating another plugin instead of importing stores directly.
