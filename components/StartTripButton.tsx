"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { post } from "@/lib/client";
import { Button, ErrorNote } from "@/components/ui";

/** Start a booking that was approved earlier (SPEC §5.2). */
export function StartTripButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function start() {
    setError(null);
    try {
      await post(`/api/bookings/${bookingId}/start`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the trip.");
    }
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={pending} onClick={start}>
        Take the car
      </Button>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
