"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { getToken } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Global SWR fetcher that uses the same base URL and auth as api.ts */
async function swrFetcher<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => res.statusText);
    const error = new Error(typeof body === "string" ? body : JSON.stringify(body));
    (error as unknown as Record<string, unknown>).status = res.status;
    throw error;
  }
  return res.json();
}

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        dedupingInterval: 2000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
