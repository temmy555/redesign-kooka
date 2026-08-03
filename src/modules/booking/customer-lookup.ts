import "server-only";

import { and, desc, eq, gt, sql } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  bookingLookupSessions,
  folioEntries,
  folios,
  paymentInstructionVersions,
  payments,
  reservations,
  reservationRooms,
  roomTypes,
  roomTypeVersions,
  securityEvents,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { decryptSensitiveValue } from "../../platform/encryption";
import { AppError } from "../../platform/errors";
import { generateLookupToken, hashOpaque, normalizeEmail } from "./domain";

const LOOKUP_SESSION_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const GENERIC_LOOKUP_ERROR = "Booking details could not be verified";

function normalizeBookingCode(code: string) {
  return code.trim().toUpperCase();
}

export async function createCustomerLookupSession(params: {
  propertyId: string;
  bookingCode: string;
  email?: string;
  ipAddress?: string | null;
}) {
  const db = getDatabase();
  const now = new Date();
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const ipHash = hashOpaque(params.ipAddress ?? "unknown");
  const recent = await db.execute<{ count: string }>(sql`
    select count(*)::text as count
    from security_events
    where category = 'BOOKING_LOOKUP'
      and created_at > ${since}
      and details->>'ipHash' = ${ipHash}
  `);
  if (Number(recent.rows[0]?.count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many lookup attempts; try again later",
    );
  }
  const bookingCode = normalizeBookingCode(params.bookingCode);
  const email = params.email ? normalizeEmail(params.email) : null;
  const [reservation] = await db
    .select({
      id: reservations.id,
      bookingCode: reservations.bookingCode,
      bookerEmailNormalized: reservations.bookerEmailNormalized,
    })
    .from(reservations)
    .where(
      email
        ? and(
            eq(reservations.propertyId, params.propertyId),
            eq(reservations.bookingCode, bookingCode),
            eq(reservations.bookerEmailNormalized, email),
          )
        : and(
            eq(reservations.propertyId, params.propertyId),
            eq(reservations.bookingCode, bookingCode),
          ),
    )
    .limit(1);
  if (!reservation) {
    await db.insert(securityEvents).values({
      propertyId: params.propertyId,
      category: "BOOKING_LOOKUP",
      severity: "LOW",
      result: "FAILURE",
      targetType: "reservation",
      details: {
        ipHash,
        bookingCodeHash: hashOpaque(bookingCode),
        ...(email ? { emailHash: hashOpaque(email) } : {}),
        lookupMode: email ? "BOOKING_CODE_AND_EMAIL" : "BOOKING_CODE_ONLY",
      },
    });
    throw new AppError("UNAUTHORIZED", GENERIC_LOOKUP_ERROR);
  }
  const token = generateLookupToken();
  const expiresAt = new Date(now.getTime() + LOOKUP_SESSION_MS);
  await db.transaction(async (tx) => {
    await tx.insert(bookingLookupSessions).values({
      reservationId: reservation.id,
      tokenHash: hashOpaque(token),
      matchedEmailHash: hashOpaque(email ?? "BOOKING_CODE_ONLY"),
      expiresAt,
      ipAddress: params.ipAddress ?? null,
    });
    await tx.insert(securityEvents).values({
      propertyId: params.propertyId,
      category: "BOOKING_LOOKUP",
      severity: "LOW",
      result: "SUCCESS",
      targetType: "reservation",
      targetId: reservation.id,
      details: { ipHash },
    });
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorType: "customer",
        action: "booking.customer_lookup.authenticate",
        targetType: "reservation",
        targetId: reservation.id,
        after: { sessionExpiresAt: expiresAt.toISOString() },
        reason: email
          ? "Booking code and email matched"
          : "Booking code matched",
        result: "SUCCESS",
        ipAddress: params.ipAddress ?? null,
      },
      tx,
    );
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function getCustomerBooking(params: {
  propertyId: string;
  token: string;
}) {
  const now = new Date();
  const db = getDatabase();
  const [session] = await db
    .select({ reservationId: bookingLookupSessions.reservationId })
    .from(bookingLookupSessions)
    .where(
      and(
        eq(bookingLookupSessions.tokenHash, hashOpaque(params.token)),
        gt(bookingLookupSessions.expiresAt, now),
        sql`${bookingLookupSessions.revokedAt} is null`,
      ),
    )
    .limit(1);
  if (!session) throw new AppError("UNAUTHORIZED", GENERIC_LOOKUP_ERROR);
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.id, session.reservationId),
        eq(reservations.propertyId, params.propertyId),
      ),
    )
    .limit(1);
  if (!reservation) throw new AppError("UNAUTHORIZED", GENERIC_LOOKUP_ERROR);
  const [rooms, folio, instruction] = await Promise.all([
    db
      .select({
        lineNumber: reservationRooms.lineNumber,
        roomTypeId: reservationRooms.bookedRoomTypeId,
        roomTypeCode: roomTypes.code,
        roomTypeNameId: roomTypeVersions.nameId,
        roomTypeNameEn: roomTypeVersions.nameEn,
        checkInDate: reservationRooms.checkInDate,
        checkoutDate: reservationRooms.checkoutDate,
        adults: reservationRooms.adults,
        children: reservationRooms.children,
        infants: reservationRooms.infants,
        extraBedQuantity: reservationRooms.extraBedQuantity,
        status: reservationRooms.lineStatus,
      })
      .from(reservationRooms)
      .innerJoin(roomTypes, eq(roomTypes.id, reservationRooms.bookedRoomTypeId))
      .leftJoin(
        roomTypeVersions,
        and(
          eq(roomTypeVersions.roomTypeId, reservationRooms.bookedRoomTypeId),
          eq(roomTypeVersions.lifecycleStatus, "ACTIVE"),
          sql`${roomTypeVersions.effectiveFrom} <= ${now}`,
          sql`(${roomTypeVersions.effectiveTo} is null or ${roomTypeVersions.effectiveTo} > ${now})`,
        ),
      )
      .where(eq(reservationRooms.reservationId, reservation.id))
      .orderBy(reservationRooms.lineNumber),
    db
      .select({ id: folios.id })
      .from(folios)
      .where(eq(folios.reservationId, reservation.id))
      .limit(1),
    reservation.paymentInstructionVersionId
      ? db
          .select()
          .from(paymentInstructionVersions)
          .where(
            eq(
              paymentInstructionVersions.id,
              reservation.paymentInstructionVersionId,
            ),
          )
          .limit(1)
      : Promise.resolve([]),
  ]);
  const folioId = folio[0]?.id;
  const [entries, paymentRows] = folioId
    ? await Promise.all([
        db
          .select({
            entryType: folioEntries.entryType,
            totalAmountIdr: folioEntries.totalAmountIdr,
          })
          .from(folioEntries)
          .where(eq(folioEntries.folioId, folioId)),
        db
          .select({
            status: payments.status,
            amountIdr: payments.amountIdr,
            receivedAt: payments.receivedAt,
          })
          .from(payments)
          .where(eq(payments.folioId, folioId))
          .orderBy(desc(payments.createdAt)),
      ])
    : [[], []];
  const balanceIdr = entries.reduce(
    (total, entry) =>
      total +
      (entry.entryType === "DEBIT" ? 1 : -1) * Number(entry.totalAmountIdr),
    0,
  );
  const activeInstruction = instruction[0];
  const whatsappNumber = (
    process.env.WHATSAPP_CONTACT_NUMBER ?? "6283831455142"
  ).replace(/\D/g, "");
  const whatsappText = encodeURIComponent(
    `Halo KOOKA, saya ingin mengonfirmasi booking ${reservation.bookingCode}. Total resmi IDR ${Number(reservation.requiredPaymentIdr).toLocaleString("id-ID")}.`,
  );
  return {
    bookingCode: reservation.bookingCode,
    bookerName: reservation.bookerName,
    reservationStatus: reservation.status,
    source: reservation.source,
    language: reservation.language,
    officialCurrency: "IDR",
    displayCurrency: reservation.displayCurrency,
    paymentMode: reservation.paymentMode,
    requiredPaymentIdr: Number(reservation.requiredPaymentIdr),
    balanceIdr,
    paymentDeadlineAt: reservation.paymentDeadlineAt?.toISOString() ?? null,
    guaranteed: reservation.guaranteed,
    rooms: rooms.map(
      ({ roomTypeCode, roomTypeNameId, roomTypeNameEn, ...room }) => ({
        ...room,
        roomTypeName:
          (reservation.language === "en" ? roomTypeNameEn : roomTypeNameId) ??
          roomTypeCode,
      }),
    ),
    payments: paymentRows.map((payment) => ({
      ...payment,
      amountIdr: Number(payment.amountIdr),
      receivedAt: payment.receivedAt?.toISOString() ?? null,
    })),
    paymentInstruction: activeInstruction
      ? {
          bankName: activeInstruction.bankName,
          accountHolder: activeInstruction.accountHolder,
          accountNumber: decryptSensitiveValue(
            activeInstruction.accountNumberCiphertext,
          ),
          accountNumberLast4: activeInstruction.accountNumberLast4,
          instruction:
            reservation.language === "en"
              ? activeInstruction.instructionEn
              : activeInstruction.instructionId,
        }
      : null,
    whatsappUrl: whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${whatsappText}`
      : null,
    selfServiceChangesAllowed: false,
  };
}
