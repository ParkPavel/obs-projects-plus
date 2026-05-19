import { writable, get, type Readable, type Writable } from "svelte/store";

import type { DataFrame } from "src/lib/dataframe/dataframe";

/**
 * DataProvider Registry — per-canvas, context-scoped.
 *
 * Spec: `.ai_internal/New-specification/DATA_PROVIDER_SPEC.md` (v1.1).
 *
 * The registry is created **once per canvas** (e.g. each DashboardCanvas)
 * via {@link createDataProviderRegistry} and shared with descendant
 * widgets through Svelte Context API using {@link DATA_PROVIDER_REGISTRY_CONTEXT_KEY}.
 *
 * It is **not** a global singleton — each canvas owns its own registry
 * so two side-by-side dashboards never collide on provider ids.
 */

/**
 * A named source of data that other widgets on the same canvas can
 * subscribe to. Registered by a "source" widget (e.g. Database Window)
 * on mount, unregistered on destroy.
 */
export interface DataProvider {
  /** Stable identifier (typically `WidgetDefinition.id`). */
  readonly id: string;
  /** Human-readable display name (e.g. widget title). */
  readonly name: string;
  /** Reactive store exposing the currently processed frame. */
  readonly frame$: Readable<DataFrame>;
  /**
   * Re-evaluate the underlying frame and push the new value into
   * `frame$`. Called by the registry when bulk invalidation is needed
   * (e.g. after a vault event), or directly by the provider's owner.
   */
  readonly refresh: () => void;
}

/**
 * A per-canvas store of {@link DataProvider}s keyed by id.
 *
 * Implements `Readable<ReadonlyMap<string, DataProvider>>` so consumers
 * can use Svelte's `$registry` auto-subscription syntax.
 */
export interface DataProviderRegistry
  extends Readable<ReadonlyMap<string, DataProvider>> {
  /** Add or replace a provider keyed by `provider.id`. */
  register(provider: DataProvider): void;
  /** Remove a provider by id. No-op if id is unknown. */
  unregister(id: string): void;
  /** Snapshot lookup (does not subscribe). */
  getProvider(id: string): DataProvider | undefined;
  /** Trigger `refresh()` on every registered provider. */
  notifyAll(): void;
  /** Remove every provider (used on canvas destroy). */
  clear(): void;
}

/**
 * Svelte context key for the registry. Use with `setContext` /
 * `getContext` from `svelte`.
 *
 * ```ts
 * // Canvas root:
 * setContext(DATA_PROVIDER_REGISTRY_CONTEXT_KEY, createDataProviderRegistry());
 *
 * // Descendant widget:
 * const registry = getContext<DataProviderRegistry>(DATA_PROVIDER_REGISTRY_CONTEXT_KEY);
 * ```
 */
export const DATA_PROVIDER_REGISTRY_CONTEXT_KEY = Symbol(
  "ppp:dataProviderRegistry"
);

/**
 * Construct a fresh registry instance. Call **once per canvas** in the
 * canvas root component and put the result into Svelte context under
 * {@link DATA_PROVIDER_REGISTRY_CONTEXT_KEY}.
 */
export function createDataProviderRegistry(): DataProviderRegistry {
  const _store: Writable<Map<string, DataProvider>> = writable(new Map());

  return {
    subscribe: _store.subscribe,

    register(provider: DataProvider): void {
      _store.update((map) => {
        const next = new Map(map);
        next.set(provider.id, provider);
        return next;
      });
    },

    unregister(id: string): void {
      _store.update((map) => {
        if (!map.has(id)) {
          return map;
        }
        const next = new Map(map);
        next.delete(id);
        return next;
      });
    },

    getProvider(id: string): DataProvider | undefined {
      return get(_store).get(id);
    },

    notifyAll(): void {
      const map = get(_store);
      for (const provider of map.values()) {
        provider.refresh();
      }
    },

    clear(): void {
      _store.set(new Map());
    },
  };
}
