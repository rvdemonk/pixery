import { useState, useCallback } from 'react';
import type { Generation, GenerateParams } from '../lib/types';
import * as api from '../lib/api';

interface UseGenerateResult {
  generating: boolean;
  error: string | null;
  lastGeneration: Generation | null;
  generate: (params: GenerateParams) => Promise<Generation | null>;
  clear: () => void;
}

export function useGenerate(): UseGenerateResult {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneration, setLastGeneration] = useState<Generation | null>(null);

  const generate = useCallback(async (params: GenerateParams): Promise<Generation | null> => {
    try {
      setGenerating(true);
      setError(null);
      const generation = await api.generateImage(params);
      setLastGeneration(generation);
      return generation;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Generation failed';
      setError(message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setError(null);
    setLastGeneration(null);
  }, []);

  return {
    generating,
    error,
    lastGeneration,
    generate,
    clear,
  };
}
