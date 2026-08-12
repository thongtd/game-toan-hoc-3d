/**
 * Minimal typed event emitter.
 *
 * Deliberately hand-written: the game only needs subscribe/emit for a closed
 * set of events, which does not justify pulling in a dependency.
 */
export type EventMap = Record<string, unknown>;

export type Listener<T> = (payload: T) => void;

export class TypedEmitter<Events extends EventMap> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let bucket = this.listeners.get(type);
    if (bucket === undefined) {
      bucket = new Set();
      this.listeners.set(type, bucket);
    }
    bucket.add(listener);
    return () => {
      this.off(type, listener);
    };
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const bucket = this.listeners.get(type);
    if (bucket === undefined) return;
    // Copy so a listener that unsubscribes during dispatch cannot skip others.
    for (const listener of [...bucket]) {
      (listener as Listener<Events[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
