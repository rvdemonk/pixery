import { useState, useEffect, useRef, useCallback } from 'react';
import type { Job } from '../lib/types';
import * as api from '../lib/api';

const POLL_INTERVAL_ACTIVE = 500; // ms - poll fast when jobs are active
const POLL_INTERVAL_IDLE = 2000; // ms - poll slower when no jobs
const FAILED_JOBS_POLL_INTERVAL = 5000; // ms - poll failed jobs less frequently

interface UseJobsResult {
  jobs: Job[];
  failedJobs: Job[];
  activeCount: number;
  failedCount: number;
  dismissFailedJob: (id: number) => void;
}

export function useJobs(): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [failedJobs, setFailedJobs] = useState<Job[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const pollTimeoutRef = useRef<number | null>(null);
  const failedPollTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);

  const dismissFailedJob = useCallback((id: number) => {
    setDismissedIds(prev => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const pollActive = async () => {
      if (!mountedRef.current) return;

      try {
        const activeJobs = await api.listJobs();
        if (!mountedRef.current) return;

        setJobs(activeJobs);

        // Poll faster when there are active jobs
        const interval = activeJobs.length > 0 ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
        pollTimeoutRef.current = window.setTimeout(pollActive, interval);
      } catch (e) {
        // On error, slow down polling
        if (mountedRef.current) {
          pollTimeoutRef.current = window.setTimeout(pollActive, POLL_INTERVAL_IDLE * 2);
        }
      }
    };

    const pollFailed = async () => {
      if (!mountedRef.current) return;

      try {
        const failed = await api.listFailedJobs(10);
        if (!mountedRef.current) return;

        setFailedJobs(failed);
        failedPollTimeoutRef.current = window.setTimeout(pollFailed, FAILED_JOBS_POLL_INTERVAL);
      } catch (e) {
        if (mountedRef.current) {
          failedPollTimeoutRef.current = window.setTimeout(pollFailed, FAILED_JOBS_POLL_INTERVAL * 2);
        }
      }
    };

    // Start polling
    pollActive();
    pollFailed();

    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current !== null) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (failedPollTimeoutRef.current !== null) {
        clearTimeout(failedPollTimeoutRef.current);
      }
    };
  }, []);

  const activeCount = jobs.filter(j => j.status === 'pending' || j.status === 'running').length;
  const visibleFailedJobs = failedJobs.filter(j => !dismissedIds.has(j.id));

  return {
    jobs,
    failedJobs: visibleFailedJobs,
    activeCount,
    failedCount: visibleFailedJobs.length,
    dismissFailedJob,
  };
}
