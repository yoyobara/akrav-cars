"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { patch } from "@/lib/client";
import { Avatar, Button, ErrorNote, Field, inputClass } from "@/components/ui";

export function ProfileForm({
  name: initialName,
  avatarUrl: initialAvatar,
  email,
}: {
  name: string;
  avatarUrl: string | null;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar ?? "");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("saving");

    try {
      await patch("/api/me", { name, avatarUrl });
      setState("saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar name={name || initialName} url={avatarUrl || null} size={44} />
        <p className="text-sm text-muted">{email}</p>
      </div>

      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Photo URL" hint="Optional — a link to a picture of you.">
        <input
          className={inputClass}
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" disabled={state === "saving"}>
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
      </Button>
    </form>
  );
}
