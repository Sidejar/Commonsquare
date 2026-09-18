"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

// Asks the server whether this session is on the admin allowlist.
// null = still checking.
export function useIsAdmin(session: Session | null): boolean | null {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const token = session?.access_token;

  useEffect(() => {
    if (!token) {
      setAdmin(null);
      return;
    }
    let cancelled = false;
    fetch("/api/admin/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((res) => {
        if (!cancelled) setAdmin(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return admin;
}
