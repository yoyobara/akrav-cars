"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Card, ErrorNote, Field, inputClass } from "@/components/ui";
import { post } from "@/lib/client";
import { isCovered, type Coverage } from "@/lib/coverage";
import { REQUEST_PRESETS, type Window } from "@/lib/presets";
import { formatTime, formatWhen, fromPickerValue, toPickerValue } from "@/lib/time";

/** Just enough of a booking to warn about a clash before submitting. */
type Slot = {
  id: string;
  carId: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "completed";
  startAt: Date;
  endAt: Date;
  active: boolean;
  userName: string;
};

type CarRef = { id: string; nickname: string };

type Created = { booking: { id: string; carId: string; status: string } };

const CUSTOM = "custom";

/**
 * SPEC §5.3 — car picker, presets, pickers, note, and a live conflict hint
 * before submitting.
 *
 * The hint is worked out here from the bookings the page already loaded rather
 * than by asking the server on every keystroke, so it appears as the window
 * changes with no round trip. It is only a warning: the server decides, and it
 * is the one holding the §7 constraints.
 */
export function RequestForm({
  cars,
  slots,
  initialCarId,
  isAdmin,
  myId,
  coverage,
  serverNow,
}: {
  cars: CarRef[];
  slots: Slot[];
  initialCarId?: string;
  isAdmin: boolean;
  myId: string;
  /** My insurance on each car, by car id. */
  coverage: Record<string, Coverage>;
  serverNow: Date;
}) {
  const router = useRouter();

  const [carId, setCarId] = useState(initialCarId ?? cars[0].id);
  const [presetId, setPresetId] = useState<string>(REQUEST_PRESETS[0].id);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created["booking"] | null>(null);

  // "Now for 1h" has to keep meaning now while the sheet sits open.
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const preset = REQUEST_PRESETS.find((p) => p.id === presetId);
  const presetWindow = preset?.window(now);

  // The custom pickers open on whatever the last preset suggested.
  const [customStart, setCustomStart] = useState(() =>
    toPickerValue(REQUEST_PRESETS[0].window(serverNow).startAt),
  );
  const [customEnd, setCustomEnd] = useState(() =>
    toPickerValue(REQUEST_PRESETS[0].window(serverNow).endAt),
  );

  function choosePreset(id: string) {
    if (id === CUSTOM && presetWindow) {
      setCustomStart(toPickerValue(presetWindow.startAt));
      setCustomEnd(toPickerValue(presetWindow.endAt));
    }
    setPresetId(id);
  }

  const custom = presetId === CUSTOM;
  const chosen: Window | null = custom
    ? buildCustom(customStart, customEnd)
    : (presetWindow ?? null);

  // Cheap enough to redo on every keystroke, and the React Compiler memoizes it.
  const hint = chosen ? describeConflicts(slots, carId, chosen, myId, now) : null;
  const uninsured =
    !!chosen && !!coverage[carId] && !isCovered(coverage[carId], chosen.startAt, chosen.endAt);

  const car = cars.find((c) => c.id === carId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen) return;

    setError(null);
    setBusy(true);

    // Presets are recomputed on submit so a sheet left open still asks for the
    // window it is showing rather than the one it opened with.
    const fresh = custom ? chosen : (preset?.window(new Date()) ?? chosen);

    try {
      const { booking } = await post<Created>("/api/bookings", {
        carId,
        startAt: fresh.startAt.toISOString(),
        endAt: fresh.endAt.toISOString(),
        note: note.trim() || null,
      });
      setCreated(booking);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return <Result booking={created} carName={car?.nickname} isAdmin={isAdmin} />;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {cars.length > 1 && (
        <Field label="Which car">
          <div className="flex flex-wrap gap-2">
            {cars.map((c) => (
              <Chip key={c.id} selected={c.id === carId} onClick={() => setCarId(c.id)}>
                {c.nickname}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label="When">
        <div className="flex flex-wrap gap-2">
          {REQUEST_PRESETS.map((p) => (
            <Chip key={p.id} selected={p.id === presetId} onClick={() => choosePreset(p.id)}>
              {p.label}
            </Chip>
          ))}
          <Chip selected={custom} onClick={() => choosePreset(CUSTOM)}>
            Custom
          </Chip>
        </div>
      </Field>

      {custom ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <input
              type="datetime-local"
              className={inputClass}
              value={customStart}
              min={toPickerValue(now)}
              onChange={(e) => setCustomStart(e.target.value)}
              required
            />
          </Field>
          <Field label="Until">
            <input
              type="datetime-local"
              className={inputClass}
              value={customEnd}
              min={customStart}
              onChange={(e) => setCustomEnd(e.target.value)}
              required
            />
          </Field>
        </div>
      ) : (
        chosen && (
          <p className="text-sm text-muted">
            {formatWhen(chosen.startAt, now)} – {formatTime(chosen.endAt)}
          </p>
        )
      )}

      {custom && !chosen && (
        <p className="text-sm text-reserved">
          Pick a start and an end, with the end after the start.
        </p>
      )}

      <Field label="Note" hint="Optional — “driving Grandma to the clinic”.">
        <input
          className={inputClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </Field>

      {hint && <Hint hint={hint} />}
      {uninsured && (
        <p className="rounded-xl bg-reserved/10 px-3 py-2 text-sm text-reserved">
          {isAdmin
            ? `You are not insured on ${car?.nickname ?? "this car"} for this window. Add temporary insurance on the car’s admin page first.`
            : `You are not insured on ${car?.nickname ?? "this car"} for this window, so this waits for an admin, who adds temporary insurance when approving it.`}
        </p>
      )}
      <ErrorNote>{error}</ErrorNote>

      <Button type="submit" className="w-full" disabled={busy || !chosen}>
        {busy ? "Sending…" : isAdmin ? "Book it" : "Send request"}
      </Button>

      {!isAdmin && (
        <p className="text-center text-xs text-muted">
          An admin approves requests. A car that is free right now, and that you are insured on, is
          yours straight away.
        </p>
      )}
    </form>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-xl px-3.5 text-[15px] font-semibold transition-colors ${
        selected
          ? "bg-accent text-accent-contrast"
          : "bg-surface-muted text-foreground active:brightness-95"
      }`}
    >
      {children}
    </button>
  );
}

function buildCustom(start: string, end: string): Window | null {
  const startAt = fromPickerValue(start);
  const endAt = fromPickerValue(end);
  if (!startAt || !endAt || endAt <= startAt) return null;
  return { startAt, endAt };
}

type ConflictHint = { blocking: string | null; competing: number };

/** Whether the chosen window runs into anything already on the books. */
function describeConflicts(
  slots: Slot[],
  carId: string,
  chosen: Window,
  myId: string,
  now: Date,
): ConflictHint | null {
  const overlapping = slots.filter(
    (s) => s.carId === carId && s.startAt < chosen.endAt && s.endAt > chosen.startAt,
  );

  const approved = overlapping.find((s) => s.status === "approved");
  const competing = overlapping.filter((s) => s.status === "pending" && s.userId !== myId).length;

  if (!approved && competing === 0) return null;

  return {
    blocking: approved ? describeSlot(approved, myId, now) : null,
    competing,
  };
}

function describeSlot(slot: Slot, myId: string, now: Date): string {
  const who = slot.userId === myId ? "You have" : `${slot.userName} has`;
  return slot.active
    ? `${who} it out until ${formatTime(slot.endAt)}.`
    : `${who} it booked ${formatWhen(slot.startAt, now)} – ${formatTime(slot.endAt)}.`;
}

function Hint({ hint }: { hint: ConflictHint }) {
  return (
    <div className="space-y-1 rounded-xl bg-reserved/10 px-3 py-2 text-sm text-reserved">
      {hint.blocking && (
        <p>
          {hint.blocking} An admin cannot approve this until that booking is cancelled or
          rejected.
        </p>
      )}
      {hint.competing > 0 && (
        <p>
          {hint.competing === 1
            ? "Someone else has also asked for this slot"
            : `${hint.competing} other people have also asked for this slot`}{" "}
          — an admin picks one.
        </p>
      )}
    </div>
  );
}

/** SPEC §5.3: "Submitting shows a clear 'waiting for approval' state." */
function Result({
  booking,
  carName,
  isAdmin,
}: {
  booking: { id: string; carId: string; status: string };
  carName?: string;
  isAdmin: boolean;
}) {
  const approved = booking.status === "approved";

  return (
    <Card className="space-y-3 text-center">
      <p className="text-3xl" aria-hidden>
        {approved ? "🟢" : "⏳"}
      </p>
      <p className="text-lg font-bold">{approved ? "Booked" : "Waiting for approval"}</p>
      <p className="text-sm text-muted">
        {approved
          ? isAdmin
            ? `${carName ?? "The car"} is yours for that window.`
            : `${carName ?? "The car"} was free, so it is yours for that window.`
          : `Your request for ${carName ?? "the car"} is in the admins' inbox. You will see it
             on the garage screen until someone decides.`}
      </p>

      <div className="flex flex-col gap-2 pt-1">
        <ButtonLink href={`/cars/${booking.carId}`}>
          {approved ? `Open ${carName ?? "the car"}` : "See the car"}
        </ButtonLink>
        <Link href="/" className="text-sm text-accent">
          Back to the garage
        </Link>
      </div>
    </Card>
  );
}
