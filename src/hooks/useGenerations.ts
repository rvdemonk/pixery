import { useState, useEffect, useCallback, useRef } from 'react';
import type { Generation, ListFilter } from '../lib/types';
import * as api from '../lib/api';

interface UseGenerationsOptions {
  filter?: ListFilter;
  autoRefresh?: boolean;
}

interface UseGenerationsResult {
  generations: Generation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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
    a.tags.some((tag, i) => tag !== b.tags[i])
  );
}

export function useGenerations(options: UseGenerationsOptions = {}): UseGenerationsResult {
  const { filter = {}, autoRefresh = false } = options;
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  const fetchGenerations = useCallback(async () => {
    try {
      // Only show loading spinner on initial load, not on refresh
      if (isInitialLoad.current) {
        setLoading(true);
      }
      setError(null);
      const data = await api.listGenerations(filter);
      // Merge instead of replace to preserve object references
      setGenerations(prev => mergeGenerations(prev, data));
      isInitialLoad.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load generations');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filter)]);

  const search = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.searchGenerations(query);
      setGenerations(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchGenerations, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchGenerations]);

  return {
    generations,
    loading,
    error,
    refresh: fetchGenerations,
    search,
  };
}
