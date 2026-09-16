import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import {
  DISCOVERY_LIST_PAGE_SIZE,
  discoveryListOrderKey,
  nextDiscoveryListWindowCount,
  resolveDiscoveryListWindowCount,
  shouldPrefetchNextDiscoveryPage,
  windowCountToIncludeIndex,
} from '@/utils/discovery-list-window';

type ItemWithId = { id: string };

/**
 * Renders an already-sorted discovery list 50 rows at a time.
 * The next page is prepared near the current end; sort changes reset to page 1.
 */
export function useDiscoveryListWindow<T extends ItemWithId>(
  items: T[],
  options?: {
    onPrefetchPage?: (pageItems: T[]) => void;
  }
) {
  const orderKey = useMemo(
    () => discoveryListOrderKey(items.map((item) => item.id)),
    [items]
  );
  const [revealedCount, setRevealedCount] = useState(() =>
    resolveDiscoveryListWindowCount({
      totalCount: items.length,
      revealedCount: DISCOVERY_LIST_PAGE_SIZE,
    })
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const revealedCountRef = useRef(revealedCount);
  revealedCountRef.current = revealedCount;
  const prefetchRef = useRef(options?.onPrefetchPage);
  prefetchRef.current = options?.onPrefetchPage;
  const pendingTaskRef = useRef<{ cancel?: () => void } | null>(null);

  useEffect(() => {
    pendingTaskRef.current?.cancel?.();
    pendingTaskRef.current = null;
    loadingRef.current = false;
    setLoadingMore(false);
    setRevealedCount(
      resolveDiscoveryListWindowCount({
        totalCount: itemsRef.current.length,
        revealedCount: DISCOVERY_LIST_PAGE_SIZE,
      })
    );
  }, [orderKey]);

  useEffect(
    () => () => {
      pendingTaskRef.current?.cancel?.();
    },
    []
  );

  const visibleCount = resolveDiscoveryListWindowCount({
    totalCount: items.length,
    revealedCount,
  });
  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );
  const totalCount = items.length;
  const hasMore = visibleCount < totalCount;

  const revealNextPage = useCallback(() => {
    const currentItems = itemsRef.current;
    const currentVisible = resolveDiscoveryListWindowCount({
      totalCount: currentItems.length,
      revealedCount: revealedCountRef.current,
    });
    if (currentVisible >= currentItems.length || loadingRef.current) return;

    loadingRef.current = true;
    setLoadingMore(true);
    prefetchRef.current?.(
      currentItems.slice(currentVisible, currentVisible + DISCOVERY_LIST_PAGE_SIZE)
    );

    pendingTaskRef.current?.cancel?.();
    pendingTaskRef.current = InteractionManager.runAfterInteractions(() => {
      pendingTaskRef.current = null;
      setRevealedCount((current) =>
        nextDiscoveryListWindowCount({
          totalCount: itemsRef.current.length,
          revealedCount: current,
        })
      );
      setLoadingMore(false);
      loadingRef.current = false;
    });
  }, []);

  const revealThroughIndex = useCallback((index: number) => {
    setRevealedCount((current) =>
      Math.max(current, windowCountToIncludeIndex(index))
    );
  }, []);

  const handleHighestViewedIndex = useCallback((highestViewedIndex: number) => {
    if (
      shouldPrefetchNextDiscoveryPage({
        totalCount: itemsRef.current.length,
        revealedCount: revealedCountRef.current,
        highestViewedIndex,
      })
    ) {
      revealNextPage();
    }
  }, [revealNextPage]);

  return {
    visibleItems,
    visibleCount,
    totalCount,
    hasMore,
    loadingMore,
    orderKey,
    revealNextPage,
    revealThroughIndex,
    handleHighestViewedIndex,
  };
}
