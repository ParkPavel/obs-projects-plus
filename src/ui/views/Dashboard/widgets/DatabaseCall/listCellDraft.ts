import { get, writable } from "svelte/store";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";

/** An independent typed list draft with stable item identities. */
export function createListCellDraft(value: Optional<DataValue>) {
  const initial = Array.isArray(value) ? value : value == null ? [] : [value];
  let nextId = initial.length;
  const items = writable<Array<{ id: number; value: Optional<DataValue> }>>(initial.map((value, id) => ({ id, value })));
  return {
    subscribe: items.subscribe,
    add: () => items.update(items => [...items, { id: nextId++, value: "" }]),
    change: (id: number, value: Optional<DataValue>) => items.update(items => items.map(item => item.id === id ? { id, value } : item)),
    remove: (id: number) => items.update(items => items.filter(item => item.id !== id)),
    value(): Optional<DataValue> {
      const next = get(items).map(item => item.value);
      return next.length === initial.length && next.every((value, index) => value === initial[index]) ? value : next;
    },
  };
}
