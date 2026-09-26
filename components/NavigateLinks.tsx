"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Navigation is handed off to whichever app the person already uses, via deep
 * links, rather than routing in-app (SPEC §9).
 */
export function NavigateLinks({ lat, lng, label }: { lat: number; lng: number; label?: string | null }) {
  const [copied, setCopied] = useState(false);
  const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const query = encodeURIComponent(label ?? coords);

  async function copy() {
    try {
      await navigator.clipboard.writeText(coords);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside https; the coordinates are on screen anyway.
      setCopied(false);
    }
  }

  const links = [
    { name: "Waze", href: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
    {
      name: "Google Maps",
      href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    },
    { name: "Apple Maps", href: `https://maps.apple.com/?daddr=${lat},${lng}&q=${query}` },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {links.map((l) => (
          <a
            key={l.name}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-3 text-center text-sm font-semibold text-accent-contrast"
          >
            {l.name}
          </a>
        ))}
      </div>
      <Button variant="secondary" className="w-full" onClick={copy}>
        {copied ? "Copied" : `Copy ${coords}`}
      </Button>
    </div>
  );
}
