# Akrav Cars — Specification

A mobile-first web app for a family to coordinate shared cars: **who has which car right now, who has it next, and where it was left.**

Status: draft v1 · 2026-09-26

---

## 1. Problem

The family shares a small number of cars. Two things go wrong daily:

1. **Nobody knows who has the car** or when it will be back, so plans collide and coordination happens over scattered phone calls.
2. **Nobody knows where the car is parked.** The driver who finished has the information; the next driver does not.

Everything else about car ownership (service, insurance, fuel costs) is explicitly *not* this app's job.

## 2. Goals

- Answer "can I use a car in 20 minutes?" in one glance, without asking anyone.
- Let the finishing driver hand off the car's location in **one tap**, with GPS accuracy good enough to walk to it.
- Let members request a car ahead of time; an admin approves.
- Push a notification to the people who actually need to know, and nobody else.

### Non-goals (v1)

Maintenance logs · test/insurance/license deadlines · fuel and expense tracking · cost splitting · live vehicle telematics · multiple households/tenants · public sharing outside the family.

## 3. Users and roles

| Role | Who | Can |
|---|---|---|
| **Admin** | Parents / car owners | Everything a member can, plus: approve/reject requests, add & edit cars, invite & remove members, promote members, override an active trip |
| **Member** | Everyone else who drives | Request a car, take/return a car for an approved booking, report parking, see all cars' status and history |

- Per-person accounts. Every action is attributed to a person by name and avatar.
- Single household — no tenant concept in v1. (See §11 for the migration note.)
- Members join through an **admin-generated invite link**; first sign-in claims the invite.

## 4. Core concepts

**Car** — a vehicle the family shares. Has a nickname (what people actually call it: "the Mazda", "Dad's car"), plate, make/model/year, colour, optional photo.

**Booking** — one person's intent to use one car over a time window. This single entity covers both "I'm taking it now" and "I want it Saturday morning" — a spontaneous claim is just a booking whose window starts now. A booking carries both *planned* times (what was requested) and *actual* times (when the car was really taken and returned).

**Parking report** — where a car was left: coordinates, accuracy, an optional note ("level -2, near the elevator"), and who reported it. A car's current location is simply its most recent report; earlier reports are kept as history.

### Booking lifecycle

```
                   ┌──────────── admin rejects ──────────► rejected
                   │
  member requests ─┴─► pending ── admin approves ──► approved ──┬── requester cancels ──► cancelled
                                                                │
  admin requests ─────────────────► (auto-approved) ────────────┤
                                                                │
                                        holder taps "Take car"  ▼
                                                              active  ──  holder taps "End trip"
                                                                │         (parking report required)
                                                                ▼
                                                            completed
```

Rules:

- **Every booking starts as a request needing admin approval.** An admin's own booking is auto-approved. (This is a deliberate constraint from the family; see open question O1 about the friction it creates for urgent trips.)
- A booking can only become `active` once approved, and only within a grace window around its start (default: from 30 min before `start_at` until 2 h after).
- **At most one car may be `active` per car at a time** — enforced in the database, not just the UI.
- **Approved bookings for the same car may not overlap** — also enforced in the database. Multiple *pending* requests may overlap freely; the admin resolves them by approving one. Approving a request that conflicts with an already-approved booking fails with a clear "this clashes with Noa 19:00–21:00 — reject that one first?" prompt.
- Ending a trip **requires** a parking report. That is the whole point of the app; it is not skippable, though the location may be "unknown / couldn't get GPS" with a mandatory note as an escape hatch.
- An admin can force-end someone else's active trip (e.g. they forgot), which asks the admin for the location instead.

### Derived car status

Never stored as a column — always computed, so it cannot drift:

| Status | Meaning |
|---|---|
| 🔴 **In use** | An `active` booking exists. Shows holder + expected return time. |
| 🟡 **Reserved** | An approved booking starts within the next 60 min. Shows who and when. |
| 🟢 **Available** | Neither of the above. Shows last known parking location and how long ago. |

## 5. Screens

### 5.1 Garage (home)

The screen that answers everything. One card per car, ordered: available first, then reserved, then in use.

```
┌─ Mazda 3 ──────────────────────┐   ┌─ Kia Picanto ──────────────────┐
│ 🟢 Available                    │   │ 🔴 Yotam has it                 │
│ 📍 Rothschild 12 · level -1     │   │    back ~18:30 (in 40 min)      │
│    parked 2h ago by Noa         │   │ 📍 last seen: Home              │
│                                 │   │                                 │
│ [ Request this car ]            │   │ [ Ask Yotam for it ]            │
│ Next: today 19:00 Yotam         │   │ Next: tomorrow 08:00 Mom        │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

Plus: a compact "today" strip showing every car's bookings for the next 12 hours, and an admin badge with the pending-request count.

### 5.2 Car detail

- Status header, large.
- **Map** with the parking pin, an accuracy circle, the note, the reporter and timestamp. Buttons: **Navigate** (Waze / Google Maps / Apple Maps deep link), **Copy coordinates**.
- Primary action, contextual: `Request car` · `Take the car` (when you hold an approved booking now) · `End trip & report parking` (when you are the holder) · `Ask for it` (when someone else holds it).
- Today's timeline, then upcoming bookings.
- Recent parking history (last 10) and recent trips.
- Admin only: edit car, archive car.

### 5.3 Request sheet

Car picker · quick presets (**Now for 1h** / **Now for 3h** / **Tonight** / **Tomorrow morning** / custom) · start & end pickers · optional note ("driving Grandma to the clinic") · live conflict hint ("Mom has it until 20:00") before submitting. Submitting shows a clear "waiting for approval" state.

### 5.4 Week calendar

Cars as columns, hours as rows, colour per person, pending requests shown hatched/translucent. Tap a block for detail. Read-only for members; admins can approve from a long-press.

### 5.5 Admin inbox

A queue of pending requests, newest first. Each row: who, which car, when, note, conflict warning if any, and **Approve / Reject** with an optional reason on reject. Swipe actions on mobile. Bulk-approve non-conflicting requests.

### 5.6 End trip

The most-used flow, so it must be fast:

1. Tap `End trip`.
2. GPS is requested immediately; pin drops on the map, draggable to correct it. Reverse-geocoded address shown as a label (cached).
3. Optional note field with the last few notes used for this car as one-tap suggestions.
4. `Done` → trip completes, push goes to whoever has the car next.

Total: two taps if GPS is good and no note is needed.

### 5.7 Settings

Profile (name, photo) · enable push + per-event toggles · admin sections: cars, members, invite link.

## 6. Notifications (web push)

| Event | Goes to |
|---|---|
| New request submitted | All admins |
| Request approved / rejected | The requester |
| Car returned & parked | The next person with an approved booking; optionally all members |
| Your booking starts in 15 min | The holder |
| Someone is asking for the car you hold | The holder |
| Trip overdue by 30 min | The holder (nudge) |
| Trip overdue by 60 min | All admins |

Delivery: Web Push with VAPID; subscriptions stored per device, pruned on `410 Gone`. Notifications are **actionable** where possible (Approve / Reject directly from the notification on Android).

> **iOS caveat:** web push on iOS requires Safari 16.4+ **and** the app added to the home screen. Onboarding must walk iPhone users through "Share → Add to Home Screen" explicitly, and the app must degrade gracefully (in-app badge + a "notifications are off for this device" banner) when push is unavailable.

## 7. Data model

```sql
users              id, name, email (unique), avatar_url, role ('admin'|'member'),
                   invited_by, joined_at, is_active

invites            id, token (unique), created_by, role, expires_at, claimed_by, claimed_at

cars               id, nickname, make, model, year, plate, colour, photo_url,
                   notes, is_active, created_at

bookings           id, car_id → cars, user_id → users,
                   start_at, end_at,                    -- planned window
                   actual_start_at, actual_end_at,      -- real trip
                   status ('pending'|'approved'|'rejected'|'cancelled'|'completed'),
                   note,
                   decided_by → users, decided_at, decision_note,
                   ended_by → users,                    -- differs from user_id on admin force-end
                   created_at

parking_reports    id, car_id → cars, booking_id → bookings (nullable),
                   reported_by → users,
                   lat, lng, accuracy_m,                -- all nullable for "unknown"
                   address_cached, note, created_at

push_subscriptions id, user_id → users, endpoint (unique), p256dh, auth,
                   user_agent, created_at, last_seen_at

notification_prefs user_id, event_type, enabled
```

Two invariants belong in the database, since the UI cannot be trusted:

```sql
-- at most one car-holder at a time
CREATE UNIQUE INDEX one_active_trip_per_car ON bookings (car_id)
  WHERE actual_start_at IS NOT NULL AND actual_end_at IS NULL;

-- approved bookings for a car may not overlap
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_approved
  EXCLUDE USING gist (car_id WITH =, tstzrange(start_at, end_at) WITH &&)
  WHERE (status IN ('approved', 'completed'));
```

All timestamps stored UTC, rendered in `Asia/Jerusalem`.

## 8. API sketch

```
GET    /api/cars                      list + derived status + current location
GET    /api/cars/:id                  detail, bookings, parking history
POST   /api/cars                      admin
PATCH  /api/cars/:id                  admin

GET    /api/bookings?from&to&car_id    calendar feed
POST   /api/bookings                   create request → pending (admin: approved)
POST   /api/bookings/:id/approve       admin
POST   /api/bookings/:id/reject        admin  { reason? }
POST   /api/bookings/:id/cancel        requester or admin
POST   /api/bookings/:id/start         holder → active
POST   /api/bookings/:id/end           holder or admin; body includes the parking report

POST   /api/cars/:id/parking           standalone parking report (car moved without a trip)
POST   /api/cars/:id/ask               ping the current holder

GET    /api/me   PATCH /api/me
POST   /api/push/subscribe   DELETE /api/push/subscribe
POST   /api/invites                    admin
POST   /api/invites/:token/claim
```

Conflict and permission failures return a machine-readable code plus a human sentence the UI can show verbatim.

## 9. Technical approach

- **Next.js (App Router) + TypeScript + Tailwind**, deployed on Vercel or Fly.io.
- **Postgres** (Neon or Supabase) with **Drizzle** or Prisma. The exclusion constraint above needs real Postgres — not SQLite.
- **Auth.js** with Google sign-in (the family is already on Gmail) plus email magic-link fallback. Sessions long-lived; nobody should be logged out on a phone.
- **Maps:** MapLibre or Leaflet with OpenStreetMap tiles — no API key, no billing. Reverse geocoding via Nominatim, **cached per report** to respect its rate limits. Navigation via deep links rather than in-app routing.
- **Push:** `web-push` + VAPID keys, service worker handling `push` and `notificationclick`.
- **PWA:** manifest, icons, install prompt, service-worker cache so the garage screen renders last-known state offline.
- Scheduled jobs (booking-soon, overdue nudges) via Vercel Cron or a small scheduled worker — one job per minute is plenty.

Alternative if you'd rather not run a Next.js server: a static React SPA on Supabase (Postgres + Auth + Row Level Security + Edge Functions for push) removes the backend deployment but pushes authorization logic into RLS policies.

## 10. Non-functional requirements

- **Mobile first.** Designed for a 390 px-wide phone held one-handed; desktop is a widened version of the same layout.
- **Fast.** Garage screen interactive in under 2 s on 4G; taking or ending a trip feels instant (optimistic UI, reconciled on response).
- **Reliable handoffs.** Ending a trip must succeed on a flaky connection: queue the report locally and retry in the service worker.
- **Hebrew / RTL support** if the family wants it — plan for it in the layout from day one even if v1 ships in English only.
- **Privacy.** Location is attached to *cars*, captured only on explicit tap, never continuously. It is visible only to household members. Parking history is pruned after 90 days. This is stated in-app so nobody thinks they're being tracked.
- **Auditability.** Every approval, rejection and force-end records who did it and when.

## 11. Milestones

| # | Scope | Why this order |
|---|---|---|
| **M0** | Auth, users, invite links, cars CRUD, empty garage screen | Nothing works without identity and cars |
| **M1** | Take car / end trip + GPS parking report + map + navigate link | **This alone solves the daily pain.** Ship it and use it, even with no calendar. |
| **M2** | Future bookings, admin approval inbox, DB conflict constraints | The coordination layer |
| **M3** | Web push + the notification matrix + iOS install onboarding | Turns the app from pull to push |
| **M4** | Week calendar, overdue nudges, parking history, polish, PWA install | Comfort |
| later | Fuel/expenses, maintenance and renewal deadlines, per-member auto-approve | Explicitly deferred |

Ship M1 before building M2. A shared spreadsheet handles planning; nothing handles "where is the car."

### Migration note

Everything is scoped to one implicit household. If a second household is ever needed, the change is a `household_id` on `users`, `cars`, `bookings`, and `parking_reports`, plus a scope filter in every query — cheap to add later, so it is not built now.

## 12. Open questions

- **O1 — Approval friction.** Requiring admin approval for *every* booking means a member who needs to leave in five minutes may be blocked waiting for a parent to look at their phone. Worth deciding: (a) keep it strict as specified; (b) auto-approve a claim when the car is free right now and no approved booking conflicts, requiring approval only for future slots; or (c) a per-member "trusted driver" flag admins can grant per car. **Recommendation: (c)** — it preserves admin control as the default while removing the daily bottleneck once trust is established. Specified as (a) until you decide.
- **O2 — Forgotten trip ends.** If someone parks and never taps "End trip", the car looks occupied. Overdue nudges plus admin force-end cover it, but is that enough, or should a booking auto-complete at `end_at + 2h` with location "unknown"?
- **O3 — Keys vs. car.** Is the physical key ever somewhere other than with the car or the last driver? If so, "where are the keys" is a second piece of state worth tracking.
- **O4 — Language.** Ship in Hebrew, English, or both?
- **O5 — Household size.** How many cars and how many drivers? Under ~4 cars the garage screen works as specified; more would need filtering and search.
