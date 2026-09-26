"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/lib/client";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";

export function ClaimInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await post(`/api/invites/${token}/claim`, { name, email });
      // The dev sign-in page lists everyone; the new member can pick themselves.
      router.replace("/signin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Your name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </Field>
      <Field label="Email" hint="This is how you sign in.">
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" className="w-full" disabled={saving || !name || !email}>
        {saving ? "Joining…" : "Join the family"}
      </Button>
    </form>
  );
}
