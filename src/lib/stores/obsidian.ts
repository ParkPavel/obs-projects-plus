import type { App } from "obsidian";
import { writable } from "svelte/store";

import type ProjectsPlugin from "src/main";

export const app = writable<App>();
export const plugin = writable<ProjectsPlugin>();
