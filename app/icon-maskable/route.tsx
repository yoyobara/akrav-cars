import { appIconResponse } from "@/lib/app-icon";

// Android crops maskable icons to its own shape, so this one is full-bleed
// with the art kept inside the safe zone.
export function GET() {
  return appIconResponse(512, "maskable");
}
