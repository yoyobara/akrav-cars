import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cars } from "@/lib/db/schema";
import { errorResponse } from "@/lib/errors";
import { getGarage } from "@/lib/queries";
import { carInput } from "@/lib/schemas";
import { requireAdmin, requireUser } from "@/lib/session";

/** List every car with its derived status and current location (SPEC §8). */
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ cars: await getGarage() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = carInput.parse(await req.json());

    const [car] = await db
      .insert(cars)
      .values({ ...body, photoUrl: body.photoUrl || null })
      .returning();

    return NextResponse.json({ car }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
