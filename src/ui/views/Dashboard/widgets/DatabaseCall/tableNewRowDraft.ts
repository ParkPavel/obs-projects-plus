import { writable } from "svelte/store";

/** A new note remains a draft until its single create operation is acknowledged. */
export function createTableNewRowDraft(write: (name: string) => void | Promise<void>, errorText: (error: unknown) => string) {
  let state = { active: false, name: "", saving: false, error: "", generation: 0, focus: 0, retry: 0 };
  const store = writable(state);
  let alive = true, context: string | undefined;
  const set = (patch: Partial<typeof state>) => { if (alive) { state = { ...state, ...patch }; store.set(state); } };
  const close = () => set({ active: false, name: "", error: "", generation: state.generation + 1 });
  return {
    subscribe: store.subscribe,
    context(next: string): void { if (context !== undefined && context !== next) close(); context = next; },
    open(): void { if (alive && !state.saving) set({ active: true, focus: state.focus + 1 }); },
    input(name: string): void { if (!state.saving) set({ name, error: "" }); },
    cancel(): void { if (!state.saving) close(); },
    destroy(): void { alive = false; },
    async commit(keepOpen: boolean): Promise<void> {
      if (!alive || !state.active || state.saving) return;
      const name = state.name.trim(), generation = state.generation;
      if (!name) { close(); return; }
      set({ saving: true, error: "" });
      try {
        await write(name);
        if (alive && state.generation === generation) set({ active: keepOpen, name: "", generation: generation + 1, focus: state.focus + (keepOpen ? 1 : 0) });
      } catch (error) {
        if (alive && state.generation === generation) {
          set({ error: errorText(error), retry: state.retry + 1 });
          console.error("[Projects+] new table record was not created", error);
        }
      } finally { set({ saving: false }); }
    },
  };
}
