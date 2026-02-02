import { useState, useEffect, useRef } from 'react';
import type { Job } from '../lib/types';
import * as api from '../lib/api';

const POLL_INTERVAL_ACTIVE = 500; // ms - poll fast when jobs are active
const POLL_INTERVAL_IDLE = 2000; // ms - poll slower when no jobs

interface UseJobsResult {
  jobs: Job[];
  activeCount: number;
}

export function useJobs(): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([]);
  const pollTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      if (!mountedRef.current) return;

      try {
        const activeJobs = await api.listJobs();
        if (!mountedRef.current) return;

        setJobs(activeJobs);

        // Poll faster when there are active jobs
        const interval = activeJobs.length > 0 ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
        pollTimeoutRef.current = window.setTimeout(poll, interval);
      } catch (e) {
        // On error, slow down polling
        if (mountedRef.current) {
          pollTimeoutRef.current = window.setTimeout(poll, POLL_INTERVAL_IDLE * 2);
        }
      }
    };

    // Start polling
    poll();

    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current !== null) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const activeCount = jobs.filter(j => j.status === 'pending' || j.status === 'running').length;

  return {
    jobs,
    activeCount,
  };
}
