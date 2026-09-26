# Akrav Cars

A mobile-first web app for a family sharing a few cars: **who has which car right now,
who has it next, and where it was left.** Built from [SPEC.md](./SPEC.md).

**Implemented: milestones M0, M1 and M2** — identity and cars, the daily
take-car / end-trip / GPS-parking handoff, and now the coordination layer:
future bookings, the admin approval inbox, and the conflict rules enforced in
the database.

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
- **Request a car for later** — car picker, the presets from §5.3 (*Now for 1h*,
  *Now for 3h*, *Tonight*, *Tomorrow morning*, custom pickers), an optional note, and a
  live conflict hint naming whoever already has that slot, before you submit.
- **Admin inbox** — every pending request newest first, with who, which car, when, the
  note, and a clash warning naming the approved booking in the way. Approve or reject
  with an optional reason, or bulk-approve everything that does not clash. The badge in
  the header carries the count from wherever you are.
- **Your requests** — the garage shows what you have asked for and whether it is still
  waiting, approved or rejected (with the admin's reason), and lets you cancel.

## Decisions taken while building

- **Open question O1 → option (b).** A claim on a car that is free right now, with no
  conflicting approved booking, is auto-approved; future slots become `pending` and go
  to the inbox. An admin's own booking is always auto-approved (SPEC §4).
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
- **Times are built in Asia/Jerusalem, not in the phone's timezone.** "Tomorrow morning"
  and the custom pickers are wall-clock times, and §7 fixes the wall clock the family
  reads. Doing the arithmetic in browser-local time would put a request an hour out for
  whoever is travelling while still rendering it back to them as Jerusalem time, so
  `lib/time.ts` anchors both directions to the zone and handles the October DST change.
- **A rejected request stays visible to the requester for 24 hours.** Not in §5.5 — it is
  there because the notification that was supposed to tell them (§6) is M3. Without it a
  member whose request was turned down would have no way of finding out.
- **A pending request whose window has already passed can only be rejected.** Approving it
  would create a booking nobody could ever start, so the inbox marks it expired and
  `approve` refuses with `request_expired`.
- **Bulk approve is sequential, one transaction each, and reports partial success.**
  Approving the first request is what makes the second one clash, and a single clash must
  not undo the approvals that already went through; the inbox shows the reason per row.
- **Fixed: violations of the §7 invariants were returning 500.** Drizzle wraps the driver
  error in a `DrizzleQueryError` and hangs the real `PostgresError` off `cause`, so the
  M1 error mapping never saw the constraint name and both invariants fell through to
  "Something went wrong". They now return the documented `car_in_use` / `booking_conflict`
  with a sentence — which M2 needs, since bulk approve relies on recognising the loser of
  a race rather than aborting the batch.
- **Fixed: admin screens returned 500 for a member** who followed an admin link, because
  `requireAdmin` throws and a page has no error boundary to catch it. Pages now use
  `requireAdminPage`, which redirects to the garage; API routes keep throwing, which is
  what produces their 403 with a sentence.

## Not built yet

M3 (web push, the notification matrix, iOS add-to-home-screen onboarding) ·
M4 (week calendar, overdue nudges, PWA install).

**Swipe actions in the inbox** (SPEC §5.5) are not there. The Approve / Reject buttons
are full-width and 44 px tall, which covers the same job one-handed; a swipe that has to
coexist with page scrolling is worth doing when it can be tried on a real phone rather
than guessed at.

**"Ask X for it"** (SPEC §5.1) still does nothing useful without a notification to send,
so a car someone else is holding offers *Request this car* instead. `POST /api/cars/:id/ask`
arrives with M3.

Parking history pruning after 90 days (§10) needs the scheduled worker that arrives with
M4; nothing prunes today.

## Layout

```
app/(app)/            signed-in screens: garage, car detail, end trip, settings, admin
app/signin, /invite   the two screens reachable signed out
app/api/              the endpoints from SPEC §8
lib/db/               Drizzle schema and the SQL migrations
lib/bookings.ts       the booking lifecycle: create, approve, reject, start, end, cancel
lib/status.ts         derived car status — never stored, so it cannot drift
lib/queries.ts        the reads behind the garage, car detail and admin inbox
lib/presets.ts        the quick presets from §5.1 and §5.3, shared by both sheets
lib/time.ts           rendering *and* building instants, always Asia/Jerusalem
lib/outbox.ts         parking reports queued when the phone has no signal
components/           UI; MapInner.tsx is the only place Leaflet is touched
```
