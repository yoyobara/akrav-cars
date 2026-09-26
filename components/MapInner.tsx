"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

export type MapProps = {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  /** Lets the pin be dragged to correct a bad GPS fix (SPEC §5.6). */
  draggable?: boolean;
  onMove?: (lat: number, lng: number) => void;
  className?: string;
};

/**
 * Leaflet over OpenStreetMap tiles: no API key and no billing (SPEC §9).
 * Driven imperatively rather than through react-leaflet — the map only ever
 * shows one pin, so a wrapper library would be more moving parts than logic.
 */
export default function MapInner({
  lat,
  lng,
  accuracyM,
  draggable = false,
  onMove,
  className = "",
}: MapProps) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  // Kept in a ref so re-renders do not need to tear the handler off the marker.
  const moved = useRef(onMove);
  useEffect(() => {
    moved.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!holder.current || map.current) return;

    const m = L.map(holder.current, {
      center: [lat, lng],
      zoom: 17,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);

    L.control.zoom({ position: "bottomright" }).addTo(m);

    marker.current = L.marker([lat, lng], {
      draggable,
      keyboard: true,
      icon: L.divIcon({
        className: "",
        html:
          '<div style="width:22px;height:22px;border-radius:9999px;background:#2563eb;' +
          'border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    }).addTo(m);

    marker.current.on("dragend", () => {
      const p = marker.current!.getLatLng();
      moved.current?.(p.lat, p.lng);
    });

    if (draggable) {
      // Tapping the map is faster than dragging the pin on a phone.
      m.on("click", (e: L.LeafletMouseEvent) => {
        marker.current?.setLatLng(e.latlng);
        moved.current?.(e.latlng.lat, e.latlng.lng);
      });
    }

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
    };
    // Set up once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow position changes that came from outside the map (a fresh GPS fix).
  useEffect(() => {
    if (!map.current || !marker.current) return;
    const current = marker.current.getLatLng();
    if (Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return;

    marker.current.setLatLng([lat, lng]);
    map.current.setView([lat, lng], map.current.getZoom());
  }, [lat, lng]);

  useEffect(() => {
    if (!map.current) return;

    circle.current?.remove();
    circle.current = null;

    // Only worth drawing when the fix is vague enough to matter.
    if (accuracyM && accuracyM > 15) {
      circle.current = L.circle([lat, lng], {
        radius: accuracyM,
        color: "#2563eb",
        weight: 1,
        fillOpacity: 0.12,
      }).addTo(map.current);
    }
  }, [lat, lng, accuracyM]);

  return <div ref={holder} className={className} role="application" aria-label="Parking location" />;
}
