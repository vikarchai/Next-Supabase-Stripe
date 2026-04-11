"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { SWRConfig, useSWRConfig } from "swr";

const InvalidationContext = createContext<{
  invalidateDeals: () => void;
  invalidateOrganization: () => void;
  invalidateRoles: () => void;
  /** After org switch / create — bust all dashboard API caches. */
  invalidateAllDashboard: () => void;
} | null>(null);

function InvalidationInner({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();
  const value = useMemo(() => {
    const invalidateDeals = () => {
      void mutate(
        (k: unknown) => typeof k === "string" && k.startsWith("/api/dashboard/deals"),
        undefined,
        { revalidate: true },
      );
    };
    const invalidateOrganization = () => {
      void mutate(
        (k: unknown) =>
          typeof k === "string" && k.startsWith("/api/dashboard/organization"),
        undefined,
        { revalidate: true },
      );
    };
    const invalidateRoles = () => {
      void mutate(
        (k: unknown) => typeof k === "string" && k.startsWith("/api/dashboard/roles"),
        undefined,
        { revalidate: true },
      );
    };
    return {
      invalidateDeals,
      invalidateOrganization,
      invalidateRoles,
      invalidateAllDashboard: () => {
        invalidateDeals();
        invalidateOrganization();
        invalidateRoles();
      },
    };
  }, [mutate]);
  return (
    <InvalidationContext.Provider value={value}>
      {children}
    </InvalidationContext.Provider>
  );
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        revalidateIfStale: true,
        dedupingInterval: 3000,
        keepPreviousData: true,
        focusThrottleInterval: 10_000,
      }}
    >
      <InvalidationInner>{children}</InvalidationInner>
    </SWRConfig>
  );
}

export function useDashboardCacheInvalidation() {
  return useContext(InvalidationContext);
}
