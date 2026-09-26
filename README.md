# Akrav Cars

A mobile-first web app for a family sharing a few cars: **who has which car right now,
who has it next, and where it was left.** Built from [SPEC.md](./SPEC.md).

**Implemented: milestones M0 and M1.** The spec says to ship M1 and use it before
building the coordination layer, so that is what this is — identity, cars, taking
and ending a trip, and the GPS parking handoff.

## Running it

```bash
cp .env.example .env.local     # paste your Neon connection string, add AUTH_SECRET
npm install
npm run db:migrate             # creates the schema, including the §7 invariants
npm run db:seed                # first admin, two example cars
npm run dev
```

Then open <http://localhost:3000> and pick who you are.

Any Postgres 13+ with `btree_gist` works, not just Neon — for offline work:

```bash
docker run -d --name akrav-pg -e POSTGRES_PASSWORD=akrav -e POSTGRES_DB=akrav \
  -p 55432:5432 postgres:18-alpine
# DATABASE_URL="postgresql://postgres:akrav@127.0.0.1:55432/akrav"
```

| Command | |
|---|---|
| `npm run dev` | development server |
| `npm run db:migrate` | apply `lib/db/migrations/*.sql` (each runs once) |
| `npm run db:seed` | create the first admin and example cars, idempotent |
| `npm run typecheck` / `npm run lint` | |

## What works

- **Garage** — one card per car, available first, then reserved, then in use, with the
  last known parking location and a 12-hour strip of what is booked.
- **Take the car** — one tap with a duration preset. The booking is created, approved
  and started in a single request.
- **End trip** — GPS is requested on arrival at the screen, the pin is draggable, the
  address is reverse-geocoded, notes are suggested from this car's recent ones. A
  parking report is mandatory; "no GPS" is allowed only with a note.
- **Car detail** — map with accuracy circle, Waze / Google Maps / Apple Maps deep links,
  copy coordinates, upcoming bookings, parking history, recent trips.
- **Standalone parking report** — for when a car is moved without a trip.
- **Admin** — add and edit cars, invite links, promote and remove members, force-end
  someone else's trip (the location then comes from the admin, and `ended_by` records it).

## Decisions taken while building

- **Open question O1 → option (b).** A claim on a car that is free right now, with no
  conflicting approved booking, is auto-approved; future slots still become `pending`.
  The API creates those pending requests, but the admin inbox that resolves them is M2,
  so the M1 UI only offers claim-now.
- **Sign-in is a development bypass** — pick a name, no password. Auth.js is wired up, so
  Google (SPEC §9) is one provider entry plus credentials away. **Do not deploy this
  publicly as it stands:** anyone who reaches the sign-in page can become anyone.
- **The `no_overlapping_approved` constraint covers `approved` only**, where SPEC §7 also
  listed `completed`. A completed booking keeps its *planned* window, so including it
  would keep a car blocked until 20:00 after a trip that actually ended at 18:30, and a
  trip that ran late would fail the constraint on "End trip" itself — which §10 requires
  to always succeed. Double-holding is still impossible: `one_active_trip_per_car`
  enforces it. Both invariants are tested in the database, not just the UI.
- **No `active` booking status.** The lifecycle's "active" is derived
  (`approved` + started + not ended), which is exactly what the unique index enforces, so
  the two can never disagree.
- **Migrations are hand-written SQL** rather than drizzle-kit, because the exclusion
  constraint cannot be expressed in the Drizzle schema DSL.
- **Reverse geocoding asks Nominatim for Hebrew first** (`Accept-Language: he,en`), since
  Israeli street names are more recognisable that way. One place to change if O4 lands
  on English.

## Not built yet

M2 (future bookings UI, admin approval inbox) · M3 (web push, the notification matrix,
iOS add-to-home-screen onboarding) · M4 (week calendar, overdue nudges, PWA install).

Two pieces of the spec depend on push and are deliberately absent: `POST /api/cars/:id/ask`
and the "Ask X for it" button do nothing useful without a notification to send.

Parking history pruning after 90 days (§10) needs the scheduled worker that arrives with
M4; nothing prunes today.

## Layout

```
app/(app)/            signed-in screens: garage, car detail, end trip, settings, admin
app/signin, /invite   the two screens reachable signed out
app/api/              the endpoints from SPEC §8
lib/db/               Drizzle schema and the SQL migrations
lib/bookings.ts       the booking lifecycle: create, start, end, cancel
lib/status.ts         derived car status — never stored, so it cannot drift
lib/queries.ts        the reads behind the garage and car detail screens
lib/outbox.ts         parking reports queued when the phone has no signal
components/           UI; MapInner.tsx is the only place Leaflet is touched
```
