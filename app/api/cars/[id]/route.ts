import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cars } from "@/lib/db/schema";
import { AppError, errorResponse } from "@/lib/errors";
import { getCarDetail } from "@/lib/queries";
import { carInput } from "@/lib/schemas";
import { requireAdmin, requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireUser();
    const detail = await getCarDetail((await params).id);
    if (!detail) throw new AppError("not_found", "That car does not exist.");
    return NextResponse.json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const body = carInput.partial().parse(await req.json());
    const { id } = await params;

    const [car] = await db
      .update(cars)
      .set({ ...body, photoUrl: body.photoUrl || null })
      .where(eq(cars.id, id))
      .returning();

    if (!car) throw new AppError("not_found", "That car does not exist.");
    return NextResponse.json({ car });
  } catch (err) {
    return errorResponse(err);
  }
}
