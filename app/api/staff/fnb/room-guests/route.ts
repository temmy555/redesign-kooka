import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDatabase } from "../../../../../src/db";
import {
  AuthorizationError,
  requirePermission,
} from "../../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RoomGuestRow extends Record<string, unknown> {
  roomStayId: string;
  roomNumber: string;
  leadGuestName: string;
  chargePrivilege: string;
}

export async function GET() {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    await requirePermission(session, propertyId, "fnb.guest_lookup.view");
    const result = await getDatabase().execute<RoomGuestRow>(sql`
      select st.id as "roomStayId", ru.room_number as "roomNumber",
        coalesce(g.full_name, r.booker_name) as "leadGuestName",
        st.charge_privilege as "chargePrivilege"
      from room_stays st
      join reservation_rooms rr on rr.id = st.reservation_room_id
      join reservations r on r.id = rr.reservation_id
      join room_assignments ra on ra.room_stay_id = st.id and ra.status = 'ACTIVE'
      join room_units ru on ru.id = ra.room_unit_id
      left join guests g on g.id = st.lead_guest_id
      where r.property_id = ${propertyId} and st.status in ('IN_HOUSE','DUE_OUT')
        and st.charge_privilege = 'ALLOWED'
        and exists (
          select 1
          from folios f
          join folio_billing_buckets fb
            on fb.folio_id = f.id and fb.status = 'ACTIVE'
          where f.reservation_id = r.id and f.status = 'OPEN'
        )
      order by ru.sort_order, ru.room_number
    `);
    return NextResponse.json({ rooms: result.rows });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    )
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    throw error;
  }
}
