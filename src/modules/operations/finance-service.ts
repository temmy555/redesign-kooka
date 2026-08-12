import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import {
  documentEntryCoverage,
  documentProfiles,
  documentProfileVersions,
  financialDocuments,
  financialDocumentVersions,
  folioEntries,
  folios,
  paymentAllocations,
  payments,
  refundAttempts,
  refunds,
  refundStatusEvents,
  reservations,
} from "../../db/schema";
import { getDatabase } from "../../db";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { encryptSensitiveValue } from "../../platform/encryption";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import { enqueueOutboxEvent } from "../../platform/outbox";
import { stableRequestHash } from "../booking/domain";
import type { StaffSessionLike } from "./contracts";
import { calculateLedgerBalance } from "./contracts";

export async function getFolio(params: {
  propertyId: string;
  folioId: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  const db = getDatabase();
  const [folio] = await db
    .select({
      id: folios.id,
      status: folios.status,
      reservationId: folios.reservationId,
      bookingCode: reservations.bookingCode,
    })
    .from(folios)
    .innerJoin(reservations, eq(reservations.id, folios.reservationId))
    .where(
      and(
        eq(folios.id, params.folioId),
        eq(reservations.propertyId, params.propertyId),
      ),
    )
    .limit(1);
  if (!folio) throw new AppError("NOT_FOUND", "Data tagihan tidak ditemukan");
  const entries = await db
    .select()
    .from(folioEntries)
    .where(eq(folioEntries.folioId, folio.id))
    .orderBy(asc(folioEntries.serviceDate), asc(folioEntries.postedAt));
  const documentRows = await db
    .select({
      documentId: financialDocuments.id,
      documentNumber: financialDocuments.documentNumber,
      documentType: financialDocuments.documentType,
      documentStatus: financialDocuments.status,
      issuedAt: financialDocuments.issuedAt,
      versionId: financialDocumentVersions.id,
      versionNumber: financialDocumentVersions.versionNumber,
      totalIdr: financialDocumentVersions.totalIdr,
      renderedFileId: financialDocumentVersions.renderedFileId,
      outboxStatus: sql<string | null>`(
        select oe.status
        from outbox_events oe
        where oe.topic = 'financial-document.render'
          and oe.aggregate_id = ${financialDocuments.id}
        order by oe.created_at desc
        limit 1
      )`,
    })
    .from(financialDocuments)
    .innerJoin(
      financialDocumentVersions,
      eq(financialDocumentVersions.documentId, financialDocuments.id),
    )
    .where(eq(financialDocuments.folioId, folio.id))
    .orderBy(
      desc(financialDocuments.issuedAt),
      desc(financialDocumentVersions.versionNumber),
    );
  const documents = documentRows
    .filter(
      (document, index, rows) =>
        rows.findIndex((item) => item.documentId === document.documentId) ===
        index,
    )
    .map((document) => ({
      ...document,
      ready: Boolean(document.renderedFileId),
      renderStatus: document.renderedFileId
        ? "READY"
        : document.outboxStatus === "DEAD_LETTER"
          ? "FAILED"
          : "PROCESSING",
    }));
  return {
    ...folio,
    balanceIdr: calculateLedgerBalance(entries),
    entries,
    documents,
  };
}

type FinancialDocumentEntry = {
  entryType: string;
  category: string;
  netAmountIdr: string | number;
  discountAmountIdr: string | number;
  serviceChargeAmountIdr: string | number;
  taxAmountIdr: string | number;
  totalAmountIdr: string | number;
};

export function summarizeFinancialDocumentEntries(
  entries: readonly FinancialDocumentEntry[],
) {
  const isPayment = (entry: FinancialDocumentEntry) =>
    entry.category === "PAYMENT" || entry.category === "PAYMENT_REVERSAL";
  const isRefund = (entry: FinancialDocumentEntry) =>
    entry.category === "REFUND";
  const chargeEntries = entries.filter(
    (entry) => !isPayment(entry) && !isRefund(entry),
  );
  const chargeSign = (entry: FinancialDocumentEntry) =>
    entry.entryType === "DEBIT" ? 1 : -1;

  const subtotalIdr = chargeEntries.reduce(
    (sum, entry) => sum + chargeSign(entry) * Number(entry.netAmountIdr),
    0,
  );
  const discountIdr = chargeEntries.reduce(
    (sum, entry) => sum + chargeSign(entry) * Number(entry.discountAmountIdr),
    0,
  );
  const serviceChargeIdr = chargeEntries.reduce(
    (sum, entry) =>
      sum + chargeSign(entry) * Number(entry.serviceChargeAmountIdr),
    0,
  );
  const taxIdr = chargeEntries.reduce(
    (sum, entry) => sum + chargeSign(entry) * Number(entry.taxAmountIdr),
    0,
  );
  const chargeTotalIdr = chargeEntries.reduce(
    (sum, entry) => sum + chargeSign(entry) * Number(entry.totalAmountIdr),
    0,
  );
  const paymentsIdr = entries.reduce((sum, entry) => {
    if (!isPayment(entry)) return sum;
    return (
      sum +
      (entry.entryType === "CREDIT" ? 1 : -1) * Number(entry.totalAmountIdr)
    );
  }, 0);
  const refundsIdr = entries.reduce((sum, entry) => {
    if (!isRefund(entry)) return sum;
    return (
      sum +
      (entry.entryType === "DEBIT" ? 1 : -1) * Number(entry.totalAmountIdr)
    );
  }, 0);

  return {
    subtotalIdr,
    discountIdr,
    serviceChargeIdr,
    taxIdr,
    chargeTotalIdr,
    paymentsIdr,
    refundsIdr,
    balanceIdr: chargeTotalIdr - paymentsIdr + refundsIdr,
  };
}

export async function getFinancialDocumentRenderStatus(params: {
  propertyId: string;
  documentId: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  const db = getDatabase();
  const [document] = await db
    .select({
      documentId: financialDocuments.id,
      documentNumber: financialDocuments.documentNumber,
      documentType: financialDocuments.documentType,
      documentStatus: financialDocuments.status,
      versionId: financialDocumentVersions.id,
      versionNumber: financialDocumentVersions.versionNumber,
      renderedFileId: financialDocumentVersions.renderedFileId,
      outboxStatus: sql<string | null>`(
        select oe.status
        from outbox_events oe
        where oe.topic = 'financial-document.render'
          and oe.aggregate_id = ${financialDocuments.id}
        order by oe.created_at desc
        limit 1
      )`,
    })
    .from(financialDocuments)
    .innerJoin(
      financialDocumentVersions,
      eq(financialDocumentVersions.documentId, financialDocuments.id),
    )
    .innerJoin(folios, eq(folios.id, financialDocuments.folioId))
    .innerJoin(reservations, eq(reservations.id, folios.reservationId))
    .where(
      and(
        eq(financialDocuments.id, params.documentId),
        eq(financialDocuments.propertyId, params.propertyId),
        eq(reservations.propertyId, params.propertyId),
      ),
    )
    .orderBy(desc(financialDocumentVersions.versionNumber))
    .limit(1);
  if (!document)
    throw new AppError("NOT_FOUND", "Dokumen keuangan tidak ditemukan");
  return {
    ...document,
    ready: Boolean(document.renderedFileId),
    renderStatus: document.renderedFileId
      ? "READY"
      : document.outboxStatus === "DEAD_LETTER"
        ? "FAILED"
        : "PROCESSING",
  };
}

export async function retryFinancialDocumentRender(params: {
  propertyId: string;
  documentId: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  return withIdempotency<{
    documentId: string;
    ready: boolean;
    renderStatus: "READY" | "PROCESSING";
    renderedFileId: string | null;
  }>(
    {
      scope: "operations.financial-document.retry-render",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [document] = await tx
        .select({
          documentId: financialDocuments.id,
          versionId: financialDocumentVersions.id,
          renderedFileId: financialDocumentVersions.renderedFileId,
        })
        .from(financialDocuments)
        .innerJoin(
          financialDocumentVersions,
          eq(financialDocumentVersions.documentId, financialDocuments.id),
        )
        .innerJoin(folios, eq(folios.id, financialDocuments.folioId))
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(financialDocuments.id, params.documentId),
            eq(financialDocuments.propertyId, params.propertyId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .orderBy(desc(financialDocumentVersions.versionNumber))
        .limit(1)
        .for("update", { of: financialDocuments });
      if (!document)
        throw new AppError("NOT_FOUND", "Dokumen keuangan tidak ditemukan");
      if (document.renderedFileId) {
        return {
          resultType: "financial_document",
          resultId: document.documentId,
          response: {
            documentId: document.documentId,
            ready: true,
            renderStatus: "READY",
            renderedFileId: document.renderedFileId,
          },
        };
      }

      await enqueueOutboxEvent(
        {
          topic: "financial-document.render",
          aggregateType: "financial_document",
          aggregateId: document.documentId,
          payload: {
            documentId: document.documentId,
            versionId: document.versionId,
            emailAfterRender: false,
          },
        },
        tx,
      );
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "FINANCIAL_DOCUMENT_RENDER_RETRIED",
          targetType: "financial_document",
          targetId: document.documentId,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "financial_document",
        resultId: document.documentId,
        response: {
          documentId: document.documentId,
          ready: false,
          renderStatus: "PROCESSING",
          renderedFileId: null,
        },
      };
    },
  );
}

export async function postFolioEntry(params: {
  propertyId: string;
  folioId: string;
  billingBucketId?: string;
  entryType: "DEBIT" | "CREDIT";
  category: string;
  description: string;
  sourceType: string;
  sourceId: string;
  reservationRoomId?: string;
  roomUnitId?: string;
  serviceDate: string;
  quantity: number;
  unitAmountIdr: number;
  netAmountIdr: number;
  discountAmountIdr: number;
  serviceChargeAmountIdr: number;
  taxAmountIdr: number;
  totalAmountIdr: number;
  taxProfileVersionId?: string;
  reason: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  for (const value of [
    params.quantity,
    params.unitAmountIdr,
    params.netAmountIdr,
    params.discountAmountIdr,
    params.serviceChargeAmountIdr,
    params.taxAmountIdr,
    params.totalAmountIdr,
  ]) {
    if (!Number.isFinite(value) || value < 0)
      throw new AppError(
        "VALIDATION_ERROR",
        "Nominal tagihan tidak boleh bernilai negatif",
      );
  }
  if (params.quantity <= 0)
    throw new AppError("VALIDATION_ERROR", "Quantity must be positive");
  const expected =
    params.netAmountIdr -
    params.discountAmountIdr +
    params.serviceChargeAmountIdr +
    params.taxAmountIdr;
  if (expected !== params.totalAmountIdr)
    throw new AppError(
      "VALIDATION_ERROR",
      "Total tagihan tidak sesuai dengan rincian harganya",
    );
  return withIdempotency(
    {
      scope: "operations.folio.post",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [folio] = await tx
        .select({ id: folios.id, status: folios.status })
        .from(folios)
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(folios.id, params.folioId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!folio)
        throw new AppError("NOT_FOUND", "Data tagihan tidak ditemukan");
      if (folio.status !== "OPEN")
        throw new AppError("CONFLICT", "Tagihan sudah ditutup");
      const [entry] = await tx
        .insert(folioEntries)
        .values({
          folioId: params.folioId,
          billingBucketId: params.billingBucketId,
          entryType: params.entryType,
          category: params.category,
          description: params.description,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          reservationRoomId: params.reservationRoomId,
          roomUnitId: params.roomUnitId,
          serviceDate: params.serviceDate,
          quantity: String(params.quantity),
          unitAmountIdr: String(params.unitAmountIdr),
          netAmountIdr: String(params.netAmountIdr),
          discountAmountIdr: String(params.discountAmountIdr),
          serviceChargeAmountIdr: String(params.serviceChargeAmountIdr),
          taxAmountIdr: String(params.taxAmountIdr),
          totalAmountIdr: String(params.totalAmountIdr),
          taxProfileVersionId: params.taxProfileVersionId,
          pricingSnapshot: {
            enteredByFrontOffice: true,
            reason: params.reason,
            componentsValidated: true,
          },
          postedByUserId: params.session.user.id,
          idempotencyKey: params.idempotencyKey,
          createdByUserId: params.session.user.id,
        })
        .returning({ id: folioEntries.id });
      if (!entry) throw new Error("Failed to post folio entry");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "FOLIO_ENTRY_POSTED",
          targetType: "folio_entry",
          targetId: entry.id,
          after: {
            folioId: params.folioId,
            entryType: params.entryType,
            category: params.category,
            totalAmountIdr: params.totalAmountIdr,
            taxAmountIdr: params.taxAmountIdr,
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "folio_entry",
        resultId: entry.id,
        response: { folioEntryId: entry.id, status: "POSTED" },
      };
    },
  );
}

export async function reverseFolioEntry(params: {
  propertyId: string;
  folioEntryId: string;
  reason: string;
  serviceDate: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  return withIdempotency(
    {
      scope: "operations.folio.reverse",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [original] = await tx
        .select()
        .from(folioEntries)
        .innerJoin(folios, eq(folios.id, folioEntries.folioId))
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(folioEntries.id, params.folioEntryId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!original)
        throw new AppError("NOT_FOUND", "Rincian tagihan tidak ditemukan");
      const source = original.folio_entries;
      if (source.reversalOfEntryId)
        throw new AppError(
          "CONFLICT",
          "A reversal cannot itself be reversed through this action",
        );
      const [reversal] = await tx
        .insert(folioEntries)
        .values({
          folioId: source.folioId,
          billingBucketId: source.billingBucketId,
          entryType: source.entryType === "DEBIT" ? "CREDIT" : "DEBIT",
          category: "REVERSAL",
          description: `Reversal: ${source.description}`,
          sourceType: "FOLIO_REVERSAL",
          sourceId: source.id,
          sourceLineId: source.sourceLineId,
          reservationRoomId: source.reservationRoomId,
          roomUnitId: source.roomUnitId,
          guestId: source.guestId,
          serviceDate: params.serviceDate,
          quantity: source.quantity,
          unitAmountIdr: source.unitAmountIdr,
          netAmountIdr: source.netAmountIdr,
          discountAmountIdr: source.discountAmountIdr,
          serviceChargeAmountIdr: source.serviceChargeAmountIdr,
          taxAmountIdr: source.taxAmountIdr,
          totalAmountIdr: source.totalAmountIdr,
          taxProfileVersionId: source.taxProfileVersionId,
          pricingSnapshot: {
            reversalReason: params.reason,
            originalPricingSnapshot: source.pricingSnapshot,
          },
          reversalOfEntryId: source.id,
          postedByUserId: params.session.user.id,
          idempotencyKey: params.idempotencyKey,
          createdByUserId: params.session.user.id,
        })
        .returning({ id: folioEntries.id });
      if (!reversal) throw new Error("Failed to reverse folio entry");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "FOLIO_ENTRY_REVERSED",
          targetType: "folio_entry",
          targetId: reversal.id,
          before: { originalEntryId: source.id },
          after: { reversalEntryId: reversal.id },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "folio_entry",
        resultId: reversal.id,
        response: { reversalEntryId: reversal.id, originalEntryId: source.id },
      };
    },
  );
}

export async function issueFinancialDocument(params: {
  propertyId: string;
  folioId: string;
  documentType:
    "PROFORMA" | "INVOICE" | "RECEIPT" | "REFUND_NOTE" | "FOLIO_STATEMENT";
  scope: "COMBINED" | "ROOM_ONLY" | "CUSTOM";
  folioEntryIds?: string[];
  recipientName: string;
  recipientEmail?: string;
  language: "id" | "en";
  supersedeReason?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  return withIdempotency(
    {
      scope: "operations.document.issue",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const now = new Date();
      const [folio] = await tx
        .select({
          id: folios.id,
          reservationId: folios.reservationId,
          bookingCode: reservations.bookingCode,
        })
        .from(folios)
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(folios.id, params.folioId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!folio)
        throw new AppError("NOT_FOUND", "Data tagihan tidak ditemukan");
      const [profile] = await tx
        .select({ id: documentProfileVersions.id })
        .from(documentProfileVersions)
        .innerJoin(
          documentProfiles,
          eq(documentProfiles.id, documentProfileVersions.documentProfileId),
        )
        .where(
          and(
            eq(documentProfiles.propertyId, params.propertyId),
            inArray(documentProfileVersions.lifecycleStatus, [
              "ACTIVE",
              "SCHEDULED",
            ]),
            sql`${documentProfileVersions.effectiveFrom} <= ${now}`,
            or(
              isNull(documentProfileVersions.effectiveTo),
              sql`${documentProfileVersions.effectiveTo} > ${now}`,
            ),
          ),
        )
        .orderBy(sql`${documentProfileVersions.effectiveFrom} desc`)
        .limit(1);
      if (!profile)
        throw new AppError(
          "CONFLICT",
          "Profil invoice dan kuitansi belum aktif. Lengkapi melalui Pengaturan → Harga & pembayaran → Profil invoice & kuitansi.",
        );
      const filters = [eq(folioEntries.folioId, params.folioId)];
      if (params.scope === "ROOM_ONLY")
        filters.push(
          or(
            eq(folioEntries.category, "ROOM"),
            eq(folioEntries.category, "ROOM_CHARGE"),
          )!,
        );
      if (params.scope === "CUSTOM") {
        if (!params.folioEntryIds?.length)
          throw new AppError(
            "VALIDATION_ERROR",
            "Cakupan dokumen khusus memerlukan rincian tagihan",
          );
        filters.push(inArray(folioEntries.id, params.folioEntryIds));
      }
      const entries = await tx
        .select()
        .from(folioEntries)
        .where(and(...filters))
        .orderBy(asc(folioEntries.serviceDate), asc(folioEntries.postedAt));
      if (!entries.length)
        throw new AppError(
          "CONFLICT",
          "Tidak ada rincian tagihan untuk cakupan dokumen ini",
        );
      let supersededDocumentIds: string[] = [];
      if (params.documentType === "INVOICE") {
        const covered = await tx
          .select({
            entryId: documentEntryCoverage.folioEntryId,
            documentId: financialDocuments.id,
          })
          .from(documentEntryCoverage)
          .innerJoin(
            financialDocumentVersions,
            eq(
              financialDocumentVersions.id,
              documentEntryCoverage.documentVersionId,
            ),
          )
          .innerJoin(
            financialDocuments,
            eq(financialDocuments.id, financialDocumentVersions.documentId),
          )
          .where(
            and(
              inArray(
                documentEntryCoverage.folioEntryId,
                entries.map((entry) => entry.id),
              ),
              eq(documentEntryCoverage.activeFinalCoverage, "YES"),
              eq(financialDocuments.folioId, params.folioId),
              eq(financialDocuments.status, "ISSUED"),
            ),
          );
        supersededDocumentIds = [
          ...new Set(
            covered
              .map((row) => row.documentId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        if (supersededDocumentIds.length) {
          await tx.execute(sql`
            update document_entry_coverage
            set active_final_coverage = 'NO'
            where active_final_coverage = 'YES'
              and document_version_id in (
                select id
                from financial_document_versions
                where document_id in (${sql.join(
                  supersededDocumentIds.map((id) => sql`${id}`),
                  sql`, `,
                )})
              )
          `);
        }
      }
      const periodKey = now.toISOString().slice(0, 7).replace("-", "");
      const sequence = await tx.execute<{
        prefix: string;
        issuedValue: number;
        padding: number;
      }>(sql`
      insert into document_sequences (property_id, document_type, period_key, prefix, next_value, padding)
      values (${params.propertyId}, ${params.documentType}, ${periodKey}, ${params.documentType}, 2, 5)
      on conflict (property_id, document_type, period_key)
      do update set next_value = document_sequences.next_value + 1, updated_at = now(), version = document_sequences.version + 1
      returning prefix, next_value - 1 as "issuedValue", padding
    `);
      const seq = sequence.rows[0];
      if (!seq) throw new Error("Failed to allocate document number");
      const documentNumber = `${seq.prefix}/${periodKey}/${String(seq.issuedValue).padStart(seq.padding, "0")}`;
      const summary = summarizeFinancialDocumentEntries(entries);
      const {
        subtotalIdr,
        discountIdr,
        serviceChargeIdr,
        taxIdr,
        chargeTotalIdr,
        paymentsIdr,
        refundsIdr,
        balanceIdr,
      } = summary;
      if (
        [
          subtotalIdr,
          discountIdr,
          serviceChargeIdr,
          taxIdr,
          chargeTotalIdr,
        ].some((amount) => amount < -0.005)
      )
        throw new AppError(
          "CONFLICT",
          "Ringkasan tagihan tidak valid karena total biaya menjadi negatif",
        );
      const totalIdr =
        params.documentType === "RECEIPT"
          ? paymentsIdr > 0
            ? paymentsIdr
            : Math.max(0, balanceIdr)
          : params.documentType === "REFUND_NOTE"
            ? refundsIdr > 0
              ? refundsIdr
              : Math.max(0, balanceIdr)
            : params.documentType === "FOLIO_STATEMENT"
              ? balanceIdr
              : chargeTotalIdr;
      const [document] = await tx
        .insert(financialDocuments)
        .values({
          propertyId: params.propertyId,
          folioId: params.folioId,
          documentType: params.documentType,
          documentNumber,
          status: "ISSUED",
          recipientName: params.recipientName,
          recipientEmail: params.recipientEmail,
          language: params.language,
          issuedAt: now,
          issuedByUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: financialDocuments.id });
      if (!document) throw new Error("Failed to issue financial document");
      const snapshot = {
        documentNumber,
        documentType: params.documentType,
        scope: params.scope,
        bookingCode: folio.bookingCode,
        reservationId: folio.reservationId,
        currency: "IDR",
        recipientName: params.recipientName,
        recipientEmail: params.recipientEmail ?? null,
        language: params.language,
        issuedAt: now.toISOString(),
        subtotalIdr,
        discountIdr,
        serviceChargeIdr,
        taxIdr,
        chargeTotalIdr,
        paymentsIdr,
        refundsIdr,
        balanceIdr,
        totalIdr,
        entries: entries.map((entry) => ({
          id: entry.id,
          date: entry.serviceDate,
          description: entry.description,
          category: entry.category,
          entryType: entry.entryType,
          quantity: Number(entry.quantity),
          unitAmountIdr: Number(entry.unitAmountIdr),
          roomUnitId: entry.roomUnitId,
          netAmountIdr: Number(entry.netAmountIdr),
          discountAmountIdr: Number(entry.discountAmountIdr),
          serviceChargeAmountIdr: Number(entry.serviceChargeAmountIdr),
          taxAmountIdr: Number(entry.taxAmountIdr),
          totalAmountIdr: Number(entry.totalAmountIdr),
        })),
      };
      const [version] = await tx
        .insert(financialDocumentVersions)
        .values({
          documentId: document.id,
          versionNumber: 1,
          documentProfileVersionId: profile.id,
          subtotalIdr: String(subtotalIdr),
          discountIdr: String(discountIdr),
          serviceChargeIdr: String(serviceChargeIdr),
          taxIdr: String(taxIdr),
          totalIdr: String(totalIdr),
          renderedSnapshot: snapshot,
          createdByUserId: params.session.user.id,
        })
        .returning({ id: financialDocumentVersions.id });
      if (!version) throw new Error("Failed to snapshot financial document");
      await tx.insert(documentEntryCoverage).values(
        entries.map((entry) => ({
          documentVersionId: version.id,
          folioEntryId: entry.id,
          coveredAmountIdr: entry.totalAmountIdr,
          activeFinalCoverage: params.documentType === "INVOICE" ? "YES" : "NO",
          createdByUserId: params.session.user.id,
        })),
      );
      if (supersededDocumentIds.length) {
        await tx
          .update(financialDocuments)
          .set({
            status: "SUPERSEDED",
            updatedAt: now,
            updatedByUserId: params.session.user.id,
            version: sql`${financialDocuments.version} + 1`,
          })
          .where(inArray(financialDocuments.id, supersededDocumentIds));
        for (const supersededDocumentId of supersededDocumentIds) {
          await recordAuditEvent(
            {
              propertyId: params.propertyId,
              actorUserId: params.session.user.id,
              actorType: "user",
              action: "FINANCIAL_DOCUMENT_SUPERSEDED",
              targetType: "financial_document",
              targetId: supersededDocumentId,
              before: { status: "ISSUED" },
              after: {
                status: "SUPERSEDED",
                replacementDocumentId: document.id,
                replacementDocumentNumber: documentNumber,
              },
              reason:
                params.supersedeReason ??
                "Invoice baru diterbitkan setelah perubahan tagihan",
              result: "SUCCESS",
            },
            tx,
          );
        }
      }
      await enqueueOutboxEvent(
        {
          topic: "financial-document.render",
          aggregateType: "financial_document",
          aggregateId: document.id,
          payload: {
            documentId: document.id,
            versionId: version.id,
            emailAfterRender:
              params.documentType === "INVOICE" &&
              Boolean(params.recipientEmail),
          },
        },
        tx,
      );
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "FINANCIAL_DOCUMENT_ISSUED",
          targetType: "financial_document",
          targetId: document.id,
          after: {
            documentNumber,
            documentType: params.documentType,
            scope: params.scope,
            totalIdr,
            taxIdr,
          },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "financial_document",
        resultId: document.id,
        response: {
          documentId: document.id,
          versionId: version.id,
          documentNumber,
          status: "ISSUED",
          renderStatus: "QUEUED",
          totalIdr,
          supersededDocumentIds,
        },
      };
    },
  );
}

export async function allocatePayment(params: {
  propertyId: string;
  paymentId: string;
  documentId: string;
  amountIdr: number;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  return withIdempotency(
    {
      scope: "operations.payment.allocate",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [payment] = await tx
        .select({
          id: payments.id,
          amountIdr: payments.amountIdr,
          status: payments.status,
          folioId: payments.folioId,
        })
        .from(payments)
        .innerJoin(folios, eq(folios.id, payments.folioId))
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(payments.id, params.paymentId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!payment || payment.status !== "VERIFIED")
        throw new AppError(
          "CONFLICT",
          "Only a verified payment can be allocated",
        );
      const [document] = await tx
        .select({
          id: financialDocuments.id,
          folioId: financialDocuments.folioId,
          status: financialDocuments.status,
        })
        .from(financialDocuments)
        .where(eq(financialDocuments.id, params.documentId))
        .limit(1);
      if (
        !document ||
        document.folioId !== payment.folioId ||
        document.status !== "ISSUED"
      )
        throw new AppError(
          "CONFLICT",
          "Dokumen dan pembayaran harus berasal dari tagihan aktif yang sama",
        );
      const prior = await tx
        .select({
          amountIdr: paymentAllocations.amountIdr,
          reversalId: paymentAllocations.reversalOfAllocationId,
        })
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, payment.id));
      const allocated = prior.reduce(
        (sum, row) => sum + (row.reversalId ? -1 : 1) * Number(row.amountIdr),
        0,
      );
      if (
        params.amountIdr <= 0 ||
        allocated + params.amountIdr > Number(payment.amountIdr)
      )
        throw new AppError(
          "CONFLICT",
          "Allocation exceeds the unallocated payment amount",
        );
      const [allocation] = await tx
        .insert(paymentAllocations)
        .values({
          paymentId: payment.id,
          documentId: document.id,
          amountIdr: String(params.amountIdr),
          allocatedByUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
        })
        .returning({ id: paymentAllocations.id });
      if (!allocation) throw new Error("Failed to allocate payment");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "PAYMENT_ALLOCATED",
          targetType: "payment_allocation",
          targetId: allocation.id,
          after: {
            paymentId: payment.id,
            documentId: document.id,
            amountIdr: params.amountIdr,
          },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "payment_allocation",
        resultId: allocation.id,
        response: {
          paymentAllocationId: allocation.id,
          allocatedAmountIdr: params.amountIdr,
        },
      };
    },
  );
}

export async function requestManualRefund(params: {
  propertyId: string;
  folioId: string;
  amountIdr: number;
  reason: string;
  destination: string;
  policySnapshot?: Record<string, unknown>;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  if (params.amountIdr <= 0)
    throw new AppError("VALIDATION_ERROR", "Refund amount must be positive");
  return withIdempotency(
    {
      scope: "operations.refund.request",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({ ...params, destination: "[redacted]" }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [folio] = await tx
        .select({ id: folios.id })
        .from(folios)
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(folios.id, params.folioId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!folio)
        throw new AppError("NOT_FOUND", "Data tagihan tidak ditemukan");
      const codeResult = await tx.execute<{ code: string }>(
        sql`select concat('RF-', to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD'), '-', upper(substr(replace(uuidv7()::text, '-', ''), 1, 10))) as code`,
      );
      const refundCode = codeResult.rows[0]?.code;
      if (!refundCode) throw new Error("Failed to generate refund code");
      const [refund] = await tx
        .insert(refunds)
        .values({
          folioId: params.folioId,
          refundCode,
          amountIdr: String(params.amountIdr),
          status: "APPROVED",
          reason: params.reason,
          policySnapshot: params.policySnapshot,
          destinationCiphertext: encryptSensitiveValue(params.destination),
          destinationLast4: params.destination.slice(-4),
          approvedAt: new Date(),
          approvedByUserId: params.session.user.id,
          idempotencyKey: params.idempotencyKey,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: refunds.id });
      if (!refund) throw new Error("Failed to create refund");
      await tx.insert(refundStatusEvents).values([
        {
          refundId: refund.id,
          action: "REQUEST",
          fromStatus: null,
          toStatus: "REQUESTED",
          reason: params.reason,
          actorUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
        },
        {
          refundId: refund.id,
          action: "FRONT_OFFICE_APPROVE",
          fromStatus: "REQUESTED",
          toStatus: "APPROVED",
          reason: "Phase 1 manual refund; no separate owner approval required",
          actorUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
        },
      ]);
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "MANUAL_REFUND_APPROVED",
          targetType: "refund",
          targetId: refund.id,
          after: {
            refundCode,
            amountIdr: params.amountIdr,
            destinationLast4: params.destination.slice(-4),
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "refund",
        resultId: refund.id,
        response: { refundId: refund.id, refundCode, status: "APPROVED" },
      };
    },
  );
}

export async function completeManualRefund(params: {
  propertyId: string;
  refundId: string;
  result: "REFUNDED" | "FAILED";
  transferReference?: string;
  proofFileId?: string;
  failureReason?: string;
  serviceDate: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  return withIdempotency(
    {
      scope: "operations.refund.complete",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [refund] = await tx
        .select({
          id: refunds.id,
          status: refunds.status,
          amountIdr: refunds.amountIdr,
          folioId: refunds.folioId,
          refundCode: refunds.refundCode,
        })
        .from(refunds)
        .innerJoin(folios, eq(folios.id, refunds.folioId))
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(refunds.id, params.refundId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (
        !refund ||
        !["APPROVED", "PROCESSING", "FAILED"].includes(refund.status)
      )
        throw new AppError(
          "CONFLICT",
          "Refund is not ready for a manual attempt",
        );
      if (
        params.result === "REFUNDED" &&
        (!params.transferReference || !params.proofFileId)
      )
        throw new AppError(
          "VALIDATION_ERROR",
          "Completed transfer requires a reference and proof file",
        );
      const attempts = await tx
        .select({ id: refundAttempts.id })
        .from(refundAttempts)
        .where(eq(refundAttempts.refundId, refund.id));
      const [attempt] = await tx
        .insert(refundAttempts)
        .values({
          refundId: refund.id,
          attemptNumber: attempts.length + 1,
          processorUserId: params.session.user.id,
          startedAt: new Date(),
          completedAt: new Date(),
          result: params.result === "REFUNDED" ? "SUCCESS" : "FAILED",
          transferReference: params.transferReference,
          proofFileId: params.proofFileId,
          failureReason: params.failureReason,
          createdByUserId: params.session.user.id,
        })
        .returning({ id: refundAttempts.id });
      if (!attempt) throw new Error("Failed to record refund attempt");
      let folioEntryId: string | null = null;
      if (params.result === "REFUNDED") {
        const [entry] = await tx
          .insert(folioEntries)
          .values({
            folioId: refund.folioId,
            entryType: "DEBIT",
            category: "REFUND",
            description: `Manual refund ${refund.refundCode}`,
            sourceType: "REFUND",
            sourceId: refund.id,
            serviceDate: params.serviceDate,
            quantity: "1",
            unitAmountIdr: refund.amountIdr,
            netAmountIdr: refund.amountIdr,
            totalAmountIdr: refund.amountIdr,
            pricingSnapshot: {
              transferReference: params.transferReference,
              proofFileId: params.proofFileId,
            },
            postedByUserId: params.session.user.id,
            idempotencyKey: `${params.idempotencyKey}:folio`,
            createdByUserId: params.session.user.id,
          })
          .returning({ id: folioEntries.id });
        folioEntryId = entry?.id ?? null;
      }
      await tx
        .update(refunds)
        .set({
          status: params.result,
          refundedAt: params.result === "REFUNDED" ? new Date() : null,
          folioEntryId,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(refunds.id, refund.id));
      await tx.insert(refundStatusEvents).values({
        refundId: refund.id,
        action: "COMPLETE_ATTEMPT",
        fromStatus: refund.status,
        toStatus: params.result,
        reason:
          params.result === "FAILED"
            ? params.failureReason
            : "Manual bank transfer completed",
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: `MANUAL_REFUND_${params.result}`,
          targetType: "refund",
          targetId: refund.id,
          after: {
            status: params.result,
            attemptId: attempt.id,
            folioEntryId,
            hasProof: Boolean(params.proofFileId),
          },
          reason: params.failureReason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "refund",
        resultId: refund.id,
        response: {
          refundId: refund.id,
          status: params.result,
          attemptId: attempt.id,
          folioEntryId,
        },
      };
    },
  );
}
