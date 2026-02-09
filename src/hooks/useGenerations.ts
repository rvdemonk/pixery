import { useState, useEffect, useCallback, useRef } from 'react';
import type { Generation, ListFilter } from '../lib/types';
import * as api from '../lib/api';

const PAGE_SIZE = 50;

interface UseGenerationsOptions {
  filter?: ListFilter;
  autoRefresh?: boolean;
}

interface UseGenerationsResult {
  generations: Generation[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  search: (query: string) => Promise<void>;
}

/**
 * Merge new generations with existing ones, preserving object references
 * for unchanged items to prevent unnecessary re-renders.
 */
function mergeGenerations(existing: Generation[], incoming: Generation[]): Generation[] {
  if (existing.length === 0) return incoming;

  const existingMap = new Map(existing.map(g => [g.id, g]));
  const result: Generation[] = [];

  for (const newGen of incoming) {
    const existingGen = existingMap.get(newGen.id);
    if (existingGen && !hasGenerationChanged(existingGen, newGen)) {
      // Reuse existing object reference if unchanged
      result.push(existingGen);
    } else {
      result.push(newGen);
    }
  }

  return result;
}

/**
 * Check if a generation has meaningfully changed (ignoring reference equality)
 */
function hasGenerationChanged(a: Generation, b: Generation): boolean {
  return (
    a.starred !== b.starred ||
    a.prompt !== b.prompt ||
    a.title !== b.title ||
    a.trashed_at !== b.trashed_at ||
    a.tags.length !== b.tags.length ||
    a.tags.some((tag, i) => tag !== b.tags[i]) ||
    a.collection_names.length !== b.collection_names.length ||
    a.collection_names.some((name, i) => name !== b.collection_names[i])
  );
}

/**
 * Create a stable key for filter dependencies, excluding limit/offset
 * so pagination doesn't trigger a full reset
 */
function getFilterDepsKey(filter: ListFilter): string {
  const { limit: _limit, offset: _offset, ...rest } = filter;
  return JSON.stringify(rest);
}

export function useGenerations(options: UseGenerationsOptions = {}): UseGenerationsResult {
  const { filter = {}, autoRefresh = false } = options;
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isInitialLoad = useRef(true);
  const offsetRef = useRef(0);

  // Stable filter key excluding pagination params
  const filterDepsKey = getFilterDepsKey(filter);

  const fetchGenerations = useCallback(async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else if (isInitialLoad.current) {
        setLoading(true);
      }
      setError(null);

      const currentOffset = append ? offsetRef.current : 0;
      const fetchFilter: ListFilter = {
        ...filter,
        limit: PAGE_SIZE,
        offset: currentOffset,
      };

      const data = await api.listGenerations(fetchFilter);

      // Determine if there are more results
      setHasMore(data.length === PAGE_SIZE);

      if (append) {
        // Append to existing data
        setGenerations(prev => [...prev, ...data]);
        offsetRef.current = currentOffset + data.length;
      } else {
        // Replace data (initial load or filter change)
        setGenerations(prev => mergeGenerations(prev, data));
        offsetRef.current = data.length;
      }

      isInitialLoad.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load generations');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterDepsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await fetchGenerations(true);
  }, [fetchGenerations, loadingMore, hasMore]);

  const refresh = useCallback(async () => {
    // Reset pagination state
    offsetRef.current = 0;
    setHasMore(true);
    await fetchGenerations(false);
  }, [fetchGenerations]);

  const search = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.searchGenerations(query);
      setGenerations(data);
      setHasMore(false); // Search doesn't support pagination
      offsetRef.current = data.length;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset and fetch when filter changes (excluding pagination)
  useEffect(() => {
    offsetRef.current = 0;
    setHasMore(true);
    isInitialLoad.current = true;
    fetchGenerations(false);
  }, [filterDepsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchGenerations(false), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchGenerations]);

  return {
    generations,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    search,
  };
}
