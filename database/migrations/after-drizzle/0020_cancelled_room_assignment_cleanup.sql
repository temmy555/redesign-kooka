-- Release physical-room allocations left behind by reservations that had
-- already reached a terminal cancellation state before cancellation began
-- cleaning up room assignments transactionally.

WITH target_assignments AS MATERIALIZED (
  SELECT assignment.id
  FROM room_assignments assignment
  JOIN room_stays stay ON stay.id = assignment.room_stay_id
  JOIN reservation_rooms room_line ON room_line.id = stay.reservation_room_id
  JOIN reservations reservation ON reservation.id = room_line.reservation_id
  WHERE reservation.status IN ('CANCELLED', 'EXPIRED')
    AND assignment.status IN ('PLANNED', 'ACTIVE')
)
UPDATE room_assignment_nights night
SET released_at = COALESCE(night.released_at, now())
WHERE night.room_assignment_id IN (SELECT id FROM target_assignments)
  AND night.released_at IS NULL;

WITH target_assignments AS MATERIALIZED (
  SELECT assignment.id
  FROM room_assignments assignment
  JOIN room_stays stay ON stay.id = assignment.room_stay_id
  JOIN reservation_rooms room_line ON room_line.id = stay.reservation_room_id
  JOIN reservations reservation ON reservation.id = room_line.reservation_id
  WHERE reservation.status IN ('CANCELLED', 'EXPIRED')
    AND assignment.status IN ('PLANNED', 'ACTIVE')
)
UPDATE room_unit_night_claims claim
SET claim_status = 'RELEASED',
    released_at = COALESCE(claim.released_at, now())
WHERE claim.claim_type = 'ASSIGNMENT'
  AND claim.source_id IN (SELECT id FROM target_assignments)
  AND claim.claim_status = 'ACTIVE';

UPDATE room_assignments assignment
SET status = 'CANCELLED',
    updated_at = now(),
    version = assignment.version + 1
FROM room_stays stay
JOIN reservation_rooms room_line ON room_line.id = stay.reservation_room_id
JOIN reservations reservation ON reservation.id = room_line.reservation_id
WHERE assignment.room_stay_id = stay.id
  AND reservation.status IN ('CANCELLED', 'EXPIRED')
  AND assignment.status IN ('PLANNED', 'ACTIVE');

UPDATE reservation_rooms room_line
SET line_status = 'CANCELLED',
    updated_at = now(),
    version = room_line.version + 1
FROM reservations reservation
WHERE room_line.reservation_id = reservation.id
  AND reservation.status IN ('CANCELLED', 'EXPIRED')
  AND room_line.line_status = 'ACTIVE';
