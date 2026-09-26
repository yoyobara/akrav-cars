"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flush, pendingCount } from "@/lib/outbox";

/**
 * Sends parking reports that were queued while the phone had no signal
 * (SPEC §10), on load and whenever the device comes back online.
 */
export function OutboxFlush() {
  const router = useRouter();
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (pendingCount() === 0) {
        if (alive) setQueued(0);
        return;
      }
      setQueued(pendingCount());

      const sent = await flush();
      if (!alive) return;

      setQueued(pendingCount());
      if (sent > 0) router.refresh();
    }

    run();
    window.addEventListener("online", run);
    return () => {
      alive = false;
      window.removeEventListener("online", run);
    };
  }, [router]);

  if (queued === 0) return null;

  return (
    <p className="sticky bottom-0 bg-reserved/15 px-4 py-2 text-center text-sm text-reserved">
      {queued} parking report{queued > 1 ? "s" : ""} waiting for a connection — they will go out
      automatically.
    </p>
  );
}
