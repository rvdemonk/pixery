import { useState, useEffect, useCallback } from 'react';
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

export function useGenerations(options: UseGenerationsOptions = {}): UseGenerationsResult {
  const { filter = {}, autoRefresh = false } = options;
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGenerations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listGenerations(filter);
      setGenerations(data);
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
