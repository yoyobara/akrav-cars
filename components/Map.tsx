"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "@/components/MapInner";

/** Leaflet touches `window` on import, so the map is client-only. */
const MapInner = dynamic(() => import("@/components/MapInner"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-surface-muted" />,
});

export function Map(props: MapProps) {
  return <MapInner {...props} />;
}
