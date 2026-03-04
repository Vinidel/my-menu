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
    const tick = () => {
      if (!cancelled) {
        router.refresh();
      }
    };

    tick();
    const intervalId = window.setInterval(() => {
      tick();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasProcessingDrafts, router]);

  return null;
}
