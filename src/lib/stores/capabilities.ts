import { isPluginEnabled } from "src/lib/datasources/dataview/host";
import { derived } from "svelte/store";

import { app } from "./obsidian";

export const capabilities = derived(app, ($app) => {
  return {
    dataview: isPluginEnabled($app),
  };
});
