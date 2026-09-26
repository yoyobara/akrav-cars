"use client";

import { useState } from "react";
import { post } from "@/lib/client";
import { Button, ErrorNote } from "@/components/ui";

type Invite = { token: string; role: "admin" | "member"; expiresAt: string };

/** Admin-generated invite link; the first sign-in through it claims it. */
export function InvitePanel() {
  const [role, setRole] = useState<"admin" | "member">("member");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const { invite } = await post<{ invite: Invite }>("/api/invites", { role });
      setLink(`${window.location.origin}/invite/${invite.token}`);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create an invite.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["member", "admin"] as const).map((r) => (
          <Button
            key={r}
            variant={role === r ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setRole(r)}
          >
            {r === "member" ? "Member" : "Admin"}
          </Button>
        ))}
      </div>

      <Button className="w-full" onClick={create} disabled={busy}>
        {busy ? "Creating…" : "Create invite link"}
      </Button>

      {link && (
        <div className="space-y-2">
          <p className="break-all rounded-xl bg-surface-muted p-3 font-mono text-xs">{link}</p>
          <Button variant="secondary" className="w-full" onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          <p className="text-xs text-muted">Valid for 14 days, single use.</p>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
