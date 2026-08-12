const EXPIRY_REASON = "Payment deadline elapsed without evidence under review";

export async function expireReservationPaymentHold(
  client,
  reservation,
  instant = new Date(),
  source = "OUTBOX",
) {
  if (
    !reservation ||
    reservation.status !== "ON_HOLD" ||
    !reservation.payment_deadline_at ||
    new Date(reservation.payment_deadline_at) > instant
  ) {
    return { skipped: "not-due" };
  }

  const review = await client.query(
    `select 1 from payments
     where folio_id = $1 and status = 'PENDING_VERIFICATION'
       and received_at <= $2
     limit 1`,
    [reservation.folio_id, reservation.payment_deadline_at],
  );
  if (review.rowCount) return { skipped: "payment-review-hold" };

  const updated = await client.query(
    `update reservations
     set status = 'EXPIRED', updated_at = now(), version = version + 1
     where id = $1 and status = 'ON_HOLD' and payment_deadline_at <= $2
     returning id`,
    [reservation.id, instant],
  );
  if (!updated.rowCount) return { skipped: "already-transitioned" };

  await client.query(
    `insert into reservation_status_events
       (reservation_id, action, from_status, to_status, reason)
     values ($1, 'EXPIRE', 'ON_HOLD', 'EXPIRED', $2)`,
    [reservation.id, EXPIRY_REASON],
  );
  const claims = await client.query(
    `update inventory_claims
     set claim_status = 'EXPIRED', released_at = now(), updated_at = now(), version = version + 1
     where source_type = 'RESERVATION' and source_id = $1
       and claim_type = 'PAYMENT_HOLD' and claim_status = 'ACTIVE'
     returning id`,
    [reservation.id],
  );
  for (const claim of claims.rows) {
    await client.query(
      `insert into inventory_claim_events
         (inventory_claim_id, action, from_status, to_status, reason)
       values ($1, 'EXPIRE', 'ACTIVE', 'EXPIRED', 'Reservation payment deadline elapsed')`,
      [claim.id],
    );
  }
  await client.query(
    `update resource_claims
     set claim_status = 'EXPIRED', released_at = now(),
         updated_at = now(), version = version + 1
     where reservation_room_id in (
       select id from reservation_rooms where reservation_id = $1
     ) and claim_status = 'ACTIVE'`,
    [reservation.id],
  );
  const closedFolio = await client.query(
    `update folios
     set status = 'CLOSED', closed_at = now(), updated_at = now(),
         version = version + 1
     where id = $1 and status = 'OPEN'
     returning id`,
    [reservation.folio_id],
  );
  if (closedFolio.rowCount) {
    await client.query(
      `insert into folio_status_events
         (folio_id, action, from_status, to_status, reason)
       values ($1, 'CLOSE_AFTER_RESERVATION_EXPIRY', 'OPEN', 'CLOSED', $2)`,
      [reservation.folio_id, EXPIRY_REASON],
    );
  }
  await client.query(
    `update notification_messages
     set status = 'CANCELLED', updated_at = now(), version = version + 1
     where reservation_id = $1 and status = 'QUEUED'`,
    [reservation.id],
  );
  await client.query(
    `insert into audit_events
       (property_id, actor_type, action, target_type, target_id,
        after_json, reason, result)
     values ($1, 'system', $2, 'reservation', $3,
       jsonb_build_object('status', 'EXPIRED', 'source', $4::text),
       $5, 'SUCCESS')`,
    [
      reservation.property_id,
      source === "RECONCILIATION"
        ? "booking.reservation.expire.reconciled"
        : "booking.reservation.expire",
      reservation.id,
      source,
      EXPIRY_REASON,
    ],
  );
  return {
    expired: true,
    releasedClaims: claims.rowCount ?? claims.rows.length,
  };
}

export async function reconcileExpiredReservationHolds(
  pool,
  instant = new Date(),
  batchSize = 100,
) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500)
    throw new Error("Reservation expiry batch size must be between 1 and 500");

  const client = await pool.connect();
  try {
    await client.query("begin");
    const selected = await client.query(
      `select r.*, f.id as folio_id
       from reservations r
       join folios f on f.reservation_id = r.id
       where r.source = 'ONLINE'
         and r.status = 'ON_HOLD'
         and r.payment_deadline_at is not null
         and r.payment_deadline_at <= $1
         and not exists (
           select 1 from payments p
           where p.folio_id = f.id
             and p.status = 'PENDING_VERIFICATION'
             and p.received_at <= r.payment_deadline_at
         )
       order by r.payment_deadline_at, r.id
       for update of r skip locked
       limit $2`,
      [instant, batchSize],
    );

    let expiredReservations = 0;
    let releasedClaims = 0;
    for (const reservation of selected.rows) {
      const result = await expireReservationPaymentHold(
        client,
        reservation,
        instant,
        "RECONCILIATION",
      );
      if (result.expired) {
        expiredReservations += 1;
        releasedClaims += Number(result.releasedClaims ?? 0);
      }
    }
    await client.query("commit");
    return {
      inspectedReservations: selected.rows.length,
      expiredReservations,
      releasedClaims,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
