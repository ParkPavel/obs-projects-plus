import type { App } from "obsidian";
import type { DataviewApi } from "./api";

/** The same host ports used by the SDK, without loading its bundled parsers. */
interface DataviewHost {
  readonly plugins?: {
    readonly enabledPlugins?: ReadonlySet<string>;
    readonly plugins?: { readonly dataview?: { readonly api?: DataviewApi } };
  };
}

export function getAPI(app?: App): DataviewApi | undefined {
  // Never fall through to a different window's API when an app was supplied.
  if (app) return (app as unknown as DataviewHost).plugins?.plugins?.dataview?.api;
  return typeof window === "undefined"
    ? undefined
    : (window as Window & { DataviewAPI?: DataviewApi }).DataviewAPI;
}

export function isPluginEnabled(app?: App): boolean {
  return (app as unknown as DataviewHost | undefined)?.plugins?.enabledPlugins?.has("dataview") ?? false;
}
