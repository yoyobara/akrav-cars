"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { patch } from "@/lib/client";
import { Avatar, Button, ErrorNote } from "@/components/ui";

type Member = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  isActive: boolean;
};

/** Promote a member, or remove someone from the household (SPEC §3). */
export function MemberList({ members, meId }: { members: Member[]; meId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function change(id: string, body: Partial<Pick<Member, "role" | "isActive">>) {
    setError(null);
    setBusy(id);
    try {
      await patch(`/api/members/${id}`, body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3">
          <Avatar name={m.name} url={m.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {m.name}
              {!m.isActive && <span className="text-muted"> · removed</span>}
            </p>
            <p className="truncate text-xs text-muted">
              {m.role === "admin" ? "Admin" : "Member"} · {m.email}
            </p>
          </div>

          {m.id !== meId && (
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                className="px-2 text-xs"
                disabled={busy === m.id}
                onClick={() => change(m.id, { role: m.role === "admin" ? "member" : "admin" })}
              >
                {m.role === "admin" ? "Demote" : "Promote"}
              </Button>
              <Button
                variant="ghost"
                className="px-2 text-xs"
                disabled={busy === m.id}
                onClick={() => change(m.id, { isActive: !m.isActive })}
              >
                {m.isActive ? "Remove" : "Restore"}
              </Button>
            </div>
          )}
        </div>
      ))}

      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
