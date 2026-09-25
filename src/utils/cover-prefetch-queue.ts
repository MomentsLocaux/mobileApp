export const COVER_PREFETCH_CONCURRENCY = 3;
/** Next-page covers to queue after the visible rows — not the whole 50-row window. */
export const COVER_PREFETCH_AHEAD_LIMIT = 6;

export type CoverPrefetchPriority = 'visible' | 'ahead';

type CoverPrefetchJob = {
  uri: string;
  priority: CoverPrefetchPriority;
};

export type CoverPrefetchController = {
  enqueue: (uris: string[], priority?: CoverPrefetchPriority) => void;
  bumpGeneration: () => void;
  reset: () => void;
  whenIdle: () => Promise<void>;
  snapshot: () => {
    queued: string[];
    inflight: string[];
    completed: string[];
    active: number;
  };
};

export function createCoverPrefetchController(options: {
  prefetch: (uri: string) => Promise<unknown>;
  concurrency?: number;
}): CoverPrefetchController {
  const concurrency = options.concurrency ?? COVER_PREFETCH_CONCURRENCY;
  const queued: CoverPrefetchJob[] = [];
  const queuedUris = new Set<string>();
  const inflight = new Set<string>();
  const completed = new Set<string>();
  let active = 0;
  let pumpScheduled = false;
  let idleWaiters: (() => void)[] = [];

  const notifyIdle = () => {
    if (active > 0 || queued.length > 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  };

  const takeNext = (): CoverPrefetchJob | null => {
    const visibleIndex = queued.findIndex((job) => job.priority === 'visible');
    const index = visibleIndex >= 0 ? visibleIndex : 0;
    const job = queued.splice(index, 1)[0];
    if (job) queuedUris.delete(job.uri);
    return job ?? null;
  };

  const pump = () => {
    while (active < concurrency) {
      const job = takeNext();
      if (!job) break;
      if (completed.has(job.uri) || inflight.has(job.uri)) continue;
      active += 1;
      inflight.add(job.uri);
      Promise.resolve()
        .then(() => options.prefetch(job.uri))
        .catch(() => undefined)
        .finally(() => {
          inflight.delete(job.uri);
          completed.add(job.uri);
          active -= 1;
          pump();
          notifyIdle();
        });
    }
    notifyIdle();
  };

  const schedulePump = () => {
    if (pumpScheduled) return;
    pumpScheduled = true;
    queueMicrotask(() => {
      pumpScheduled = false;
      pump();
    });
  };

  return {
    enqueue(uris, priority = 'ahead') {
      const unique = [...new Set(uris.filter(Boolean))];
      for (const uri of unique) {
        if (completed.has(uri) || inflight.has(uri)) continue;
        if (queuedUris.has(uri)) {
          if (priority === 'visible') {
            const existing = queued.find((job) => job.uri === uri);
            if (existing) existing.priority = 'visible';
          }
          continue;
        }
        queued.push({ uri, priority });
        queuedUris.add(uri);
      }
      schedulePump();
    },
    bumpGeneration() {
      for (let index = queued.length - 1; index >= 0; index -= 1) {
        if (queued[index]?.priority !== 'ahead') continue;
        queuedUris.delete(queued[index].uri);
        queued.splice(index, 1);
      }
      notifyIdle();
    },
    reset() {
      queued.splice(0, queued.length);
      queuedUris.clear();
      inflight.clear();
      completed.clear();
      active = 0;
      idleWaiters = [];
    },
    whenIdle() {
      if (active === 0 && queued.length === 0) return Promise.resolve();
      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
    snapshot() {
      return {
        queued: queued.map((job) => job.uri),
        inflight: [...inflight],
        completed: [...completed],
        active,
      };
    },
  };
}

let shared: CoverPrefetchController | null = null;

export function configureCoverPrefetch(
  prefetch: (uri: string) => Promise<unknown>,
): CoverPrefetchController {
  shared = createCoverPrefetchController({ prefetch });
  return shared;
}

function getSharedController(): CoverPrefetchController {
  if (!shared) {
    shared = createCoverPrefetchController({ prefetch: async () => undefined });
  }
  return shared;
}

export function enqueueCoverPrefetch(
  uris: string[],
  priority: CoverPrefetchPriority = 'ahead',
): void {
  getSharedController().enqueue(uris, priority);
}

export function bumpCoverPrefetchGeneration(): void {
  getSharedController().bumpGeneration();
}

export function resetCoverPrefetchQueue(): void {
  getSharedController().reset();
}
