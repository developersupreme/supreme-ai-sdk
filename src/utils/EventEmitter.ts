/**
 * Type-safe EventEmitter implementation
 */

export type EventListener<T = any> = (data?: T) => void;

export class EventEmitter<Events extends Record<string, any> = Record<string, any>> {
  private events: Map<keyof Events, Set<EventListener>> = new Map();
  protected debug: boolean = false;

  /**
   * Subscribe to an event
   */
  on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
    return this;
  }

  /**
   * Subscribe to an event once
   */
  once<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): this {
    const onceWrapper: EventListener<Events[K]> = (data) => {
      listener(data);
      this.off(event, onceWrapper);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): this {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  /**
   * Emit an event
   */
  emit<K extends keyof Events>(event: K, data?: Events[K]): boolean {
    const listeners = this.events.get(event);
    if (!listeners || listeners.size === 0) return false;

    listeners.forEach(listener => {
      try {
        listener(data as Events[K]);
      } catch (error) {
        if (this.debug) {
          console.error(`Error in event listener for "${String(event)}":`, error);
        }
      }
    });

    return true;
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners<K extends keyof Events>(event?: K): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof Events>(event: K): number {
    const listeners = this.events.get(event);
    return listeners ? listeners.size : 0;
  }
}