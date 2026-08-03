"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActionDialog,
  DateField,
  FileField,
  KookaSelect,
  MoneyInput,
  ReasonDialog,
  nextDate,
} from "./FormControls";
import SignaturePad from "./SignaturePad";
import StaffNotice from "./StaffNotice";
import PaginationControls from "./PaginationControls";
import type { PaginationMeta } from "../../../src/platform/pagination";
import styles from "../staff.module.css";

type RoomLine = {
  reservationRoomId: string;
  roomStayId: string | null;
  roomUnitId: string | null;
  roomNumber: string | null;
  roomTypeId: string;
  checkInDate: string;
  checkoutDate: string;
  adults: number;
  children: number;
  extraBedQuantity: number;
  lineStatus: string;
  stayStatus: string | null;
  registrationStatus: string | null;
  registrationItems: Array<{
    captureType: string;
    outcome: string;
    capturedAt: string | null;
  }>;
  identityType: string | null;
  identityNumberLast4: string | null;
};

type Booking = {
  id: string;
  bookingCode: string;
  bookerName: string;
  bookerEmail: string;
  source: string;
  status: string;
  paymentMode: string;
  requiredPaymentIdr: string;
  paymentDeadlineAt: string | null;
  folioId: string | null;
  rooms: RoomLine[];
};

type Payment = {
  id: string;
  paymentCode: string;
  bookingCode: string;
  bookerName: string;
  amountIdr: string;
  method: string;
  status: string;
  receivedAt: string | null;
  reference: string | null;
  folioId: string;
};

type FolioDocument = {
  documentId: string;
  documentNumber: string | null;
  documentType: string;
  documentStatus: string;
  issuedAt: string | null;
  versionId: string;
  versionNumber: number;
  totalIdr: string;
  renderedFileId: string | null;
  ready: boolean;
  renderStatus: "READY" | "PROCESSING" | "FAILED";
};

type RoomMaster = {
  roomTypes: Array<{
    roomTypeId: string;
    code: string;
    nameId: string | null;
    lifecycleStatus: string | null;
    maximumAdults?: number;
    maximumChildren?: number;
    maximumTotalGuests?: number;
    extraBedAllowed?: boolean;
    maximumExtraBeds?: number;
  }>;
  roomUnits: Array<{
    id: string;
    roomNumber: string;
    roomTypeId: string | null;
    status: string;
    occupancyStatus?: string | null;
    housekeepingStatus?: string | null;
    serviceabilityStatus?: string | null;
    unavailableDates?: string[];
  }>;
};

export function assignableRooms(
  roomMaster: RoomMaster,
  bookedRoomTypeId: string | undefined,
  checkInDate?: string,
  checkoutDate?: string,
) {
  if (!bookedRoomTypeId) return [];
  const stayDates = new Set<string>();
  if (checkInDate && checkoutDate) {
    let cursor = checkInDate;
    while (cursor < checkoutDate) {
      stayDates.add(cursor);
      cursor = nextDate(cursor);
    }
  }
  return roomMaster.roomUnits.filter(
    (room) =>
      room.status === "ACTIVE" &&
      room.roomTypeId === bookedRoomTypeId &&
      room.serviceabilityStatus !== "OUT_OF_ORDER" &&
      room.serviceabilityStatus !== "BLOCKED" &&
      !(room.unavailableDates ?? []).some((date) => stayDates.has(date)),
  );
}

type Commercial = {
  ratePlans: Array<{
    ratePlanId: string;
    code: string;
    nameId: string | null;
    lifecycleStatus: string | null;
    sourceEligibility?: string;
  }>;
};

type QuoteRoom = {
  roomTypeId: string;
  adults: number;
  children: number;
  infants: number;
  extraBedQuantity: number;
};

type Notice = { tone: "success" | "error"; message: string } | null;

function idempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function errorMessage(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    value.error &&
    typeof value.error === "object" &&
    "message" in value.error
  )
    return String(value.error.message);
  return "Permintaan belum dapat diproses. Periksa data dan coba lagi.";
}

async function mutate(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey(String(body.action ?? "operation")),
    },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(errorMessage(result));
  return result as Record<string, unknown>;
}

function formatIdr(value: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function folioBookingDescription(booking: {
  requiredPaymentIdr: string | number;
  rooms: Array<{ roomNumber?: string | null }>;
}) {
  const roomNumbers = Array.from(
    new Set(
      booking.rooms
        .map((room) => room.roomNumber?.trim())
        .filter((roomNumber): roomNumber is string => Boolean(roomNumber)),
    ),
  ).sort((left, right) =>
    left.localeCompare(right, "id-ID", { numeric: true }),
  );
  const allocation = roomNumbers.length
    ? `Kamar ${roomNumbers.join(", ")}`
    : "Belum dialokasikan";
  return `${formatIdr(booking.requiredPaymentIdr)} · ${allocation}`;
}

export function human(
  value: string | null | undefined,
  fallback = "belum tersedia",
) {
  return value
    ? value.replaceAll("_", " ").toLocaleLowerCase("id-ID")
    : fallback;
}

function captureLabel(value: string) {
  return (
    {
      IDENTITY_DOCUMENT: "KTP / identitas",
      GUEST_PHOTO: "Foto tamu",
      SIGNATURE: "Tanda tangan",
    }[value] ?? human(value)
  );
}

export default function FrontOfficeDesk() {
  const [active, setActive] = useState("booking");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookingRows, setBookingRows] = useState<Booking[]>([]);
  const [paymentRows, setPaymentRows] = useState<Payment[]>([]);
  const [bookingPagination, setBookingPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1,
    from: 0,
    to: 0,
  });
  const [paymentPagination, setPaymentPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1,
    from: 0,
    to: 0,
  });
  const [roomMaster, setRoomMaster] = useState<RoomMaster>({
    roomTypes: [],
    roomUnits: [],
  });
  const [commercial, setCommercial] = useState<Commercial>({ ratePlans: [] });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        bookingResponse,
        paymentResponse,
        bookingHistoryResponse,
        paymentHistoryResponse,
        catalogResponse,
      ] = await Promise.all([
        fetch("/api/staff/bookings?view=operational", { cache: "no-store" }),
        fetch("/api/staff/payments?view=operational", { cache: "no-store" }),
        fetch("/api/staff/bookings?page=1&pageSize=20", {
          cache: "no-store",
        }),
        fetch("/api/staff/payments?page=1&pageSize=20", {
          cache: "no-store",
        }),
        fetch("/api/staff/front-office/catalog", { cache: "no-store" }),
      ]);
      if (
        !bookingResponse.ok ||
        !paymentResponse.ok ||
        !bookingHistoryResponse.ok ||
        !paymentHistoryResponse.ok ||
        !catalogResponse.ok
      )
        throw new Error("Front Office catalogue request failed");
      const bookingData = (await bookingResponse.json()) as {
        bookings?: Booking[];
      };
      const paymentData = (await paymentResponse.json()) as {
        payments?: Payment[];
      };
      const bookingHistory = (await bookingHistoryResponse.json()) as {
        bookings?: Booking[];
        pagination?: PaginationMeta;
      };
      const paymentHistory = (await paymentHistoryResponse.json()) as {
        payments?: Payment[];
        pagination?: PaginationMeta;
      };
      const catalogData = (await catalogResponse.json()) as RoomMaster &
        Commercial;
      setBookings(bookingData.bookings ?? []);
      setPayments(paymentData.payments ?? []);
      setBookingRows(bookingHistory.bookings ?? []);
      if (bookingHistory.pagination)
        setBookingPagination(bookingHistory.pagination);
      setPaymentRows(paymentHistory.payments ?? []);
      if (paymentHistory.pagination)
        setPaymentPagination(paymentHistory.pagination);
      setRoomMaster(
        catalogData.roomTypes ? catalogData : { roomTypes: [], roomUnits: [] },
      );
      setCommercial(catalogData.ratePlans ? catalogData : { ratePlans: [] });
    } catch {
      setNotice({ tone: "error", message: "Data Front Office gagal dimuat." });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBookingPage = useCallback(
    async (page: number, pageSize: number, search = "", status = "ALL") => {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        status,
      });
      const response = await fetch(`/api/staff/bookings?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Daftar booking gagal dimuat");
      const data = (await response.json()) as {
        bookings: Booking[];
        pagination: PaginationMeta;
      };
      setBookingRows(data.bookings);
      setBookingPagination(data.pagination);
    },
    [],
  );

  const loadPaymentPage = useCallback(
    async (page: number, pageSize: number, search = "", status = "ALL") => {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        status,
      });
      const response = await fetch(`/api/staff/payments?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Riwayat pembayaran gagal dimuat");
      const data = (await response.json()) as {
        payments: Payment[];
        pagination: PaginationMeta;
      };
      setPaymentRows(data.payments);
      setPaymentPagination(data.pagination);
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stays = useMemo(
    () =>
      bookings.flatMap((booking) =>
        booking.rooms.map((room) => ({ booking, room })),
      ),
    [bookings],
  );

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Front Office workspace</span>
          <h1>Front Office</h1>
          <p>
            Booking, pembayaran, masa inap, kamar, dan tagihan dalam satu meja
            kerja.
          </p>
        </div>
        <button
          className={styles.refreshButton}
          disabled={loading}
          onClick={load}
        >
          {loading ? "Memuat…" : "Perbarui data"}
        </button>
      </header>
      <div className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>Booking aktif</span>
          <strong>
            {
              bookings.filter(
                (item) => !["CANCELLED", "EXPIRED"].includes(item.status),
              ).length
            }
          </strong>
          <small>Online dan manual</small>
        </article>
        <article className={styles.metricCard}>
          <span>Verifikasi pembayaran</span>
          <strong>
            {
              payments.filter((item) => item.status === "PENDING_VERIFICATION")
                .length
            }
          </strong>
          <small>Menunggu keputusan Front Office</small>
        </article>
        <article className={styles.metricCard}>
          <span>In house</span>
          <strong>
            {
              stays.filter(({ room }) =>
                ["IN_HOUSE", "DUE_OUT"].includes(room.stayStatus ?? ""),
              ).length
            }
          </strong>
          <small>Kamar sedang dihuni</small>
        </article>
        <article className={`${styles.metricCard} ${styles.attentionCard}`}>
          <span>Belum dialokasikan</span>
          <strong>{stays.filter(({ room }) => !room.roomUnitId).length}</strong>
          <small>Periksa sebelum kedatangan</small>
        </article>
      </div>
      <nav aria-label="Bagian Front Office" className={styles.workspaceTabs}>
        {[
          ["booking", "Booking"],
          ["payment", "Pembayaran"],
          ["stay", "Check-in & kamar"],
          ["folio", "Folio & dokumen"],
        ].map(([key, label]) => (
          <button
            aria-current={active === key ? "page" : undefined}
            className={active === key ? styles.workspaceTabActive : ""}
            key={key}
            onClick={() => {
              setActive(key);
              setNotice(null);
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      <StaffNotice notice={notice} onDismiss={() => setNotice(null)} />
      {active === "booking" ? (
        <BookingPanel
          bookingRows={bookingRows}
          bookingPagination={bookingPagination}
          commercial={commercial}
          loadBookingPage={loadBookingPage}
          onChanged={load}
          roomMaster={roomMaster}
          setNotice={setNotice}
        />
      ) : null}
      {active === "payment" ? (
        <PaymentPanel
          bookings={bookings}
          loadPaymentPage={loadPaymentPage}
          onChanged={load}
          paymentPagination={paymentPagination}
          paymentRows={paymentRows}
          payments={payments}
          setNotice={setNotice}
        />
      ) : null}
      {active === "stay" ? (
        <StayPanel
          onChanged={load}
          roomMaster={roomMaster}
          setNotice={setNotice}
          stays={stays}
        />
      ) : null}
      {active === "folio" ? (
        <FolioPanel
          bookings={bookings}
          onChanged={load}
          setNotice={setNotice}
        />
      ) : null}
    </>
  );
}

function BookingPanel({
  bookingRows,
  bookingPagination,
  commercial,
  loadBookingPage,
  onChanged,
  roomMaster,
  setNotice,
}: {
  bookingRows: Booking[];
  bookingPagination: PaginationMeta;
  commercial: Commercial;
  loadBookingPage: (
    page: number,
    pageSize: number,
    search?: string,
    status?: string,
  ) => Promise<void>;
  onChanged: () => Promise<void>;
  roomMaster: RoomMaster;
  setNotice: (notice: Notice) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkoutDate, setCheckoutDate] = useState(nextDate(today));
  const [ratePlanCode, setRatePlanCode] = useState("");
  const [rooms, setRooms] = useState<QuoteRoom[]>([
    { roomTypeId: "", adults: 1, children: 0, infants: 0, extraBedQuantity: 0 },
  ]);
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState("FULL");
  const [depositValue, setDepositValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function updateRoom(index: number, patch: Partial<QuoteRoom>) {
    setRooms((current) =>
      current.map((room, roomIndex) =>
        roomIndex === index ? { ...room, ...patch } : room,
      ),
    );
  }

  async function createQuote(event: React.FormEvent) {
    event.preventDefault();
    if (!ratePlanCode || rooms.some((room) => !room.roomTypeId)) {
      setNotice({
        tone: "error",
        message: "Pilih rate plan dan tipe kamar terlebih dahulu.",
      });
      return;
    }
    if (checkoutDate <= checkInDate) {
      setNotice({
        tone: "error",
        message: "Tanggal check-out harus setelah check-in.",
      });
      return;
    }
    setBusy(true);
    try {
      const result = await mutate("/api/staff/bookings", {
        action: "QUOTE",
        checkInDate,
        checkoutDate,
        ratePlanCode,
        language: "id",
        displayCurrency: "IDR",
        rooms,
      });
      setQuote(result);
      setNotice({
        tone: "success",
        message:
          "Harga dan ketersediaan berhasil dikunci sementara. Lengkapi data tamu untuk membuat booking.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Quote gagal dibuat.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function reserve(event: React.FormEvent) {
    event.preventDefault();
    if (!quote?.quoteId) return;
    setBusy(true);
    try {
      const result = await mutate("/api/staff/bookings", {
        action: "RESERVE",
        quoteId: quote.quoteId,
        booker: {
          name: bookerName,
          email: bookerEmail,
          phone: bookerPhone || null,
        },
        internalNotes: notes || null,
        paymentMode,
        depositValue: depositValue ? Number(depositValue) : null,
        acknowledgedPolicyVersionIds: [],
      });
      setQuote(null);
      setNotice({
        tone: "success",
        message: `Booking ${String(result.bookingCode ?? "baru")} berhasil dibuat.`,
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Booking gagal dibuat.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.actionGrid}>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Booking manual / multi-room</h2>
          <span className={styles.countPill}>1. Quote</span>
        </div>
        <form className={styles.staffForm} onSubmit={createQuote}>
          <div className={styles.formGrid}>
            <div className={styles.fieldGroup}>
              <span>Check-in</span>
              <DateField
                ariaLabel="Tanggal check-in"
                min={today}
                value={checkInDate}
                onChange={(value) => {
                  setCheckInDate(value);
                  if (checkoutDate <= value) setCheckoutDate(nextDate(value));
                }}
              />
            </div>
            <div className={styles.fieldGroup}>
              <span>Check-out</span>
              <DateField
                ariaLabel="Tanggal check-out"
                min={nextDate(checkInDate)}
                value={checkoutDate}
                onChange={setCheckoutDate}
              />
            </div>
            <div className={styles.fieldGroup}>
              <span>Rate plan</span>
              <KookaSelect
                ariaLabel="Rate plan"
                emptyMessage="Belum ada rate plan aktif untuk booking manual."
                onChange={setRatePlanCode}
                options={commercial.ratePlans.map((plan) => ({
                  value: plan.code,
                  label: plan.nameId ?? plan.code,
                  description: `${plan.code} · booking manual`,
                }))}
                placeholder="Pilih rate plan"
                value={ratePlanCode}
              />
            </div>
          </div>
          <div className={styles.roomRows}>
            {rooms.map((room, index) => (
              <div className={styles.roomInputRow} key={index}>
                <div className={styles.fieldGroup}>
                  <span>Tipe kamar</span>
                  <KookaSelect
                    ariaLabel={`Tipe kamar ${index + 1}`}
                    emptyMessage="Belum ada tipe kamar aktif."
                    onChange={(value) =>
                      updateRoom(index, { roomTypeId: value })
                    }
                    options={roomMaster.roomTypes.map((type) => ({
                      value: type.roomTypeId,
                      label: type.nameId ?? type.code,
                      description: `${type.code} · maks. ${type.maximumTotalGuests ?? "—"} tamu${type.extraBedAllowed ? " · extra bed tersedia" : ""}`,
                    }))}
                    placeholder="Pilih tipe kamar"
                    value={room.roomTypeId}
                  />
                </div>
                <label>
                  Dewasa
                  <input
                    min="1"
                    type="number"
                    value={room.adults}
                    onChange={(event) =>
                      updateRoom(index, { adults: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Anak
                  <input
                    min="0"
                    type="number"
                    value={room.children}
                    onChange={(event) =>
                      updateRoom(index, {
                        children: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Extra bed
                  <input
                    min="0"
                    type="number"
                    value={room.extraBedQuantity}
                    onChange={(event) =>
                      updateRoom(index, {
                        extraBedQuantity: Number(event.target.value),
                      })
                    }
                  />
                </label>
                {rooms.length > 1 ? (
                  <button
                    aria-label={`Hapus kamar ${index + 1}`}
                    className={styles.removeButton}
                    onClick={() =>
                      setRooms((current) =>
                        current.filter((_, roomIndex) => roomIndex !== index),
                      )
                    }
                    type="button"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryButton}
              disabled={rooms.length >= 15}
              onClick={() =>
                setRooms((current) => [
                  ...current,
                  {
                    roomTypeId: "",
                    adults: 1,
                    children: 0,
                    infants: 0,
                    extraBedQuantity: 0,
                  },
                ])
              }
              type="button"
            >
              + Tambah kamar
            </button>
            <button
              className={styles.primaryButton}
              disabled={busy}
              type="submit"
            >
              Cek harga & ketersediaan
            </button>
          </div>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Data pemesan</h2>
          <span className={styles.countPill}>2. Konfirmasi</span>
        </div>
        {quote ? (
          <form className={styles.staffForm} onSubmit={reserve}>
            <div className={styles.quoteSummary}>
              <span>Total resmi</span>
              <strong>{formatIdr(Number(quote.totalIdr ?? 0))}</strong>
              <small>
                Quote berlaku hingga{" "}
                {new Date(String(quote.expiresAt)).toLocaleTimeString("id-ID")}
              </small>
            </div>
            <div className={styles.formGrid}>
              <label>
                Nama lengkap
                <input
                  required
                  value={bookerName}
                  onChange={(event) => setBookerName(event.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={bookerEmail}
                  onChange={(event) => setBookerEmail(event.target.value)}
                />
              </label>
              <label>
                WhatsApp / telepon
                <input
                  value={bookerPhone}
                  onChange={(event) => setBookerPhone(event.target.value)}
                />
              </label>
              <div className={styles.fieldGroup}>
                <span>Metode pembayaran</span>
                <KookaSelect
                  ariaLabel="Metode pembayaran"
                  onChange={setPaymentMode}
                  options={[
                    { value: "FULL", label: "Bayar penuh" },
                    { value: "FIXED_DEPOSIT", label: "Deposit nominal" },
                    {
                      value: "PERCENTAGE_DEPOSIT",
                      label: "Deposit persentase",
                    },
                    { value: "PAY_AT_CHECKIN", label: "Bayar saat check-in" },
                    {
                      value: "PAY_AT_CHECKOUT",
                      label: "Bayar saat checkout",
                    },
                  ]}
                  value={paymentMode}
                />
              </div>
              {paymentMode.includes("DEPOSIT") ? (
                <label>
                  {paymentMode === "FIXED_DEPOSIT"
                    ? "Nilai deposit IDR"
                    : "Persentase deposit"}
                  {paymentMode === "FIXED_DEPOSIT" ? (
                    <MoneyInput
                      ariaLabel="Nominal deposit IDR"
                      onChange={setDepositValue}
                      required
                      value={depositValue}
                    />
                  ) : (
                    <input
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="Contoh: 50"
                      required
                      type="text"
                      value={depositValue}
                      onChange={(event) =>
                        setDepositValue(
                          event.target.value.replace(/\D/gu, "").slice(0, 3),
                        )
                      }
                    />
                  )}
                </label>
              ) : null}
            </div>
            <label>
              Catatan internal
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <button
              className={styles.primaryButton}
              disabled={busy}
              type="submit"
            >
              Buat booking
            </button>
          </form>
        ) : (
          <div className={styles.emptyState}>
            Buat quote di sebelah kiri terlebih dahulu.
          </div>
        )}
      </section>
      <BookingTable
        bookings={bookingRows}
        loadPage={loadBookingPage}
        pagination={bookingPagination}
        setNotice={setNotice}
        onChanged={onChanged}
      />
    </div>
  );
}

function BookingTable({
  bookings,
  loadPage,
  pagination,
  setNotice,
  onChanged,
}: {
  bookings: Booking[];
  loadPage: (
    page: number,
    pageSize: number,
    search?: string,
    status?: string,
  ) => Promise<void>;
  pagination: PaginationMeta;
  setNotice: (notice: Notice) => void;
  onChanged: () => Promise<void>;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const refresh = async (page: number, pageSize: number) => {
    try {
      await loadPage(page, pageSize, search.trim(), status);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Daftar booking gagal dimuat.",
      });
    }
  };
  async function cancel() {
    if (!cancellingId || cancelReason.trim().length < 3) return;
    try {
      await mutate("/api/staff/bookings", {
        action: "CANCEL",
        reservationId: cancellingId,
        reason: cancelReason.trim(),
      });
      setCancellingId(null);
      setCancelReason("");
      setNotice({
        tone: "success",
        message: "Booking dibatalkan dan alasan tersimpan di audit.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Pembatalan gagal.",
      });
    }
  }
  return (
    <section className={`${styles.panel} ${styles.actionGridWide}`}>
      <div className={styles.panelHeader}>
        <h2>Daftar booking</h2>
        <span className={styles.countPill}>{pagination.totalItems}</span>
      </div>
      <form
        className={styles.historyFilters}
        onSubmit={(event) => {
          event.preventDefault();
          void refresh(1, pagination.pageSize);
        }}
      >
        <input
          aria-label="Cari booking"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari kode, nama, atau email tamu"
          type="search"
          value={search}
        />
        <KookaSelect
          ariaLabel="Filter status booking"
          onChange={setStatus}
          options={[
            { value: "ALL", label: "Semua status" },
            { value: "ON_HOLD", label: "Menunggu pembayaran" },
            { value: "CONFIRMED", label: "Terkonfirmasi" },
            { value: "CANCELLED", label: "Dibatalkan" },
            { value: "EXPIRED", label: "Kedaluwarsa" },
            { value: "COMPLETED", label: "Selesai" },
          ]}
          value={status}
        />
        <button className={styles.secondaryButton} type="submit">
          Terapkan
        </button>
      </form>
      <div className={styles.tableWrap}>
        <table className={styles.workTable}>
          <thead>
            <tr>
              <th>Kode / tamu</th>
              <th>Tanggal & kamar</th>
              <th>Pembayaran</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <strong>{booking.bookingCode}</strong>
                  <br />
                  <small>
                    {booking.bookerName} · {booking.bookerEmail}
                  </small>
                </td>
                <td>
                  {booking.rooms
                    .map((room) => `${room.checkInDate} → ${room.checkoutDate}`)
                    .join(", ")}
                  <br />
                  <small>{booking.rooms.length} kamar</small>
                </td>
                <td>
                  {formatIdr(booking.requiredPaymentIdr)}
                  <br />
                  <small>{human(booking.paymentMode)}</small>
                </td>
                <td>
                  <span className={styles.statusPill}>
                    {human(booking.status)}
                  </span>
                </td>
                <td>
                  {!["CANCELLED", "COMPLETED", "EXPIRED"].includes(
                    booking.status,
                  ) ? (
                    <button
                      className={styles.textButton}
                      onClick={() => {
                        setCancelReason("");
                        setCancellingId(booking.id);
                      }}
                      type="button"
                    >
                      Batalkan
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls
        onPageChange={(page) => void refresh(page, pagination.pageSize)}
        onPageSizeChange={(pageSize) => void refresh(1, pageSize)}
        pageSizes={[20, 50, 100]}
        pagination={pagination}
      />
      <ReasonDialog
        confirmLabel="Batalkan booking"
        description="Pembatalan akan mengubah status reservasi dan dicatat pada audit log. Nominal refund tetap diproses manual sesuai kebijakan."
        label="Alasan pembatalan"
        onCancel={() => {
          setCancellingId(null);
          setCancelReason("");
        }}
        onChange={setCancelReason}
        onConfirm={() => void cancel()}
        open={Boolean(cancellingId)}
        title="Batalkan booking?"
        value={cancelReason}
      />
    </section>
  );
}

function PaymentPanel({
  bookings,
  loadPaymentPage,
  paymentPagination,
  paymentRows,
  payments,
  setNotice,
  onChanged,
}: {
  bookings: Booking[];
  loadPaymentPage: (
    page: number,
    pageSize: number,
    search?: string,
    status?: string,
  ) => Promise<void>;
  paymentPagination: PaginationMeta;
  paymentRows: Payment[];
  payments: Payment[];
  setNotice: (notice: Notice) => void;
  onChanged: () => Promise<void>;
}) {
  const [reservationId, setReservationId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewTarget, setReviewTarget] = useState<{
    paymentId: string;
    decision: "VERIFY" | "REJECT";
  } | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("ALL");
  const refreshHistory = async (page: number, pageSize: number) => {
    try {
      await loadPaymentPage(
        page,
        pageSize,
        historySearch.trim(),
        historyStatus,
      );
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Riwayat pembayaran gagal dimuat.",
      });
    }
  };
  async function record(event: React.FormEvent) {
    event.preventDefault();
    if (!reservationId || !amount || Number(amount) < 1) {
      setNotice({
        tone: "error",
        message: "Pilih booking dan isi nominal pembayaran yang valid.",
      });
      return;
    }
    try {
      await mutate("/api/staff/payments", {
        action: "RECORD_FOR_REVIEW",
        reservationId,
        amountIdr: Number(amount),
        method,
        receivedAt: new Date().toISOString(),
        reference: reference || null,
        notes: notes || null,
      });
      setNotice({
        tone: "success",
        message: "Pembayaran dicatat dan masuk antrean verifikasi.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Pembayaran gagal dicatat.",
      });
    }
  }
  async function review() {
    if (!reviewTarget || reviewReason.trim().length < 3) return;
    try {
      await mutate("/api/staff/payments", {
        action: "REVIEW",
        paymentId: reviewTarget.paymentId,
        decision: reviewTarget.decision,
        reason: reviewReason.trim(),
      });
      setNotice({
        tone: "success",
        message:
          reviewTarget.decision === "VERIFY"
            ? "Pembayaran terverifikasi."
            : "Pembayaran ditolak.",
      });
      setReviewTarget(null);
      setReviewReason("");
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Review pembayaran gagal.",
      });
    }
  }
  return (
    <div className={styles.actionGrid}>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Catat pembayaran manual</h2>
        </div>
        <form className={styles.staffForm} onSubmit={record}>
          <div className={styles.fieldGroup}>
            <span>Booking</span>
            <KookaSelect
              ariaLabel="Booking untuk pembayaran"
              onChange={setReservationId}
              options={bookings
                .filter(
                  (booking) =>
                    !["CANCELLED", "EXPIRED"].includes(booking.status),
                )
                .map((booking) => ({
                  value: booking.id,
                  label: `${booking.bookingCode} — ${booking.bookerName}`,
                  description: human(booking.status),
                }))}
              placeholder="Pilih booking"
              value={reservationId}
            />
          </div>
          <div className={styles.formGrid}>
            <label>
              Nominal IDR
              <MoneyInput
                ariaLabel="Nominal pembayaran IDR"
                onChange={setAmount}
                required
                value={amount}
              />
            </label>
            <div className={styles.fieldGroup}>
              <span>Metode</span>
              <KookaSelect
                ariaLabel="Metode pembayaran manual"
                onChange={setMethod}
                options={[
                  { value: "BANK_TRANSFER", label: "Transfer bank" },
                  { value: "CASH", label: "Tunai" },
                  { value: "PAY_AT_CHECKIN", label: "Bayar check-in" },
                  { value: "PAY_AT_CHECKOUT", label: "Bayar checkout" },
                  { value: "OTHER", label: "Lainnya" },
                ]}
                value={method}
              />
            </div>
            <label>
              Referensi
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
          </div>
          <label>
            Catatan
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton} type="submit">
            Simpan pembayaran
          </button>
        </form>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Antrean verifikasi</h2>
          <span className={styles.countPill}>
            {
              payments.filter(
                (payment) => payment.status === "PENDING_VERIFICATION",
              ).length
            }
          </span>
        </div>
        <div className={styles.queueList}>
          {payments
            .filter((payment) => payment.status === "PENDING_VERIFICATION")
            .map((payment) => (
              <div className={styles.paymentReviewRow} key={payment.id}>
                <div>
                  <strong>
                    {payment.paymentCode} · {payment.bookingCode}
                  </strong>
                  <small>
                    {payment.bookerName} · {human(payment.method)}
                  </small>
                </div>
                <strong>{formatIdr(payment.amountIdr)}</strong>
                <div>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => {
                      setReviewReason("");
                      setReviewTarget({
                        paymentId: payment.id,
                        decision: "REJECT",
                      });
                    }}
                    type="button"
                  >
                    Tolak
                  </button>
                  <button
                    className={styles.primaryButton}
                    onClick={() => {
                      setReviewReason("");
                      setReviewTarget({
                        paymentId: payment.id,
                        decision: "VERIFY",
                      });
                    }}
                    type="button"
                  >
                    Verifikasi
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Riwayat pembayaran</h2>
          <span className={styles.countPill}>
            {paymentPagination.totalItems}
          </span>
        </div>
        <form
          className={styles.historyFilters}
          onSubmit={(event) => {
            event.preventDefault();
            void refreshHistory(1, paymentPagination.pageSize);
          }}
        >
          <input
            aria-label="Cari pembayaran"
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="Cari kode pembayaran, booking, atau tamu"
            type="search"
            value={historySearch}
          />
          <KookaSelect
            ariaLabel="Filter status pembayaran"
            onChange={setHistoryStatus}
            options={[
              { value: "ALL", label: "Semua status" },
              {
                value: "PENDING_VERIFICATION",
                label: "Menunggu verifikasi",
              },
              { value: "VERIFIED", label: "Terverifikasi" },
              { value: "REJECTED", label: "Ditolak" },
              { value: "VOIDED", label: "Dibatalkan" },
            ]}
            value={historyStatus}
          />
          <button className={styles.secondaryButton} type="submit">
            Terapkan
          </button>
        </form>
        <div className={styles.tableWrap}>
          <table className={styles.workTable}>
            <thead>
              <tr>
                <th>Kode / booking</th>
                <th>Tamu</th>
                <th>Nominal</th>
                <th>Metode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <strong>{payment.paymentCode}</strong>
                    <br />
                    <small>{payment.bookingCode}</small>
                  </td>
                  <td>{payment.bookerName}</td>
                  <td>{formatIdr(payment.amountIdr)}</td>
                  <td>{human(payment.method)}</td>
                  <td>
                    <span className={styles.statusPill}>
                      {human(payment.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          onPageChange={(page) =>
            void refreshHistory(page, paymentPagination.pageSize)
          }
          onPageSizeChange={(pageSize) => void refreshHistory(1, pageSize)}
          pageSizes={[20, 50, 100]}
          pagination={paymentPagination}
        />
      </section>
      <ReasonDialog
        confirmLabel={
          reviewTarget?.decision === "VERIFY"
            ? "Verifikasi pembayaran"
            : "Tolak pembayaran"
        }
        description="Catatan ini akan menjadi bagian dari riwayat verifikasi pembayaran."
        label={
          reviewTarget?.decision === "VERIFY"
            ? "Catatan verifikasi"
            : "Alasan penolakan"
        }
        onCancel={() => {
          setReviewTarget(null);
          setReviewReason("");
        }}
        onChange={setReviewReason}
        onConfirm={() => void review()}
        open={Boolean(reviewTarget)}
        title={
          reviewTarget?.decision === "VERIFY"
            ? "Verifikasi pembayaran?"
            : "Tolak pembayaran?"
        }
        value={reviewReason}
      />
    </div>
  );
}

function StayPanel({
  stays,
  roomMaster,
  setNotice,
  onChanged,
}: {
  stays: Array<{ booking: Booking; room: RoomLine }>;
  roomMaster: RoomMaster;
  setNotice: (notice: Notice) => void;
  onChanged: () => Promise<void>;
}) {
  const [reservationRoomId, setReservationRoomId] = useState("");
  const [action, setAction] = useState("CHECK_IN");
  const [stayReason, setStayReason] = useState("");
  const [captureReason, setCaptureReason] = useState("");
  const [captureType, setCaptureType] = useState("IDENTITY_DOCUMENT");
  const [captureOutcome, setCaptureOutcome] = useState("CAPTURED");
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [identityType, setIdentityType] = useState("KTP");
  const [identityNumber, setIdentityNumber] = useState("");
  const [allocationRoomUnitId, setAllocationRoomUnitId] = useState("");
  const [allocationReason, setAllocationReason] = useState("");
  const [moveRoomUnitId, setMoveRoomUnitId] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [maintenanceRoomUnitId, setMaintenanceRoomUnitId] = useState("");
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [priceTreatment, setPriceTreatment] = useState("NO_CHANGE");
  const [adjustment, setAdjustment] = useState("0");
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockStartsOn, setBlockStartsOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [blockEndsOn, setBlockEndsOn] = useState(
    nextDate(new Date().toISOString().slice(0, 10)),
  );
  const selected = stays.find(
    ({ room }) => room.reservationRoomId === reservationRoomId,
  );
  const selectedRoomStayId = selected?.room.roomStayId ?? "";
  const selectedRoomType = roomMaster.roomTypes.find(
    (roomType) => roomType.roomTypeId === selected?.room.roomTypeId,
  );
  const selectedRoomUnit = roomMaster.roomUnits.find(
    (roomUnit) => roomUnit.id === selected?.room.roomUnitId,
  );
  const compatibleRooms = assignableRooms(
    roomMaster,
    selected?.room.roomTypeId,
    selected?.room.checkInDate,
    selected?.room.checkoutDate,
  );
  async function transition(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRoomStayId) return;
    try {
      await mutate("/api/staff/stays", {
        action,
        roomStayId: selectedRoomStayId,
        reason: stayReason,
        overrideReadiness: false,
        departureOutcome: action === "CHECK_OUT" ? "CLEARED" : undefined,
      });
      setNotice({
        tone: "success",
        message: "Status masa inap berhasil diperbarui.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Status gagal diperbarui.",
      });
    }
  }
  async function capture(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      let fileId: string | undefined;
      if (captureOutcome === "CAPTURED") {
        if (!captureFile)
          throw new Error("Ambil foto atau tanda tangan terlebih dahulu.");
        const form = new FormData();
        form.set("file", captureFile);
        form.set("purpose", captureType);
        const upload = await fetch("/api/staff/checkin-files", {
          method: "POST",
          body: form,
        });
        const uploaded = (await upload.json()) as {
          fileId?: string;
          error?: { message?: string };
        };
        if (!upload.ok || !uploaded.fileId)
          throw new Error(uploaded.error?.message ?? "File gagal disimpan.");
        fileId = uploaded.fileId;
      }
      await mutate("/api/staff/stays", {
        action: "CAPTURE_CHECKIN",
        roomStayId: selectedRoomStayId || undefined,
        reservationRoomId: selected.room.reservationRoomId,
        captureType,
        outcome: captureOutcome,
        fileId,
        reason: captureReason || undefined,
        identity:
          captureType === "IDENTITY_DOCUMENT" && captureOutcome === "CAPTURED"
            ? { type: identityType, number: identityNumber }
            : undefined,
      });
      setNotice({
        tone: "success",
        message:
          captureOutcome === "CAPTURED"
            ? "Data registrasi tamu tersimpan secara privat."
            : "Pilihan opsional tamu sudah dicatat.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Registrasi gagal disimpan.",
      });
    }
  }
  async function move(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRoomStayId) return;
    try {
      await mutate("/api/staff/room-board", {
        action: "MOVE",
        roomStayId: selectedRoomStayId,
        toRoomUnitId: moveRoomUnitId,
        effectiveOn: new Date().toISOString().slice(0, 10),
        reason: moveReason,
        priceTreatment,
        priceAdjustmentIdr: Number(adjustment),
        incidentalNoCharge: priceTreatment === "NO_CHANGE",
      });
      setNotice({
        tone: "success",
        message: "Perpindahan kamar dan perlakuan harga berhasil dicatat.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Pindah kamar gagal.",
      });
    }
  }
  async function assign() {
    if (!selected) return;
    try {
      await mutate("/api/staff/room-board", {
        action: "ASSIGN",
        reservationRoomId: selected.room.reservationRoomId,
        roomUnitId: allocationRoomUnitId,
        reason: allocationReason,
      });
      setNotice({
        tone: "success",
        message: "Nomor kamar berhasil dialokasikan ke booking.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Alokasi kamar gagal.",
      });
    }
  }
  async function blockRoomUnit() {
    if (!maintenanceRoomUnitId || blockEndsOn <= blockStartsOn) return;
    try {
      await mutate("/api/staff/room-board", {
        action: "BLOCK",
        roomUnitId: maintenanceRoomUnitId,
        blockType: "MAINTENANCE",
        startsOn: blockStartsOn,
        endsOn: blockEndsOn,
        reason: maintenanceReason,
      });
      setBlockDialogOpen(false);
      setNotice({
        tone: "success",
        message: "Kamar diblokir dari inventory pada periode yang dipilih.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Blokir kamar gagal.",
      });
    }
  }
  return (
    <div className={`${styles.actionGrid} ${styles.stayActionGrid}`}>
      <section className={`${styles.formCard} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Pilih masa inap</h2>
        </div>
        <div className={styles.staffForm}>
          <div className={styles.fieldGroup}>
            <span>Booking / kamar</span>
            <KookaSelect
              ariaLabel="Booking atau kamar yang sedang diinapkan"
              onChange={(value) => {
                setReservationRoomId(value);
                setAllocationRoomUnitId("");
                setAllocationReason("");
                setMoveRoomUnitId("");
                setMoveReason("");
              }}
              options={stays.map(({ booking, room }, index) => ({
                value: room.reservationRoomId,
                label: `${booking.bookingCode} — ${booking.bookerName}`,
                description: `${
                  roomMaster.roomTypes.find(
                    (roomType) => roomType.roomTypeId === room.roomTypeId,
                  )?.nameId ?? `Kamar ${index + 1}`
                } · ${
                  room.roomUnitId
                    ? `nomor ${
                        roomMaster.roomUnits.find(
                          (unit) => unit.id === room.roomUnitId,
                        )?.roomNumber ?? "tersimpan"
                      } · ${human(room.stayStatus)}`
                    : "belum dialokasikan"
                }`,
              }))}
              placeholder="Pilih tamu"
              value={reservationRoomId}
            />
            {selected && !selected.room.roomUnitId ? (
              <small className={styles.formHint}>
                Registrasi tamu dapat disimpan sekarang. Alokasikan nomor kamar
                sebelum memproses check-in.
              </small>
            ) : null}
            {selected ? (
              <div className={styles.selectionSummary}>
                <span>
                  Tipe kamar
                  <strong>{selectedRoomType?.nameId ?? "Belum dinamai"}</strong>
                </span>
                <span>
                  Nomor kamar
                  <strong>
                    {selectedRoomUnit?.roomNumber ?? "Belum dialokasikan"}
                  </strong>
                </span>
                <span>
                  Registrasi
                  <strong>
                    {selected.room.registrationStatus
                      ? human(selected.room.registrationStatus)
                      : "Belum ada data"}
                  </strong>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Check-in, checkout & no-show</h2>
        </div>
        <form className={styles.staffForm} onSubmit={transition}>
          <div className={styles.fieldGroup}>
            <span>Aksi</span>
            <KookaSelect
              ariaLabel="Aksi masa inap"
              onChange={setAction}
              options={[
                { value: "MARK_DUE_IN", label: "Tandai due-in" },
                { value: "CHECK_IN", label: "Check-in" },
                { value: "MARK_DUE_OUT", label: "Tandai due-out" },
                { value: "CHECK_OUT", label: "Checkout" },
                {
                  value: "MARK_NO_SHOW",
                  label: "Tandai no-show",
                  description: "Kamar tetap ditahan",
                },
                { value: "REOPEN_NO_SHOW", label: "Buka kembali no-show" },
                { value: "RELEASE_NO_SHOW", label: "Lepaskan kamar no-show" },
              ]}
              value={action}
            />
          </div>
          <label>
            Alasan / catatan
            <textarea
              required
              minLength={3}
              value={stayReason}
              onChange={(event) => setStayReason(event.target.value)}
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={
              !selectedRoomStayId ||
              !selected?.room.roomUnitId ||
              stayReason.trim().length < 3
            }
            type="submit"
          >
            Proses status
          </button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Registrasi tamu (opsional)</h2>
          {selected?.room.registrationStatus ? (
            <span className={styles.statusPill}>
              {human(selected.room.registrationStatus)}
            </span>
          ) : null}
        </div>
        {selected?.room.registrationItems?.length ? (
          <div className={styles.savedRegistration}>
            <strong>Data tamu yang sudah tersimpan</strong>
            <ul>
              {selected.room.registrationItems.map((item) => (
                <li key={item.captureType}>
                  <span>{captureLabel(item.captureType)}</span>
                  <b>{human(item.outcome)}</b>
                </li>
              ))}
              {selected.room.identityNumberLast4 ? (
                <li>
                  <span>{selected.room.identityType ?? "Identitas"}</span>
                  <b>•••• {selected.room.identityNumberLast4}</b>
                </li>
              ) : null}
            </ul>
            <small>
              Nomor identitas ditampilkan sebagian untuk melindungi data tamu.
            </small>
          </div>
        ) : selected ? (
          <p className={styles.registrationEmpty}>
            Belum ada foto identitas, foto tamu, atau tanda tangan yang
            disimpan.
          </p>
        ) : null}
        <form className={styles.staffForm} onSubmit={capture}>
          <div className={styles.formGrid}>
            <div className={styles.fieldGroup}>
              <span>Jenis data</span>
              <KookaSelect
                ariaLabel="Jenis data registrasi"
                onChange={(value) => {
                  setCaptureType(value);
                  setCaptureFile(null);
                }}
                options={[
                  { value: "IDENTITY_DOCUMENT", label: "KTP / identitas" },
                  { value: "GUEST_PHOTO", label: "Foto tamu" },
                  { value: "SIGNATURE", label: "Tanda tangan" },
                ]}
                value={captureType}
              />
            </div>
            <div className={styles.fieldGroup}>
              <span>Hasil</span>
              <KookaSelect
                ariaLabel="Hasil pengambilan data"
                onChange={setCaptureOutcome}
                options={[
                  { value: "CAPTURED", label: "Diambil" },
                  { value: "DECLINED", label: "Tamu menolak" },
                  { value: "SKIPPED", label: "Dilewati" },
                  { value: "FAILED", label: "Gagal diambil" },
                ]}
                value={captureOutcome}
              />
            </div>
          </div>
          {captureOutcome === "CAPTURED" && captureType === "SIGNATURE" ? (
            <SignaturePad onChange={setCaptureFile} />
          ) : null}
          {captureOutcome === "CAPTURED" && captureType !== "SIGNATURE" ? (
            <>
              <FileField
                accept="image/jpeg,image/png"
                capture="environment"
                file={captureFile}
                helper="JPEG atau PNG · kamera perangkat dapat digunakan"
                label={
                  captureType === "IDENTITY_DOCUMENT"
                    ? "Foto identitas"
                    : "Ambil foto tamu"
                }
                onChange={setCaptureFile}
              />
              {captureType === "IDENTITY_DOCUMENT" ? (
                <div className={styles.formGrid}>
                  <label>
                    Jenis identitas
                    <input
                      value={identityType}
                      onChange={(event) => setIdentityType(event.target.value)}
                    />
                  </label>
                  <label>
                    Nomor identitas
                    <input
                      required
                      value={identityNumber}
                      onChange={(event) =>
                        setIdentityNumber(event.target.value)
                      }
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : null}
          {captureOutcome !== "CAPTURED" ? (
            <label>
              Alasan / catatan
              <textarea
                required
                minLength={3}
                value={captureReason}
                onChange={(event) => setCaptureReason(event.target.value)}
              />
            </label>
          ) : null}
          <button
            className={styles.primaryButton}
            disabled={
              !selected ||
              (captureOutcome === "CAPTURED" &&
                (!captureFile ||
                  (captureType === "IDENTITY_DOCUMENT" &&
                    identityNumber.trim().length < 3))) ||
              (captureOutcome !== "CAPTURED" && captureReason.trim().length < 3)
            }
            type="submit"
          >
            Simpan registrasi
          </button>
        </form>
      </section>
      <section className={`${styles.formCard} ${styles.allocationCard}`}>
        <div className={styles.panelHeader}>
          <h2>Alokasi kamar pertama</h2>
          {selected?.room.roomUnitId ? (
            <span className={styles.statusPill}>Sudah dialokasikan</span>
          ) : null}
        </div>
        {!selected ? (
          <p className={styles.registrationEmpty}>
            Pilih booking di bagian atas untuk menentukan nomor kamar.
          </p>
        ) : selected.room.roomUnitId ? (
          <div className={styles.allocationComplete}>
            <span>Nomor kamar saat ini</span>
            <strong>Kamar {selectedRoomUnit?.roomNumber ?? "tersimpan"}</strong>
            <small>
              Gunakan bagian “Pindah kamar” hanya jika tamu benar-benar perlu
              dipindahkan setelah alokasi ini.
            </small>
          </div>
        ) : (
          <form
            className={styles.staffForm}
            onSubmit={(event) => {
              event.preventDefault();
              void assign();
            }}
          >
            <div className={styles.allocationIntro}>
              <span>Tipe yang dipesan</span>
              <strong>{selectedRoomType?.nameId ?? "Belum diketahui"}</strong>
              <small>
                Hanya nomor kamar dengan tipe yang sama yang dapat dipilih.
              </small>
            </div>
            <div className={styles.fieldGroup}>
              <span>Nomor kamar</span>
              <KookaSelect
                ariaLabel="Nomor kamar untuk alokasi pertama"
                emptyMessage="Tidak ada nomor kamar dengan tipe yang sesuai."
                onChange={setAllocationRoomUnitId}
                options={compatibleRooms.map((room) => ({
                  value: room.id,
                  label: `Kamar ${room.roomNumber}`,
                  description: [
                    selectedRoomType?.nameId,
                    room.occupancyStatus ? human(room.occupancyStatus) : null,
                    room.housekeepingStatus
                      ? human(room.housekeepingStatus)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }))}
                placeholder="Pilih nomor kamar yang sesuai"
                value={allocationRoomUnitId}
              />
            </div>
            <label>
              Alasan alokasi
              <textarea
                minLength={3}
                placeholder="Contoh: Persiapan kedatangan tamu"
                required
                value={allocationReason}
                onChange={(event) => setAllocationReason(event.target.value)}
              />
            </label>
            <button
              className={styles.primaryButton}
              disabled={
                !allocationRoomUnitId || allocationReason.trim().length < 3
              }
              type="submit"
            >
              Alokasikan nomor kamar
            </button>
          </form>
        )}
      </section>
      <section className={`${styles.formCard} ${styles.roomMoveCard}`}>
        <div className={styles.panelHeader}>
          <h2>Pindah kamar</h2>
        </div>
        {!selected?.room.roomUnitId ? (
          <p className={styles.registrationEmpty}>
            Pindah kamar baru tersedia setelah nomor kamar pertama dialokasikan.
          </p>
        ) : (
          <form className={styles.staffForm} onSubmit={move}>
            <div className={styles.fieldGroup}>
              <span>Kamar tujuan baru</span>
              <KookaSelect
                ariaLabel="Kamar tujuan pindah"
                emptyMessage="Tidak ada kamar kompatibel yang tersedia."
                onChange={setMoveRoomUnitId}
                options={compatibleRooms
                  .filter((room) => room.id !== selected.room.roomUnitId)
                  .map((room) => ({
                    value: room.id,
                    label: `Kamar ${room.roomNumber}`,
                    description: [
                      roomMaster.roomTypes.find(
                        (type) => type.roomTypeId === room.roomTypeId,
                      )?.nameId,
                      room.occupancyStatus ? human(room.occupancyStatus) : null,
                      room.housekeepingStatus
                        ? human(room.housekeepingStatus)
                        : null,
                      room.serviceabilityStatus
                        ? human(room.serviceabilityStatus)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                placeholder="Pilih kamar tujuan baru"
                value={moveRoomUnitId}
              />
            </div>
            <div className={styles.formGrid}>
              <div className={styles.fieldGroup}>
                <span>Perlakuan harga</span>
                <KookaSelect
                  ariaLabel="Perlakuan harga pindah kamar"
                  onChange={setPriceTreatment}
                  options={[
                    {
                      value: "NO_CHANGE",
                      label: "Insidentil, tanpa perubahan",
                    },
                    { value: "CHARGE", label: "Tambahan harga" },
                    { value: "CREDIT", label: "Kredit / kompensasi" },
                  ]}
                  value={priceTreatment}
                />
              </div>
              {priceTreatment !== "NO_CHANGE" ? (
                <label>
                  Nominal IDR
                  <MoneyInput
                    ariaLabel="Nominal penyesuaian pindah kamar"
                    onChange={setAdjustment}
                    value={adjustment}
                  />
                </label>
              ) : null}
            </div>
            <label>
              Alasan pindah kamar
              <textarea
                minLength={3}
                required
                value={moveReason}
                onChange={(event) => setMoveReason(event.target.value)}
              />
            </label>
            <button
              className={styles.primaryButton}
              disabled={
                !selectedRoomStayId ||
                !moveRoomUnitId ||
                moveReason.trim().length < 3
              }
              type="submit"
            >
              Pindahkan kamar
            </button>
          </form>
        )}
      </section>
      <section className={`${styles.formCard} ${styles.maintenanceCard}`}>
        <div className={styles.panelHeader}>
          <h2>Blokir kamar / maintenance</h2>
        </div>
        <div className={styles.staffForm}>
          <div className={styles.fieldGroup}>
            <span>Nomor kamar</span>
            <KookaSelect
              ariaLabel="Nomor kamar untuk maintenance"
              emptyMessage="Belum ada kamar fisik aktif."
              onChange={setMaintenanceRoomUnitId}
              options={roomMaster.roomUnits
                .filter((room) => room.status === "ACTIVE")
                .map((room) => ({
                  value: room.id,
                  label: `Kamar ${room.roomNumber}`,
                  description: room.serviceabilityStatus
                    ? human(room.serviceabilityStatus)
                    : undefined,
                }))}
              placeholder="Pilih nomor kamar"
              value={maintenanceRoomUnitId}
            />
          </div>
          <label>
            Alasan maintenance
            <textarea
              minLength={3}
              required
              value={maintenanceReason}
              onChange={(event) => setMaintenanceReason(event.target.value)}
            />
          </label>
          <button
            className={styles.secondaryButton}
            disabled={
              !maintenanceRoomUnitId || maintenanceReason.trim().length < 3
            }
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              setBlockStartsOn(today);
              setBlockEndsOn(nextDate(today));
              setBlockDialogOpen(true);
            }}
            type="button"
          >
            Atur periode maintenance
          </button>
        </div>
      </section>
      <ActionDialog
        confirmDisabled={
          !maintenanceRoomUnitId ||
          maintenanceReason.trim().length < 3 ||
          blockEndsOn <= blockStartsOn
        }
        confirmLabel="Blokir kamar"
        description="Kamar tidak akan tersedia untuk alokasi selama periode maintenance ini."
        onCancel={() => setBlockDialogOpen(false)}
        onConfirm={() => void blockRoomUnit()}
        open={blockDialogOpen}
        title="Atur periode maintenance"
      >
        <div className={styles.formGrid}>
          <div className={styles.fieldGroup}>
            <span>Mulai</span>
            <DateField
              ariaLabel="Tanggal mulai maintenance"
              onChange={(value) => {
                setBlockStartsOn(value);
                if (blockEndsOn <= value) setBlockEndsOn(nextDate(value));
              }}
              value={blockStartsOn}
            />
          </div>
          <div className={styles.fieldGroup}>
            <span>Selesai</span>
            <DateField
              ariaLabel="Tanggal selesai maintenance"
              min={nextDate(blockStartsOn)}
              onChange={setBlockEndsOn}
              value={blockEndsOn}
            />
          </div>
        </div>
      </ActionDialog>
    </div>
  );
}

function FolioPanel({
  bookings,
  setNotice,
  onChanged,
}: {
  bookings: Booking[];
  setNotice: (notice: Notice) => void;
  onChanged: () => Promise<void>;
}) {
  const [folioId, setFolioId] = useState("");
  const [documentType, setDocumentType] = useState("INVOICE");
  const [scope, setScope] = useState("COMBINED");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");
  const [documents, setDocuments] = useState<FolioDocument[]>([]);
  const [checkingDocumentId, setCheckingDocumentId] = useState("");
  const selectedBooking = bookings.find(
    (booking) => booking.folioId === folioId,
  );

  useEffect(() => {
    if (!folioId) return;
    const controller = new AbortController();
    void fetch(`/api/staff/folios?folioId=${encodeURIComponent(folioId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          documents?: FolioDocument[];
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(result.error?.message ?? "Dokumen gagal dimuat.");
        setDocuments(result.documents ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Dokumen gagal dimuat.",
        });
      });
    return () => controller.abort();
  }, [folioId, setNotice]);

  async function checkPdf(documentId: string) {
    setCheckingDocumentId(documentId);
    try {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const response = await fetch(
          `/api/staff/financial-documents/${documentId}?status=1`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as
          FolioDocument | { error?: { message?: string } };
        if (!response.ok && response.status !== 202)
          throw new Error(
            "error" in result
              ? (result.error?.message ?? "Status PDF gagal diperiksa.")
              : "Status PDF gagal diperiksa.",
          );
        if ("documentId" in result) {
          setDocuments((current) =>
            current.map((document) =>
              document.documentId === documentId
                ? { ...document, ...result }
                : document,
            ),
          );
          if (result.ready) {
            setNotice({
              tone: "success",
              message: `${human(result.documentType)} ${result.documentNumber ?? ""} siap dibuka dan dicetak.`,
            });
            return;
          }
          if (result.renderStatus === "FAILED") {
            setNotice({
              tone: "error",
              message:
                "Pembuatan PDF gagal. Tekan Buat PDF lagi untuk mengulang proses.",
            });
            return;
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 750));
      }
      setNotice({
        tone: "error",
        message:
          "PDF masih diproses. Gunakan tombol Periksa PDF beberapa saat lagi.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Status PDF gagal diperiksa.",
      });
    } finally {
      setCheckingDocumentId("");
    }
  }

  async function retryPdf(documentId: string) {
    setCheckingDocumentId(documentId);
    try {
      await mutate(`/api/staff/financial-documents/${documentId}`, {
        action: "RETRY_RENDER",
      });
      setDocuments((current) =>
        current.map((document) =>
          document.documentId === documentId
            ? { ...document, renderStatus: "PROCESSING" }
            : document,
        ),
      );
      setNotice({
        tone: "success",
        message: "Pembuatan PDF diulang. Dokumen sedang disiapkan.",
      });
      await checkPdf(documentId);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Pembuatan PDF gagal diulang.",
      });
    } finally {
      setCheckingDocumentId("");
    }
  }

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await mutate("/api/staff/folios", {
        action: "ISSUE_DOCUMENT",
        folioId,
        documentType,
        scope,
        recipientName,
        recipientEmail: recipientEmail || undefined,
        language: "id",
      });
      const documentId = String(result.documentId ?? "");
      const documentNumber = String(result.documentNumber ?? "");
      const supersededDocumentIds = Array.isArray(result.supersededDocumentIds)
        ? result.supersededDocumentIds.map(String)
        : [];
      if (documentId) {
        setDocuments((current) => {
          const history = current
            .filter((document) => document.documentId !== documentId)
            .map((document) =>
              supersededDocumentIds.includes(document.documentId)
                ? { ...document, documentStatus: "SUPERSEDED" }
                : document,
            );
          return [
            {
              documentId,
              documentNumber,
              documentType,
              documentStatus: "ISSUED",
              issuedAt: new Date().toISOString(),
              versionId: String(result.versionId ?? ""),
              versionNumber: 1,
              totalIdr: String(result.totalIdr ?? "0"),
              renderedFileId: null,
              ready: false,
              renderStatus: "PROCESSING",
            },
            ...history,
          ];
        });
        void checkPdf(documentId);
      }
      setNotice({
        tone: "success",
        message: supersededDocumentIds.length
          ? `${human(documentType)} revisi berhasil diterbitkan. Dokumen lama otomatis tidak berlaku.`
          : `${human(documentType)} berhasil diterbitkan. PDF sedang disiapkan.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Dokumen gagal diterbitkan.",
      });
    }
  }
  async function postDamage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedBooking) return;
    if (!amount || Number(amount) < 1) {
      setNotice({
        tone: "error",
        message: "Isi nominal kerusakan yang valid.",
      });
      return;
    }
    try {
      await mutate("/api/staff/operations", {
        action: "ASSESS_DAMAGE",
        reservationId: selectedBooking.id,
        description,
        decision: "APPROVED",
        amountIdr: Number(amount),
        reason,
        serviceDate: new Date().toISOString().slice(0, 10),
      });
      setNotice({
        tone: "success",
        message: "Biaya kerusakan ditambahkan ke folio dan tercatat di audit.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Biaya gagal ditambahkan.",
      });
    }
  }
  async function refund(event: React.FormEvent) {
    event.preventDefault();
    if (!amount || Number(amount) < 1) {
      setNotice({ tone: "error", message: "Isi nominal refund yang valid." });
      return;
    }
    try {
      await mutate("/api/staff/folios", {
        action: "REQUEST_REFUND",
        folioId,
        amountIdr: Number(amount),
        reason,
        destination,
      });
      setNotice({
        tone: "success",
        message: "Refund manual dibuat dan menunggu transfer.",
      });
      await onChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Refund gagal dibuat.",
      });
    }
  }
  return (
    <div className={styles.actionGrid}>
      <section className={`${styles.formCard} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Pilih folio booking</h2>
        </div>
        <div className={styles.staffForm}>
          <div className={styles.fieldGroup}>
            <span>Booking</span>
            <KookaSelect
              ariaLabel="Folio booking"
              onChange={(value) => {
                const booking = bookings.find((item) => item.folioId === value);
                setDocuments([]);
                setFolioId(value);
                setRecipientName(booking?.bookerName ?? "");
                setRecipientEmail(booking?.bookerEmail ?? "");
              }}
              options={bookings
                .filter((booking) => booking.folioId)
                .map((booking) => ({
                  value: booking.folioId ?? "",
                  label: `${booking.bookingCode} — ${booking.bookerName}`,
                  description: folioBookingDescription(booking),
                }))}
              placeholder="Pilih booking"
              value={folioId}
            />
          </div>
        </div>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Terbitkan dokumen</h2>
        </div>
        <form className={styles.staffForm} onSubmit={issue}>
          <div className={styles.formGrid}>
            <div className={styles.fieldGroup}>
              <span>Jenis</span>
              <KookaSelect
                ariaLabel="Jenis dokumen folio"
                onChange={setDocumentType}
                options={[
                  { value: "PROFORMA", label: "Proforma" },
                  { value: "INVOICE", label: "Invoice" },
                  { value: "RECEIPT", label: "Receipt" },
                  { value: "REFUND_NOTE", label: "Refund note" },
                  { value: "FOLIO_STATEMENT", label: "Folio statement" },
                ]}
                value={documentType}
              />
            </div>
            <div className={styles.fieldGroup}>
              <span>Cakupan</span>
              <KookaSelect
                ariaLabel="Cakupan dokumen folio"
                onChange={setScope}
                options={[
                  { value: "COMBINED", label: "Gabungan semua tagihan" },
                  { value: "ROOM_ONLY", label: "Kamar saja" },
                ]}
                value={scope}
              />
            </div>
            <label>
              Nama penerima
              <input
                required
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
              />
            </label>
            <label>
              Email penerima
              <input
                type="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
              />
            </label>
          </div>
          <button
            className={styles.primaryButton}
            disabled={!folioId}
            type="submit"
          >
            {documents.some(
              (document) =>
                document.documentType === documentType &&
                document.documentStatus === "ISSUED",
            )
              ? "Terbitkan PDF revisi"
              : "Terbitkan PDF"}
          </button>
          <p className={styles.inlineHint}>
            Jika ada tambahan tagihan, terbitkan kembali. Invoice terbaru
            menjadi aktif dan invoice sebelumnya tetap tersimpan sebagai arsip
            tidak berlaku.
          </p>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Dokumen yang sudah diterbitkan</h2>
        </div>
        <div className={styles.documentPrintList}>
          {!folioId ? (
            <p className={styles.inlineHint}>Pilih booking terlebih dahulu.</p>
          ) : documents.length === 0 ? (
            <p className={styles.inlineHint}>
              Belum ada invoice atau dokumen untuk booking ini.
            </p>
          ) : (
            documents.map((document) => (
              <article
                className={styles.documentPrintItem}
                key={document.documentId}
              >
                <div>
                  <div className={styles.documentPrintMeta}>
                    <span>{human(document.documentType)}</span>
                    <span
                      className={
                        document.documentStatus === "ISSUED"
                          ? styles.documentStatusActive
                          : styles.documentStatusArchived
                      }
                    >
                      {document.documentStatus === "ISSUED"
                        ? "Aktif"
                        : document.documentStatus === "SUPERSEDED"
                          ? "Tidak berlaku · digantikan"
                          : human(document.documentStatus)}
                    </span>
                  </div>
                  <strong>
                    {document.documentNumber ?? "Nomor sedang disiapkan"}
                  </strong>
                  <small>{formatIdr(document.totalIdr)}</small>
                </div>
                {document.ready ? (
                  <a
                    className={styles.documentPrintButton}
                    href={`/api/staff/financial-documents/${document.documentId}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {document.documentStatus === "ISSUED"
                      ? "Buka & print PDF"
                      : "Buka arsip PDF"}
                  </a>
                ) : (
                  <button
                    className={styles.secondaryButton}
                    disabled={checkingDocumentId === document.documentId}
                    onClick={() =>
                      void (document.renderStatus === "FAILED"
                        ? retryPdf(document.documentId)
                        : checkPdf(document.documentId))
                    }
                    type="button"
                  >
                    {checkingDocumentId === document.documentId
                      ? "Menyiapkan PDF…"
                      : document.renderStatus === "FAILED"
                        ? "Buat PDF lagi"
                        : "Periksa PDF"}
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Biaya kerusakan</h2>
        </div>
        <form className={styles.staffForm} onSubmit={postDamage}>
          <label>
            Barang / kerusakan
            <input
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Nominal IDR
            <MoneyInput
              ariaLabel="Nominal biaya kerusakan"
              onChange={setAmount}
              required
              value={amount}
            />
          </label>
          <label>
            Alasan / pemeriksaan
            <textarea
              required
              minLength={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={!folioId}
            type="submit"
          >
            Tambahkan ke folio
          </button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Refund manual</h2>
        </div>
        <form className={styles.staffForm} onSubmit={refund}>
          <label>
            Nominal IDR
            <MoneyInput
              ariaLabel="Nominal refund manual"
              onChange={setAmount}
              required
              value={amount}
            />
          </label>
          <label>
            Tujuan transfer
            <input
              required
              placeholder="Bank, nama, dan nomor rekening"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </label>
          <label>
            Alasan
            <textarea
              required
              minLength={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={!folioId}
            type="submit"
          >
            Buat refund
          </button>
        </form>
      </section>
    </div>
  );
}
