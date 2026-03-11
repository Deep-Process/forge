"use client";

import { useState, useCallback } from "react";
import { debug as debugApi } from "@/lib/api";
import type { DebugSessionSummary, DebugSession } from "@/lib/types";

interface UseDebugSessionsReturn {
  sessions: DebugSessionSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedSession: DebugSession | null;
  loadingDetail: boolean;
  fetch: (params?: {
    task_id?: string;
    contract_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  fetchDetail: (sessionId: string) => Promise<void>;
  clearSelection: () => void;
}

export function useDebugSessions(slug: string): UseDebugSessionsReturn {
  const [sessions, setSessions] = useState<DebugSessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<DebugSession | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetch = useCallback(
    async (params?: {
      task_id?: string;
      contract_id?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }) => {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await debugApi.sessions(slug, params);
        setSessions(res.sessions);
        setTotal(res.total);
      } catch (e) {
        setError((e as Error).message);
        setSessions([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  const fetchDetail = useCallback(
    async (sessionId: string) => {
      if (!slug) return;
      setLoadingDetail(true);
      setError(null);
      try {
        const res = await debugApi.session(slug, sessionId);
        setSelectedSession(res);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingDetail(false);
      }
    },
    [slug],
  );

  const clearSelection = useCallback(() => {
    setSelectedSession(null);
  }, []);

  return {
    sessions,
    total,
    loading,
    error,
    selectedSession,
    loadingDetail,
    fetch,
    fetchDetail,
    clearSelection,
  };
}
