import { useState, useEffect, useCallback } from 'react';
import type { TagCount } from '../lib/types';
import * as api from '../lib/api';

interface UseTagsResult {
  tags: TagCount[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTags: (generationId: number, tags: string[]) => Promise<void>;
  removeTag: (generationId: number, tag: string) => Promise<void>;
}

export function useTags(): UseTagsResult {
  const [tags, setTags] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listTags();
      setTags(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, []);

  const addTagsToGeneration = useCallback(async (generationId: number, newTags: string[]) => {
    await api.addTags(generationId, newTags);
    await fetchTags();
  }, [fetchTags]);

  const removeTagFromGeneration = useCallback(async (generationId: number, tag: string) => {
    await api.removeTag(generationId, tag);
    await fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    tags,
    loading,
    error,
    refresh: fetchTags,
    addTags: addTagsToGeneration,
    removeTag: removeTagFromGeneration,
  };
}
