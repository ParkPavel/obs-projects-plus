/** Local row ownership only: no UI key is written into a project definition. */
export class ProjectRows<T extends object> {
  private next = 0;
  private owner: string | undefined;
  private rows: Array<{id: number; value: T; aliases: Set<string>; localKey: string}> = [];
  private seen: readonly T[] = [];
  private keys = new WeakMap<T, string>();

  constructor(private stableId: (value: T) => string | undefined = () => undefined) {}

  private key(value: T): string {
    const cached = this.keys.get(value);
    if (cached !== undefined) return cached;
    const id = this.stableId(value);
    const key = id ? `id:${id}` : `legacy:${JSON.stringify(value, (_key, item: unknown) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]])) : item)}`;
    this.keys.set(value, key);
    return key;
  }

  sync(owner: string, values: readonly T[]): Array<{id: number; value: T}> {
    if (owner !== this.owner) { this.rows = []; this.seen = []; this.owner = owner; }
    if (values.length === this.seen.length && values.every((value, index) => value === this.seen[index])) return this.rows;
    type Row = (typeof this.rows)[number];
    const available = new Map<T, Row[]>();
    const unique = new Map<string, Row | null>();
    for (const row of this.rows) {
      const queue = available.get(row.value) ?? [];
      queue.push(row); available.set(row.value, queue);
      for (const key of new Set([...row.aliases, row.localKey, this.key(row.value)])) {
        unique.set(key, unique.has(key) && unique.get(key) !== row ? null : row);
      }
    }
    const counts = new Map<string, number>(), used = new Set<number>();
    for (const value of values) { const key = this.key(value); counts.set(key, (counts.get(key) ?? 0) + 1); }
    this.rows = values.map(value => {
      const exact = available.get(value)?.find(row => !used.has(row.id));
      const key = this.key(value), candidate = counts.get(key) === 1 ? unique.get(key) : undefined;
      const matched = exact ?? (candidate && !used.has(candidate.id) ? candidate : undefined);
      const aliases = matched?.aliases ?? new Set<string>();
      // Keep accepted parent snapshots, not every live keystroke. An older
      // parent acknowledgement must not retire the row's active draft.
      if (!exact) aliases.add(key);
      const row = {id: matched?.id ?? this.next++, value, aliases, localKey: matched?.localKey ?? key};
      used.add(row.id); return row;
    });
    this.seen = [...values];
    return this.rows;
  }

  index(owner: string, values: readonly T[], id: number): number {
    return this.sync(owner, values).findIndex(row => row.id === id);
  }

  replace(id: number, value: T): void {
    const row = this.rows.find(row => row.id === id);
    if (row) { row.value = value; row.localKey = this.key(value); }
  }
}
