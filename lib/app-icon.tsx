import { ImageResponse } from "next/og";

// One drawing for every app icon: a white map pin holding a car, on the
// accent-blue gradient. Drawn on a 100×100 canvas.
//  - "rounded":  rounded square with transparent corners (favicon, manifest "any")
//  - "full":     full-bleed square; iOS rounds the corners itself
//  - "maskable": full-bleed with the art shrunk into Android's safe zone
export type AppIconVariant = "rounded" | "full" | "maskable";

const ART_SCALE: Record<AppIconVariant, number> = { rounded: 1, full: 0.9, maskable: 0.72 };

function appIconSvg(variant: AppIconVariant) {
  const s = ART_SCALE[variant];
  const radius = variant === "rounded" ? 22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(50 50) scale(${s}) translate(-50 -50)">
    <ellipse cx="50" cy="88" rx="13" ry="3.2" fill="#0b1b4d" opacity="0.35"/>
    <path d="M50 87 C40 73 21 58 21 38 a29 29 0 0 1 58 0 c0 20 -19 35 -29 49 z" fill="#ffffff"/>
    <g transform="translate(50 38) scale(1.15) translate(-50 -40)">
      <path d="M33 48 v-5 a3 3 0 0 1 3-3 h4 l4.2-7.3 a3 3 0 0 1 2.6-1.5 h6.4 a3 3 0 0 1 2.6 1.5 l4.2 7.3 h4 a3 3 0 0 1 3 3 v5 a2 2 0 0 1 -2 2 h-30 a2 2 0 0 1 -2-2 z" fill="#2563eb"/>
      <path d="M42.3 40 l3.3-5.6 h3.4 v5.6 z M51 40 v-5.6 h3.4 l3.3 5.6 z" fill="#ffffff"/>
      <circle cx="41" cy="50" r="4.6" fill="#1e3a8a" stroke="#ffffff" stroke-width="2"/>
      <circle cx="59" cy="50" r="4.6" fill="#1e3a8a" stroke="#ffffff" stroke-width="2"/>
    </g>
  </g>
</svg>`;
}

export function appIconResponse(size: number, variant: AppIconVariant) {
  const src = `data:image/svg+xml;base64,${Buffer.from(appIconSvg(variant)).toString("base64")}`;
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt="" />,
    { width: size, height: size },
  );
}
