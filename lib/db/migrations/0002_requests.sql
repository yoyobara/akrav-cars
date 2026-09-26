-- Milestone M2: the coordination layer.
--
-- The two conflict invariants from SPEC §7 already exist (0001_init.sql);
-- what M2 adds is the read path behind the admin inbox, which asks for every
-- pending request newest first and is the one query run on every page load
-- (the header badge counts the same rows).
CREATE INDEX bookings_pending_idx ON bookings (created_at DESC)
  WHERE status = 'pending';

-- A rejection should say why, and SPEC §5.5 makes the reason optional, so an
-- empty string would be a third state meaning the same as NULL. Normalise it.
ALTER TABLE bookings ADD CONSTRAINT decision_note_not_blank CHECK (
  decision_note IS NULL OR length(btrim(decision_note)) > 0
);
