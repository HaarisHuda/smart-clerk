import type { RealtimeEvent } from "./types";

const listeners = new Set<(event: RealtimeEvent) => void>();

export function publishEvent(event: RealtimeEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeToEvents(listener: (event: RealtimeEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
