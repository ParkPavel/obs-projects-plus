/** Local row ownership only: no UI key is written into a project definition. */
export class ProjectRows<T extends object> {
  private next = 0;
  private owner: string | undefined;
  private rows: Array<{id: number; value: T}> = [];
  private seen: readonly T[] = [];

  sync(owner: string, values: readonly T[]): Array<{id: number; value: T}> {
    if (owner !== this.owner) { this.rows = []; this.seen = []; this.owner = owner; }
    if (values.length === this.seen.length && values.every((value, index) => value === this.seen[index])) return this.rows;
    const available = new Map<T, Array<{id: number; value: T}>>();
    for (const row of this.rows) {
      const queue = available.get(row.value) ?? [];
      queue.push(row); available.set(row.value, queue);
    }
    this.rows = values.map(value => available.get(value)?.shift() ?? {id: this.next++, value});
    this.seen = [...values];
    return this.rows;
  }

  index(owner: string, values: readonly T[], id: number): number {
    return this.sync(owner, values).findIndex(row => row.id === id);
  }

  replace(id: number, value: T): void {
    const row = this.rows.find(row => row.id === id);
    if (row) row.value = value;
  }
}
