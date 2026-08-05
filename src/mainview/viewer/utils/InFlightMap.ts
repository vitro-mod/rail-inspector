export class InFlightMap<K, V> {
    private pending = new Map<K, Promise<V>>();

    get(key: K): Promise<V> | undefined {
        return this.pending.get(key);
    }

    has(key: K): boolean {
        return this.pending.has(key);
    }

    getOrCreate(key: K, factory: () => Promise<V> | V): Promise<V> {
        const existing = this.pending.get(key);
        if (existing) {
            return existing;
        }

        const created = Promise.resolve()
            .then(factory)
            .finally(() => {
                this.pending.delete(key);
            });

        this.pending.set(key, created);
        return created;
    }

    clear(): void {
        this.pending.clear();
    }
}
