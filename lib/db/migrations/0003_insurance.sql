-- Who is allowed to drive which car, because of insurance.
--
-- A car's policy either covers any driver, or only the people named on it.
-- Anyone else needs temporary insurance for the window they want the car, and
-- the app refuses to approve a booking or start a trip until it is recorded.

-- Cars that already exist keep behaving as before (anyone may drive them);
-- a car added from now on starts with nobody named, so an admin has to say.
ALTER TABLE cars ADD COLUMN any_driver boolean NOT NULL DEFAULT true;
ALTER TABLE cars ALTER COLUMN any_driver SET DEFAULT false;

-- Drivers named on the car's policy.
CREATE TABLE car_drivers (
  car_id   uuid NOT NULL REFERENCES cars (id),
  user_id  uuid NOT NULL REFERENCES users (id),
  added_by uuid NOT NULL REFERENCES users (id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (car_id, user_id)
);

-- Cover for one person on one car over a window. Revoked rather than deleted,
-- so it stays on record who was insured when (SPEC §10, auditability).
CREATE TABLE temporary_insurance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id     uuid NOT NULL REFERENCES cars (id),
  user_id    uuid NOT NULL REFERENCES users (id),
  start_at   timestamptz NOT NULL,
  end_at     timestamptz NOT NULL,
  note       text,
  -- The request it was added for, when it came from the inbox.
  booking_id uuid REFERENCES bookings (id),
  created_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES users (id),
  revoked_at timestamptz,

  CONSTRAINT insurance_window_ordered CHECK (end_at > start_at),
  CONSTRAINT insurance_revoked_together CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

CREATE INDEX temporary_insurance_lookup ON temporary_insurance (car_id, user_id, end_at)
  WHERE revoked_at IS NULL;
