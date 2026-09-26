"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Map } from "@/components/Map";
import { Button, ErrorNote, inputClass } from "@/components/ui";
import { ApiError } from "@/lib/client";
import { enqueue } from "@/lib/outbox";

type Fix = { lat: number; lng: number; accuracyM: number | null };

type Props = {
  /** Where to send the report: a trip ending, or a standalone move. */
  endpoint: string;
  /** The end-trip endpoint nests the report; a standalone report does not. */
  asTripEnd: boolean;
  carNickname: string;
  /** Notes recently used for this car, as one-tap suggestions (SPEC §5.6). */
  suggestions: string[];
  doneHref: string;
  submitLabel: string;
};

/**
 * SPEC §5.6 — the most-used flow in the app: two taps when GPS is good and no
 * note is needed. GPS is therefore requested on mount, not behind a button.
 */
export function EndTripForm({
  endpoint,
  asTripEnd,
  carNickname,
  suggestions,
  doneHref,
  submitLabel,
}: Props) {
  const router = useRouter();

  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fail = (message: string) => {
      if (cancelled) return;
      setLocating(false);
      setGpsError(message);
    };

    const geo = navigator.geolocation;
    if (!geo) {
      // Deferred rather than set straight away, so the first paint is the
      // same "finding you" state every other device shows.
      const t = setTimeout(() => fail("This device cannot report its location."), 0);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    geo.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        });
        setLocating(false);
      },
      (err) =>
        fail(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked for this site. Allow it, or say where the car is in a note."
            : "Could not get a GPS fix here — underground, probably. A note works too.",
        ),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // Reverse geocoding is rate limited upstream, so only the last position the
  // pin settled on is looked up.
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!fix || unknown) return;

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?lat=${fix.lat}&lng=${fix.lng}`);
        const body = await res.json();
        setAddress(body.address ?? null);
      } catch {
        setAddress(null);
      }
    }, 600);

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [fix, unknown]);

  const onMove = useCallback((lat: number, lng: number) => {
    // A hand-placed pin is exact by definition, so the accuracy circle goes.
    setFix({ lat, lng, accuracyM: null });
    setAddress(null);
  }, []);

  const hasLocation = !!fix && !unknown;
  const canSubmit = !saving && (hasLocation || note.trim().length > 0);

  async function submit() {
    setError(null);
    setSaving(true);

    const parking = {
      lat: hasLocation ? fix!.lat : null,
      lng: hasLocation ? fix!.lng : null,
      accuracyM: hasLocation ? fix!.accuracyM : null,
      address: hasLocation ? address : null,
      note: note.trim() || null,
    };
    const body = asTripEnd ? { parking } : parking;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const failure = await res.json().catch(() => null);
        throw new ApiError(failure?.code ?? "internal", failure?.message ?? "Could not save that.");
      }

      router.replace(doneHref);
      router.refresh();
    } catch (err) {
      // A rejected request is a real problem; an unreachable network is not —
      // keep the report and let it go out when there is signal again.
      if (err instanceof ApiError) {
        setError(err.message);
        setSaving(false);
        return;
      }

      enqueue(endpoint, body);
      router.replace(`${doneHref}?queued=1`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="h-64 overflow-hidden rounded-2xl border border-border">
        {hasLocation ? (
          <Map
            lat={fix!.lat}
            lng={fix!.lng}
            accuracyM={fix!.accuracyM}
            draggable
            onMove={onMove}
            className="size-full"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-surface-muted p-6 text-center text-sm text-muted">
            {locating ? "Finding where you are…" : (gpsError ?? "Location not being reported.")}
          </div>
        )}
      </div>

      {hasLocation && (
        <div className="flex items-start justify-between gap-3 text-sm">
          <p>
            <span className="font-medium">{address ?? "Looking up the address…"}</span>
            <span className="block text-muted">
              Drag the pin or tap the map if that is not quite right
              {fix!.accuracyM ? ` · accurate to about ${Math.round(fix!.accuracyM)} m` : ""}
            </span>
          </p>
        </div>
      )}

      {gpsError && !unknown && <ErrorNote>{gpsError}</ErrorNote>}

      <div>
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          placeholder={
            unknown || !hasLocation
              ? "Say where the car is — this is required without a location"
              : "Note (optional): level -2, near the elevator"
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNote(s)}
                className="rounded-full bg-surface-muted px-3 py-1.5 text-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {fix && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={unknown}
            onChange={(e) => setUnknown(e.target.checked)}
            className="size-4"
          />
          Do not attach a location — I will describe it instead
        </label>
      )}

      <ErrorNote>{error}</ErrorNote>

      <Button className="w-full" disabled={!canSubmit} onClick={submit}>
        {saving ? "Saving…" : submitLabel}
      </Button>
      <p className="text-center text-xs text-muted">
        The location is attached to {carNickname}, only now, and only the family can see it.
      </p>
    </div>
  );
}
