/**
 * SPEC §10: "Ending a trip must succeed on a flaky connection."
 *
 * A parking report that fails to reach the server is kept in localStorage and
 * retried the next time the app is opened or the device comes back online, so
 * the handoff is never lost because someone was in an underground car park.
 * (M4 moves this into the service worker so it can retry in the background.)
 */
const KEY = "akrav.outbox.v1";

export type PendingRequest = {
  id: string;
  path: string;
  body: unknown;
  queuedAt: number;
};

function read(): PendingRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingRequest[]) : [];
  } catch {
    return [];
  }
}

function write(items: PendingRequest[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Private mode with no storage: nothing more we can do here.
  }
}

export function enqueue(path: string, body: unknown): void {
  write([
    ...read(),
    { id: crypto.randomUUID(), path, body, queuedAt: Date.now() },
  ]);
}

export function pendingCount(): number {
  return read().length;
}

/** Sends everything queued. Returns how many made it through. */
export async function flush(): Promise<number> {
  const items = read();
  if (items.length === 0) return 0;

  const left: PendingRequest[] = [];
  let sent = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });

      // A 4xx will never succeed on retry — drop it rather than retry forever.
      if (res.ok || (res.status >= 400 && res.status < 500)) sent++;
      else left.push(item);
    } catch {
      left.push(item);
    }
  }

  write(left);
  return sent;
}
