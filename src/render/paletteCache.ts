export class PaletteCache<Value> {
  private readonly values = new Map<string, Value>();

  constructor(readonly maxEntries = 256) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("maxEntries must be a positive integer");
    }
  }

  get size(): number {
    return this.values.size;
  }

  get(key: string): Value | undefined {
    const value = this.values.get(key);
    if (value === undefined) return undefined;
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key: string, value: Value): void {
    if (this.values.has(key)) {
      this.values.delete(key);
    }
    this.values.set(key, value);
    while (this.values.size > this.maxEntries) {
      const oldest = this.values.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  clear(): void {
    this.values.clear();
  }
}
