"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** Submit button for a form whose action calls `signIn("google")`. */
export function GoogleSignInButton({ label = "Continue with Google" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Opening Google…" : label}
    </Button>
  );
}
