-- Akrav Cars initial schema (SPEC.md §7).
-- Milestones M0 + M1: identity, cars, bookings, parking reports.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  avatar_url  text,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by  uuid REFERENCES users (id),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES users (id),
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  expires_at timestamptz NOT NULL,
  claimed_by uuid REFERENCES users (id),
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cars (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname   text NOT NULL,
  make       text,
  model      text,
  year       integer,
  plate      text,
  colour     text,
  photo_url  text,
  notes      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id          uuid NOT NULL REFERENCES cars (id),
  user_id         uuid NOT NULL REFERENCES users (id),
  start_at        timestamptz NOT NULL,   -- planned window
  end_at          timestamptz NOT NULL,
  actual_start_at timestamptz,            -- real trip
  actual_end_at   timestamptz,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  note            text,
  decided_by      uuid REFERENCES users (id),
  decided_at      timestamptz,
  decision_note   text,
  ended_by        uuid REFERENCES users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT planned_window_ordered CHECK (end_at > start_at),
  CONSTRAINT trip_window_ordered CHECK (actual_end_at IS NULL OR actual_start_at IS NOT NULL),
  -- A trip can only exist on a booking that was approved and then completed.
  CONSTRAINT trip_requires_approval CHECK (
    actual_start_at IS NULL OR status IN ('approved', 'completed')
  )
);

CREATE INDEX bookings_car_start_idx ON bookings (car_id, start_at);
CREATE INDEX bookings_user_idx ON bookings (user_id);

CREATE TABLE parking_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id         uuid NOT NULL REFERENCES cars (id),
  booking_id     uuid REFERENCES bookings (id),
  reported_by    uuid NOT NULL REFERENCES users (id),
  lat            double precision,
  lng            double precision,
  accuracy_m     double precision,
  address_cached text,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- "unknown / couldn't get GPS" is allowed, but only with a note (SPEC §4).
  CONSTRAINT location_or_note CHECK (
    (lat IS NOT NULL AND lng IS NOT NULL)
    OR (note IS NOT NULL AND length(btrim(note)) > 0)
  ),
  CONSTRAINT coords_paired CHECK ((lat IS NULL) = (lng IS NULL))
);

CREATE INDEX parking_reports_car_created_idx ON parking_reports (car_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- The two invariants from SPEC §7 that the UI cannot be trusted to keep.
-- ---------------------------------------------------------------------------

-- At most one holder per car at a time.
CREATE UNIQUE INDEX one_active_trip_per_car ON bookings (car_id)
  WHERE actual_start_at IS NOT NULL AND actual_end_at IS NULL;

-- Approved bookings for a car may not overlap.
--
-- Deviation from SPEC §7, which also listed 'completed' in the predicate:
-- a completed booking keeps its *planned* window, so a trip that ended early
-- (planned 18:00-20:00, actually back at 18:30) would keep blocking the car
-- until 20:00, and a trip that ran late would make "End trip" itself fail the
-- constraint. §10 requires ending a trip to always succeed, so history is left
-- unconstrained; double-holding is prevented by one_active_trip_per_car above.
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_approved
  EXCLUDE USING gist (car_id WITH =, tstzrange(start_at, end_at) WITH &&)
  WHERE (status = 'approved');
