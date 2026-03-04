"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ProcessingPollerProps = {
  hasProcessingDrafts: boolean;
};

export function ProcessingPoller({ hasProcessingDrafts }: ProcessingPollerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!hasProcessingDrafts) return;

    let cancelled = false;
    const tick = async () => {
      try {
        await fetch("/api/admin/menu-import/process-next", { method: "POST" });
      } catch {
        // Best-effort background processing trigger.
      } finally {
        if (!cancelled) {
          router.refresh();
        }
      }
    };

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasProcessingDrafts, router]);

  return null;
}

