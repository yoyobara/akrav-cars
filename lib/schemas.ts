import { z } from "zod";

/** A parking report: either real coordinates, or "unknown" plus a note (SPEC §4). */
export const parkingInput = z
  .object({
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
    accuracyM: z.number().nonnegative().nullish(),
    /** Address the client already resolved, so the server need not re-geocode. */
    address: z.string().trim().max(300).nullish(),
    note: z.string().trim().max(500).nullish(),
  })
  .refine((v) => (v.lat == null) === (v.lng == null), {
    message: "Latitude and longitude must be given together.",
    path: ["lat"],
  })
  .refine((v) => v.lat != null || !!v.note, {
    message: "Without a location, a note saying where the car is left is required.",
    path: ["note"],
  });

export type ParkingInput = z.infer<typeof parkingInput>;

export const createBookingInput = z.object({
  carId: z.uuid(),
  startAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  endAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  note: z.string().trim().max(500).nullish(),
  /** Claim and take the car in one tap (SPEC §5.1). */
  startNow: z.boolean().optional(),
});

export const endBookingInput = z.object({ parking: parkingInput });

/** An admin may say why they turned a request down (SPEC §5.5). */
export const rejectBookingInput = z.object({
  reason: z.string().trim().max(300).nullish(),
});

export const approveManyInput = z.object({
  ids: z.array(z.uuid()).min(1).max(50),
});

export const carInput = z.object({
  nickname: z.string().trim().min(1).max(60),
  make: z.string().trim().max(60).nullish(),
  model: z.string().trim().max(60).nullish(),
  year: z.number().int().min(1900).max(2100).nullish(),
  plate: z.string().trim().max(20).nullish(),
  colour: z.string().trim().max(30).nullish(),
  photoUrl: z.url().max(500).nullish().or(z.literal("")),
  notes: z.string().trim().max(500).nullish(),
  isActive: z.boolean().optional(),
});

export const profileInput = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  avatarUrl: z.url().max(500).nullish().or(z.literal("")),
});

export const inviteInput = z.object({
  role: z.enum(["admin", "member"]).default("member"),
  /** Days until the link stops working. */
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

export const claimInviteInput = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.email().max(200),
});
