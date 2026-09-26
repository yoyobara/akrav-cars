import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/geocode";
import { errorResponse } from "@/lib/errors";
import { requireUser } from "@/lib/session";

/** Live address label while the pin is being dragged on the end-trip screen. */
export async function GET(req: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ address: null });
    }

    return NextResponse.json({ address: await reverseGeocode(lat, lng) });
  } catch (err) {
    return errorResponse(err);
  }
}
