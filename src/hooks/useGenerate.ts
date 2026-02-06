import { useState, useCallback } from 'react';
import type { Generation, GenerateParams } from '../lib/types';
import * as api from '../lib/api';

interface GenerateProgress {
  current: number;
  total: number;
}

interface UseGenerateResult {
  generating: boolean;
  progress: GenerateProgress | null;
  error: string | null;
  lastGeneration: Generation | null;
  generate: (params: GenerateParams, numRuns?: number) => Promise<Generation[]>;
  clear: () => void;
}

export function useGenerate(): UseGenerateResult {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneration, setLastGeneration] = useState<Generation | null>(null);

  const generate = useCallback(async (params: GenerateParams, numRuns: number = 1): Promise<Generation[]> => {
    const results: Generation[] = [];
    try {
      setGenerating(true);
      setError(null);
      if (numRuns > 1) setProgress({ current: 0, total: numRuns });
      for (let i = 0; i < numRuns; i++) {
        if (numRuns > 1) setProgress({ current: i + 1, total: numRuns });
        const generation = await api.generateImage(params);
        results.push(generation);
      }
      if (results.length > 0) {
        setLastGeneration(results[results.length - 1]);
      }
      return results;
    } catch (e) {
      if (results.length > 0) {
        setLastGeneration(results[results.length - 1]);
      }
      const message = e instanceof Error ? e.message : 'Generation failed';
      setError(message);
      return results;
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }, []);

  const clear = useCallback(() => {
    setError(null);
    setLastGeneration(null);
  }, []);

  return {
    generating,
    progress,
    error,
    lastGeneration,
    generate,
    clear,
  };
}
