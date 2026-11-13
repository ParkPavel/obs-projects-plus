// blockSources.ts — i3-data.
//
// «Отфильтрованные таблицы и связи не появляются как новые источники.» Every
// database-call block registers its filtered frame on the canvas
// (DataProvider registry, #031.3) — and nothing read it. This is the reader:
// a block, chart, stats card, series or join whose source is a block ref
// (`projectId::block:<viewId>:<widgetId>`, lib/relations/blockRefs.ts) gets
// that block's CURRENT frame, live, as one more `ExternalSourceState`.
//
// Safety, by construction rather than by hope:
// - a loop (A reads B reads A) is decided from the stored config before any
//   subscription is made: the ref becomes an `error` state and nothing is
//   subscribed, so no frame can travel round it;
// - a publish happens only when a frame IDENTITY or a state changed, so a
//   re-render that recomputes the same inputs is not echoed downstream;
// - subscriptions are held only while the host is mounted and only for the
//   refs it reads — a bounded set, released on destroy.
//
// A block not mounted on this canvas (collapsed, another dashboard, another
// project) is left to the preloader, which resolves the same ref from the
// stored config (externalFrameResolver.ts).

import { getContext } from "svelte";
import { derived, writable, type Readable } from "svelte/store";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import {
  DATA_PROVIDER_REGISTRY_CONTEXT_KEY,
  type DataProvider,
  type DataProviderRegistry,
} from "src/lib/stores/dataProviderRegistry";
import { settings } from "src/lib/stores/settings";
import { i18n } from "src/lib/stores/i18n";
import type { ProjectDefinition } from "src/settings/settings";
import { sourceCatalogue } from "src/lib/relations/baseRef";
import {
  blockReadCycle,
  blockRecordsProject,
  blockRefId,
  blockRefsReadBy,
  parseBlockRef,
  viewIdOfWidget,
} from "src/lib/relations/blockRefs";
import { readyFrames, type ExternalSourceState } from "../dashboardPreload";
import type { WidgetDefinition } from "../types";

export interface SourceOption {
  readonly id: string;
  readonly name: string;
}

export interface BlockSourcesValue {
  /** Live states of the block refs this widget reads (errors for loops). */
  readonly states: ReadonlyMap<string, ExternalSourceState>;
  /** Block refs whose records are this project's notes (writes are safe). */
  readonly writable: ReadonlySet<string>;
  /** The source catalogue for this widget's pickers (sourceCatalogue). */
  readonly catalogue: SourceOption[];
}

export interface CatalogueTexts {
  readonly block: (title: string) => string;
  readonly cycle: string;
}

export interface LiveBlockSources extends Readable<BlockSourcesValue> {
  /** Point at what `widget` reads. A no-op when nothing relevant changed. */
  watch(widget: WidgetDefinition, project: ProjectDefinition | undefined): void;
}

const EMPTY: BlockSourcesValue = { states: new Map(), writable: new Set(), catalogue: [] };
const noop = () => {};

function contextRegistry(): DataProviderRegistry | undefined {
  try {
    return getContext<DataProviderRegistry | undefined>(DATA_PROVIDER_REGISTRY_CONTEXT_KEY);
  } catch {
    return undefined; // not inside a component (tests, scripts)
  }
}

const settingsProjects: Readable<readonly ProjectDefinition[]> = derived(settings, ($s) => $s.projects ?? []);
const localeTexts: Readable<CatalogueTexts> = derived(i18n, ($i18n) => ({
  block: (title: string) => String($i18n.t("views.dashboard.source-catalogue.block", { defaultValue: "Block «{{title}}» (filtered)", title })),
  cycle: String($i18n.t("views.dashboard.source-catalogue.cycle", {
    defaultValue: "Circular source: this block reads itself through another block. Pick a different source.",
  })),
}));

function sameStates(a: ReadonlyMap<string, ExternalSourceState>, b: ReadonlyMap<string, ExternalSourceState>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w || w.status !== v.status) return false;
    if (v.status === "ready" && (w.status !== "ready" || w.frame !== v.frame)) return false;
    if (v.status === "error" && (w.status !== "error" || w.message !== v.message)) return false;
  }
  return true;
}

/**
 * The live block sources of one widget host. Call during component init (it
 * reads the canvas registry from context); pass the inputs explicitly in tests.
 */
export function liveBlockSources(
  registry: DataProviderRegistry | undefined = contextRegistry(),
  projects$: Readable<readonly ProjectDefinition[]> = settingsProjects,
  texts$: Readable<CatalogueTexts> = localeTexts
): LiveBlockSources {
  let project: ProjectDefinition | undefined;
  let selfRef: string | undefined;
  let selfViewId: string | undefined;
  let refs: readonly string[] = [];
  let watchKey = "";
  let cycles: ReadonlySet<string> = new Set();
  let writableRefs: ReadonlySet<string> = new Set();
  let catalogue: SourceOption[] = [];
  let providers: ReadonlyMap<string, DataProvider> = new Map();
  let projects: readonly ProjectDefinition[] = [];
  let texts: CatalogueTexts | undefined;
  const subs = new Map<string, { provider: DataProvider; frame: DataFrame | undefined; stop: () => void }>();
  let value = EMPTY;
  let started = false;
  let hold = 0;

  const store = writable<BlockSourcesValue>(EMPTY, () => {
    hold++;
    const stops = [
      registry ? registry.subscribe((m) => { providers = m; sync(); }) : noop,
      projects$.subscribe((p) => { projects = p; recompute(); }),
      texts$.subscribe((t) => { texts = t; recompute(); }),
    ];
    started = true;
    hold--;
    recompute();
    return () => {
      started = false;
      for (const stop of stops) stop();
      for (const s of subs.values()) s.stop();
      subs.clear();
      value = EMPTY;
    };
  });

  /** The whole graph a loop may run through: every project when known, else this one. */
  function graph(): readonly ProjectDefinition[] {
    return projects.length > 0 ? projects : project ? [project] : [];
  }

  /** Loops, writability and the catalogue: config-derived, so not redone per frame. */
  function recompute(): void {
    if (!started) return;
    const g = graph();
    cycles = new Set(refs.filter((r) => parseBlockRef(r) !== null && blockReadCycle(g, selfRef, r)));
    writableRefs = new Set(refs.filter((r) => !cycles.has(r) && parseBlockRef(r) !== null && !!project && blockRecordsProject(g, r) === project.id));
    catalogue = sourceCatalogue(projects, {
      ...(texts ? { blockLabel: texts.block } : {}),
      ...(selfRef !== undefined ? { reader: selfRef } : {}),
      ...(project ? { omitProjectSources: project.id, blocksOfProject: project.id } : {}),
    }).map((o) => ({ id: o.value, name: o.label }));
    sync();
  }

  /** Subscribe to exactly the providers this widget reads live, and no others. */
  function sync(): void {
    if (!started) return;
    hold++;
    const wanted = new Map<string, DataProvider>();
    for (const ref of refs) {
      const b = parseBlockRef(ref);
      if (!b || cycles.has(ref) || b.projectId !== project?.id || b.viewId !== selfViewId) continue;
      const provider = providers.get(b.widgetId);
      if (provider) wanted.set(ref, provider);
    }
    for (const [ref, sub] of subs) {
      if (wanted.get(ref) === sub.provider) continue;
      sub.stop();
      subs.delete(ref);
    }
    for (const [ref, provider] of wanted) {
      if (subs.has(ref)) continue;
      const entry = { provider, frame: undefined as DataFrame | undefined, stop: noop };
      subs.set(ref, entry);
      entry.stop = provider.frame$.subscribe((f) => { entry.frame = f; publish(); });
    }
    hold--;
    publish();
  }

  function publish(): void {
    if (!started || hold > 0) return;
    const states = new Map<string, ExternalSourceState>();
    const message = texts?.cycle ?? "Circular source";
    for (const ref of cycles) states.set(ref, { status: "error", message });
    for (const [ref, sub] of subs) if (sub.frame) states.set(ref, { status: "ready", frame: sub.frame });
    const sameCatalogue = catalogue.length === value.catalogue.length &&
      catalogue.every((o, i) => o.id === value.catalogue[i]?.id && o.name === value.catalogue[i]?.name);
    const sameWritable = writableRefs.size === value.writable.size && [...writableRefs].every((r) => value.writable.has(r));
    if (sameStates(states, value.states) && sameCatalogue && sameWritable) return;
    value = {
      states: sameStates(states, value.states) ? value.states : states,
      writable: sameWritable ? value.writable : writableRefs,
      catalogue: sameCatalogue ? value.catalogue : catalogue,
    };
    store.set(value);
  }

  return {
    subscribe: store.subscribe,
    watch(widget, nextProject) {
      const viewId = viewIdOfWidget(nextProject, widget.id);
      const nextSelf = nextProject && viewId ? blockRefId(nextProject.id, viewId, widget.id) : undefined;
      const nextRefs = blockRefsReadBy(widget);
      project = nextProject;
      // The graph can change without this widget changing (another block was
      // re-pointed), so the loop check runs on every call; it is a walk over a
      // handful of stored blocks. Subscriptions move only when the key moves.
      const key = `${nextSelf ?? ""}|${nextRefs.join("|")}|${nextProject?.id ?? ""}`;
      const graphChanged = refs.length > 0 && !sameSet(cycles, new Set(nextRefs.filter((r) => blockReadCycle(graph(), nextSelf, r))));
      if (key === watchKey && !graphChanged) return;
      watchKey = key;
      selfRef = nextSelf;
      selfViewId = viewId;
      refs = nextRefs;
      recompute();
    },
  };
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/**
 * Fold the live block states into what the preloader published. Live wins (it
 * is the frame on screen, canvas selection included); a ref with no live
 * provider keeps its preloaded state. Returned as it came when nothing is live,
 * so a dashboard without block sources sees the same objects as before.
 */
export function mergeBlockSources(
  sourceStates: ReadonlyMap<string, ExternalSourceState>,
  rightFrames: ReadonlyMap<string, DataFrame>,
  live: BlockSourcesValue,
  fallbackCatalogue: SourceOption[]
): { sourceStates: ReadonlyMap<string, ExternalSourceState>; rightFrames: ReadonlyMap<string, DataFrame>; catalogue: SourceOption[] } {
  const catalogue = live.catalogue.length > 0 ? live.catalogue : fallbackCatalogue;
  if (live.states.size === 0 && live.writable.size === 0) return { sourceStates, rightFrames, catalogue };
  const merged = new Map(sourceStates);
  for (const [ref, state] of live.states) merged.set(ref, state);
  for (const ref of live.writable) {
    const state = merged.get(ref);
    if (state?.status === "ready" && !state.writable) merged.set(ref, { ...state, writable: true });
  }
  return { sourceStates: merged, rightFrames: readyFrames(merged), catalogue };
}
