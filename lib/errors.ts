import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { activeTripIndexName, noOverlapConstraintName } from "@/lib/db/schema";

/**
 * SPEC §8: "Conflict and permission failures return a machine-readable code
 * plus a human sentence the UI can show verbatim."
 */
export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "car_inactive"
  | "car_in_use"
  | "booking_conflict"
  | "not_startable"
  | "not_yours"
  | "already_ended"
  | "already_decided"
  | "request_expired"
  | "parking_required"
  | "invite_invalid";

const statusByCode: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 422,
  car_inactive: 409,
  car_in_use: 409,
  booking_conflict: 409,
  not_startable: 409,
  not_yours: 403,
  already_ended: 409,
  already_decided: 409,
  request_expired: 409,
  parking_required: 422,
  invite_invalid: 410,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  /** @param message a complete sentence, shown to the user verbatim. */
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = statusByCode[code];
  }
}

type PgError = { code?: string; constraint_name?: string; constraint?: string };

/**
 * Finds the driver error carrying the constraint name. Drizzle wraps whatever
 * the driver threw in a DrizzleQueryError and hangs the real PostgresError off
 * `cause`, so reading the top-level object alone would turn every violation of
 * a SPEC §7 invariant into an opaque 500.
 */
function pgCause(err: unknown): PgError | null {
  for (let cur = err, depth = 0; cur && depth < 5; depth++) {
    const pg = cur as PgError;
    if (pg.code === "23505" || pg.code === "23P01") return pg;
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}

/** Turns a violation of a SPEC §7 invariant into the same shape as an AppError. */
function fromPostgres(err: unknown): AppError | null {
  const pg = pgCause(err);
  if (!pg) return null;
  const constraint = pg.constraint_name ?? pg.constraint ?? "";

  if (constraint === activeTripIndexName) {
    return new AppError(
      "car_in_use",
      "Someone already has this car out. Refresh to see who.",
    );
  }
  if (constraint === noOverlapConstraintName) {
    return new AppError(
      "booking_conflict",
      "That clashes with another approved booking for this car.",
    );
  }
  return null;
}

/** A rejected field turned into one sentence the UI can show as-is. */
function fromZod(err: unknown): AppError | null {
  if (!(err instanceof ZodError)) return null;
  const first = err.issues[0];
  const field = first?.path.join(".");
  const message = first?.message ?? "Some of those details are not valid.";
  return new AppError("invalid_input", field ? `${field}: ${message}` : message);
}

/**
 * The same normalisation `errorResponse` does, without building a response —
 * bulk-approve (SPEC §5.5) needs the sentence for each request it skipped, and
 * a lost race against the §7 exclusion constraint arrives as a Postgres error
 * rather than an AppError.
 */
export function asAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  return fromZod(err) ?? fromPostgres(err);
}

export function errorResponse(err: unknown): NextResponse {
  const app = asAppError(err);

  if (!app) {
    console.error(err);
    return NextResponse.json(
      { code: "internal", message: "Something went wrong. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { code: app.code, message: app.message },
    { status: app.status },
  );
}
