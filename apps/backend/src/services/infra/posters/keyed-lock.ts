export class KeyedLock {
  private readonly tailByKey = new Map<string, Promise<void>>();
  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tailByKey.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = () => resolve();
    });
    this.tailByKey.set(key, current);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.tailByKey.get(key) === current) {
        this.tailByKey.delete(key);
      }
    }
  }
}
