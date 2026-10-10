import { appIconResponse } from "@/lib/app-icon";

// Served at /icon/<id>; the manifest points at the 192 and 512 versions.
export function generateImageMetadata() {
  return [32, 192, 512].map((n) => ({
    id: String(n),
    size: { width: n, height: n },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return appIconResponse(Number(await id), "rounded");
}
