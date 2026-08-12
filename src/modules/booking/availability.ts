import "server-only";

import { and, eq, gt, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDatabase } from "../../db";
import {
  inventoryClaims,
  inventoryDays,
  ratePlans,
  ratePlanVersions,
  rateRules,
  roomTypes,
  roomTypeVersions,
} from "../../db/schema";
import type * as schema from "../../db/schema";
import { AppError } from "../../platform/errors";
import { enumerateStayDates } from "./domain";
import { resolveActivePaymentInstructions } from "./payment-instructions";
import type { SearchRequest } from "./contracts";

type BookingDb = Pick<NodePgDatabase<typeof schema>, "execute" | "select">;

export interface InventoryAvailability {
  inventoryDayId: string;
  roomTypeId: string;
  stayDate: string;
  physicalCapacity: number;
  claimed: number;
  available: number;
  salesClosed: boolean;
}

export function validateSearchRequest(input: SearchRequest): string[] {
  const dates = enumerateStayDates(input.checkInDate, input.checkoutDate);
  if (
    !Number.isInteger(input.rooms) ||
    input.rooms < 1 ||
    input.rooms > 15 ||
    !Number.isInteger(input.adults) ||
    input.adults < 1 ||
    input.children < 0 ||
    input.infants < 0
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid room or guest count");
  }
  return dates;
}

/**
 * Materialises the inventory horizon from physical active room units and
 * their effective-dated room-type mapping. It creates no estimated capacity:
 * a date without mapped physical units remains capacity zero.
 */
export async function ensureInventoryDays(
  db: BookingDb,
  propertyId: string,
  roomTypeIds: string[],
  stayDates: string[],
): Promise<void> {
  if (roomTypeIds.length === 0 || stayDates.length === 0) return;
  const requestedRoomTypeIds = sql.join(
    roomTypeIds.map((roomTypeId) => sql`${roomTypeId}`),
    sql`, `,
  );
  const requestedStayDates = sql.join(
    stayDates.map((stayDate) => sql`${stayDate}`),
    sql`, `,
  );
  await db.execute(sql`
    with requested as (
      select requested_room.room_type_id, requested_date.stay_date
      from unnest(array[${requestedRoomTypeIds}]::uuid[]) as requested_room(room_type_id)
      cross join unnest(array[${requestedStayDates}]::date[]) as requested_date(stay_date)
    ), capacity as (
      select
        requested.room_type_id,
        requested.stay_date,
        count(distinct room_units.id)::integer as physical_capacity
      from requested
      left join room_unit_type_periods
        on room_unit_type_periods.room_type_id = requested.room_type_id
       and room_unit_type_periods.effective_from <= requested.stay_date::timestamptz
       and (
         room_unit_type_periods.effective_to is null
         or room_unit_type_periods.effective_to > requested.stay_date::timestamptz
       )
      left join room_units
        on room_units.id = room_unit_type_periods.room_unit_id
       and room_units.property_id = ${propertyId}::uuid
       and room_units.status = 'ACTIVE'
      group by requested.room_type_id, requested.stay_date
    )
    insert into inventory_days (
      property_id, room_type_id, stay_date, physical_capacity
    )
    select ${propertyId}::uuid, room_type_id, stay_date, physical_capacity
    from capacity
    on conflict (property_id, room_type_id, stay_date)
    do update set
      physical_capacity = excluded.physical_capacity,
      updated_at = now(),
      version = inventory_days.version + 1
  `);
}

export async function readInventoryAvailability(
  db: BookingDb,
  propertyId: string,
  roomTypeIds: string[],
  stayDates: string[],
  options?: { lock?: boolean; now?: Date },
): Promise<InventoryAvailability[]> {
  if (roomTypeIds.length === 0 || stayDates.length === 0) return [];
  const now = options?.now ?? new Date();
  const query = db
    .select({
      inventoryDayId: inventoryDays.id,
      roomTypeId: inventoryDays.roomTypeId,
      stayDate: inventoryDays.stayDate,
      physicalCapacity: inventoryDays.physicalCapacity,
      salesClosed: inventoryDays.salesClosed,
    })
    .from(inventoryDays)
    .where(
      and(
        eq(inventoryDays.propertyId, propertyId),
        inArray(inventoryDays.roomTypeId, roomTypeIds),
        inArray(inventoryDays.stayDate, stayDates),
      ),
    )
    .orderBy(inventoryDays.roomTypeId, inventoryDays.stayDate);
  const days = options?.lock ? await query.for("update") : await query;
  const dayIds = days.map((day) => day.inventoryDayId);
  const claimRows = dayIds.length
    ? await db
        .select({
          inventoryDayId: inventoryClaims.inventoryDayId,
          quantity: inventoryClaims.quantity,
        })
        .from(inventoryClaims)
        .where(
          and(
            inArray(inventoryClaims.inventoryDayId, dayIds),
            eq(inventoryClaims.claimStatus, "ACTIVE"),
            // A quote is only a price snapshot. Inventory starts being held
            // after the customer submits Book Now and a reservation exists.
            ne(inventoryClaims.claimType, "CHECKOUT_HOLD"),
            sql`(${inventoryClaims.expiresAt} is null or ${inventoryClaims.expiresAt} > ${now})`,
          ),
        )
    : [];
  const claimed = new Map<string, number>();
  for (const row of claimRows) {
    claimed.set(
      row.inventoryDayId,
      (claimed.get(row.inventoryDayId) ?? 0) + row.quantity,
    );
  }
  return days.map((day) => {
    const used = claimed.get(day.inventoryDayId) ?? 0;
    return {
      ...day,
      claimed: used,
      available: Math.max(0, day.physicalCapacity - used),
    };
  });
}

export function assertInventoryAvailable(
  rows: InventoryAvailability[],
  roomQuantities: Map<string, number>,
  stayDates: string[],
): void {
  for (const [roomTypeId, quantity] of roomQuantities) {
    for (const stayDate of stayDates) {
      const row = rows.find(
        (candidate) =>
          candidate.roomTypeId === roomTypeId &&
          candidate.stayDate === stayDate,
      );
      if (!row || row.salesClosed || row.available < quantity) {
        throw new AppError(
          "CONFLICT",
          "One or more selected rooms are no longer available",
          { roomTypeId, stayDate },
        );
      }
    }
  }
}

export async function searchAvailability(
  propertyId: string,
  input: SearchRequest,
) {
  const stayDates = validateSearchRequest(input);
  const db = getDatabase();
  const now = new Date();
  const typeRows = await db
    .select({
      id: roomTypes.id,
      code: roomTypes.code,
      nameId: roomTypeVersions.nameId,
      nameEn: roomTypeVersions.nameEn,
      maximumAdults: roomTypeVersions.maximumAdults,
      maximumChildren: roomTypeVersions.maximumChildren,
      maximumTotalGuests: roomTypeVersions.maximumTotalGuests,
      extraBedAllowed: roomTypeVersions.extraBedAllowed,
      maximumExtraBeds: roomTypeVersions.maximumExtraBeds,
      extraBedCapacityIncrement: roomTypeVersions.extraBedCapacityIncrement,
    })
    .from(roomTypes)
    .innerJoin(roomTypeVersions, eq(roomTypeVersions.roomTypeId, roomTypes.id))
    .where(
      and(
        eq(roomTypes.propertyId, propertyId),
        eq(roomTypes.status, "ACTIVE"),
        eq(roomTypeVersions.lifecycleStatus, "ACTIVE"),
        lte(roomTypeVersions.effectiveFrom, now),
        or(
          isNull(roomTypeVersions.effectiveTo),
          gt(roomTypeVersions.effectiveTo, now),
        ),
      ),
    );
  // A room type can have historical versions. The effective-date predicate is
  // the source of truth; this final guard keeps malformed overlapping legacy
  // data from producing duplicate room cards in the public booking UI.
  const types = [
    ...new Map(typeRows.map((roomType) => [roomType.id, roomType])).values(),
  ];
  await ensureInventoryDays(
    db,
    propertyId,
    types.map((roomType) => roomType.id),
    stayDates,
  );
  const inventory = await readInventoryAvailability(
    db,
    propertyId,
    types.map((roomType) => roomType.id),
    stayDates,
  );
  const rateRows = await db
    .select({
      roomTypeId: rateRules.roomTypeId,
      ratePlanCode: ratePlans.code,
      ratePlanNameId: ratePlanVersions.nameId,
      ratePlanNameEn: ratePlanVersions.nameEn,
      lifecycleStatus: ratePlanVersions.lifecycleStatus,
      approvalStatus: ratePlanVersions.approvalStatus,
      sourceEligibility: ratePlanVersions.sourceEligibility,
      effectiveFrom: ratePlanVersions.effectiveFrom,
      effectiveTo: ratePlanVersions.effectiveTo,
      ruleId: rateRules.id,
      ruleType: rateRules.ruleType,
      priority: rateRules.priority,
      startsOn: rateRules.startsOn,
      endsOn: rateRules.endsOn,
      weekdaysMask: rateRules.weekdaysMask,
      nightlyRateIdr: rateRules.nightlyRateIdr,
      minimumStay: rateRules.minimumStay,
      maximumStay: rateRules.maximumStay,
      closedToArrival: rateRules.closedToArrival,
      closedToDeparture: rateRules.closedToDeparture,
    })
    .from(ratePlans)
    .innerJoin(ratePlanVersions, eq(ratePlanVersions.ratePlanId, ratePlans.id))
    .innerJoin(rateRules, eq(rateRules.ratePlanVersionId, ratePlanVersions.id))
    .where(
      and(
        eq(ratePlans.propertyId, propertyId),
        eq(ratePlans.status, "ACTIVE"),
        inArray(ratePlanVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
        inArray(
          rateRules.roomTypeId,
          types.map((roomType) => roomType.id),
        ),
      ),
    );

  const paymentInstructions = await resolveActivePaymentInstructions(
    db,
    propertyId,
    now,
  );

  const ruleRank: Record<string, number> = {
    BASE: 1,
    WEEK_PATTERN: 2,
    SEASONAL: 3,
    SPECIAL_DATE: 4,
  };
  const activeRates = paymentInstructions.length
    ? rateRows.filter(
        (row) =>
          row.effectiveFrom <= now &&
          (!row.effectiveTo || row.effectiveTo > now) &&
          ["APPROVED", "NOT_REQUIRED"].includes(row.approvalStatus) &&
          ["ALL", "ONLINE"].includes(row.sourceEligibility),
      )
    : [];
  const offerFor = (roomTypeId: string) => {
    const codes = [
      ...new Set(
        activeRates
          .filter((row) => row.roomTypeId === roomTypeId)
          .map((row) => row.ratePlanCode),
      ),
    ];
    return codes
      .map((ratePlanCode) => {
        const rows = activeRates.filter(
          (row) =>
            row.roomTypeId === roomTypeId && row.ratePlanCode === ratePlanCode,
        );
        const winningRules = stayDates.map((stayDate) => {
          const weekday = new Date(`${stayDate}T00:00:00.000Z`).getUTCDay();
          return rows
            .filter(
              (row) =>
                row.startsOn <= stayDate &&
                row.endsOn >= stayDate &&
                (row.weekdaysMask & (1 << weekday)) !== 0,
            )
            .sort(
              (left, right) =>
                (ruleRank[right.ruleType] ?? 0) -
                  (ruleRank[left.ruleType] ?? 0) ||
                right.priority - left.priority ||
                left.ruleId.localeCompare(right.ruleId),
            )[0];
        });
        if (winningRules.some((rule) => !rule)) return null;
        const first = winningRules[0]!;
        const last = winningRules.at(-1)!;
        if (
          first.closedToArrival ||
          last.closedToDeparture ||
          stayDates.length < first.minimumStay ||
          (first.maximumStay && stayDates.length > first.maximumStay)
        ) {
          return null;
        }
        const nightlyRates = winningRules.map((rule) =>
          Number(rule!.nightlyRateIdr),
        );
        return {
          ratePlanCode,
          ratePlanNameId: first.ratePlanNameId,
          ratePlanNameEn: first.ratePlanNameEn,
          nightlyFromIdr: Math.min(...nightlyRates),
          estimatedStayIdr: nightlyRates.reduce(
            (total, rate) => total + rate,
            0,
          ),
        };
      })
      .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer))
      .sort((left, right) => left.estimatedStayIdr - right.estimatedStayIdr)[0];
  };
  return {
    checkInDate: input.checkInDate,
    checkoutDate: input.checkoutDate,
    nights: stayDates.length,
    requestedRooms: input.rooms,
    roomTypes: types.map((roomType) => {
      const nightly = inventory.filter((row) => row.roomTypeId === roomType.id);
      const offer = offerFor(roomType.id) ?? null;
      const availableRooms = nightly.length
        ? Math.min(...nightly.map((row) => row.available))
        : 0;
      return {
        ...roomType,
        offer,
        availableRooms,
        available:
          Boolean(offer) &&
          nightly.length === stayDates.length &&
          nightly.every(
            (row) => !row.salesClosed && row.available >= input.rooms,
          ),
      };
    }),
  };
}
