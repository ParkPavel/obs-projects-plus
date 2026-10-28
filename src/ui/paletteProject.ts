import { getContext, setContext } from "svelte";
import { readable, type Readable } from "svelte/store";
import { createFavoritesStore } from "src/lib/stores/palettes";

const KEY = Symbol("ppp-palette-project");
export function providePaletteProject(project: Readable<string | undefined>): void { setContext(KEY, project); }
export function useFavoritesStore() {
  return createFavoritesStore(getContext<Readable<string | undefined> | undefined>(KEY) ?? readable(undefined));
}
