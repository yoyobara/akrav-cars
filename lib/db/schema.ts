import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema follows SPEC.md §7. Timestamps are all `timestamptz` and stored UTC;
 * rendering in Asia/Jerusalem happens in lib/time.ts.
 *
 * Tables for push notifications (SPEC §6, milestone M3) are not created yet.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  invitedBy: uuid("invited_by"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  claimedBy: uuid("claimed_by").references(() => users.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cars = pgTable("cars", {
  id: uuid("id").primaryKey().defaultRandom(),
  nickname: text("nickname").notNull(),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  plate: text("plate"),
  colour: text("colour"),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A booking covers both "taking it now" and "I want it Saturday".
 *
 * There is deliberately no 'active' status: active is derived as
 * `status = 'approved' AND actual_start_at IS NOT NULL AND actual_end_at IS NULL`,
 * which is what the one_active_trip_per_car index enforces.
 */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    actualStartAt: timestamp("actual_start_at", { withTimezone: true }),
    actualEndAt: timestamp("actual_end_at", { withTimezone: true }),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "cancelled", "completed"],
    })
      .notNull()
      .default("pending"),
    note: text("note"),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    endedBy: uuid("ended_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_car_start_idx").on(t.carId, t.startAt),
    index("bookings_user_idx").on(t.userId),
  ],
);

export const parkingReports = pgTable(
  "parking_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carId: uuid("car_id")
      .notNull()
      .references(() => cars.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    reportedBy: uuid("reported_by")
      .notNull()
      .references(() => users.id),
    // All three are null for an "unknown / couldn't get GPS" report,
    // which then requires a note (SPEC §4).
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    accuracyM: doublePrecision("accuracy_m"),
    addressCached: text("address_cached"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("parking_reports_car_created_idx").on(t.carId, t.createdAt)],
);

// The two DB invariants from SPEC §7 live in SQL (partial index / exclusion
// constraint); their names are matched when turning a violation into an error
// code in lib/errors.ts.
export const activeTripIndexName = "one_active_trip_per_car";
export const noOverlapConstraintName = "no_overlapping_approved";

export type User = typeof users.$inferSelect;
export type Car = typeof cars.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ParkingReport = typeof parkingReports.$inferSelect;
export type NewCar = typeof cars.$inferInsert;
