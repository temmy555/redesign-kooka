"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  PublicDisplayCurrency,
  PublicLocale,
} from "../../src/modules/content/contracts";
import KookaLogo from "../KookaLogo";

interface PublicOffer {
  ratePlanCode: string;
  ratePlanNameId: string;
  ratePlanNameEn: string;
  nightlyFromIdr: number;
  estimatedStayIdr: number;
}

export interface AvailabilityRoom {
  id: string;
  code: string;
  nameId: string;
  nameEn: string;
  maximumAdults: number;
  maximumChildren: number;
  maximumTotalGuests: number;
  extraBedAllowed: boolean;
  maximumExtraBeds: number;
  extraBedCapacityIncrement: number;
  availableRooms: number;
  available: boolean;
  offer: PublicOffer | null;
}

export interface AvailabilityResponse {
  checkInDate: string;
  checkoutDate: string;
  nights: number;
  requestedRooms: number;
  roomTypes: AvailabilityRoom[];
}

export interface SearchInput {
  checkInDate: string;
  checkoutDate: string;
  rooms: number;
  adults: number;
  children: number;
  infants: number;
  locale: PublicLocale;
  currency: PublicDisplayCurrency;
}

interface Policy {
  id: string;
  type: string;
  titleId: string;
  titleEn: string;
  summaryId: string | null;
  summaryEn: string | null;
  contentId: string;
  contentEn: string;
}

interface QuoteResponse {
  quoteId: string;
  totalIdr: number;
  displayCurrency: PublicDisplayCurrency;
  displayTotal: number;
  displayEstimated: boolean;
  expiresAt: string;
  policies: Policy[];
}

interface ReservationResponse {
  reservationId: string;
  bookingCode: string;
  status: string;
  totalIdr: number;
  requiredPaymentIdr: number;
  paymentDeadlineAt: string | null;
  paymentInstructions: Array<{
    paymentInstructionVersionId?: string;
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    accountNumberLast4: string;
    instruction: string;
  }>;
  paymentInstruction?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    accountNumberLast4: string;
    instruction: string;
  } | null;
}

interface RoomSelection {
  roomTypeId: string;
  adults: number;
  children: number;
  infants: number;
  extraBedQuantity: number;
}

const roomImages = [
  "/images/agoda-kooka/room-mezzanine-guestroom.jpg",
  "/images/agoda-kooka/room-two-bedroom-villa-bed.jpg",
  "/images/agoda-kooka/room-generic-01.jpg",
  "/images/agoda-kooka/room-generic-02.jpg",
];

const AVAILABILITY_REFRESH_MS = 15_000;

function idempotencyKey(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function money(value: number, currency: string = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(value);
}

function dateLabel(value: string, locale: PublicLocale) {
  const date = new Date(`${value}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-AU" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function dateTimeLabel(value: string | null, locale: PublicLocale) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-AU" : "id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

async function responseJson<T>(
  response: Response,
  fallback = "Request failed",
): Promise<T> {
  const body = (await response.json()) as T & {
    error?: { message?: string; code?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.message ?? fallback);
  }
  return body;
}

function distribute(total: number, rooms: number, minimum = 0) {
  const values = Array.from({ length: rooms }, () => minimum);
  let remaining = total - minimum * rooms;
  for (let index = 0; remaining > 0; index = (index + 1) % rooms) {
    values[index] = (values[index] ?? 0) + 1;
    remaining -= 1;
  }
  return values;
}

function roomSelections(search: SearchInput, room: AvailabilityRoom) {
  if (search.adults < search.rooms) {
    throw new Error(
      search.locale === "id"
        ? "Setiap kamar memerlukan minimal satu tamu dewasa."
        : "Each room requires at least one adult guest.",
    );
  }
  const adults = distribute(search.adults, search.rooms, 1);
  const children = distribute(search.children, search.rooms);
  const infants = distribute(search.infants, search.rooms);
  return adults.map((adultCount, index): RoomSelection => {
    const childCount = children[index] ?? 0;
    const capacityExcess = Math.max(
      0,
      adultCount - room.maximumAdults,
      adultCount + childCount - room.maximumTotalGuests,
    );
    const increment = Math.max(1, room.extraBedCapacityIncrement);
    const extraBedQuantity = Math.ceil(capacityExcess / increment);
    if (
      childCount > room.maximumChildren ||
      extraBedQuantity > room.maximumExtraBeds ||
      (extraBedQuantity > 0 && !room.extraBedAllowed)
    ) {
      throw new Error(
        search.locale === "id"
          ? "Jumlah tamu melebihi kapasitas tipe kamar ini. Pilih tipe kamar lain atau ubah pencarian."
          : "The guest count exceeds this room type's capacity. Choose another room type or change your search.",
      );
    }
    return {
      roomTypeId: room.id,
      adults: adultCount,
      children: childCount,
      infants: infants[index] ?? 0,
      extraBedQuantity,
    };
  });
}

export async function loadAvailability(
  search: SearchInput,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<AvailabilityResponse> {
  const params = new URLSearchParams({
    checkInDate: search.checkInDate,
    checkoutDate: search.checkoutDate,
    rooms: String(search.rooms),
    adults: String(search.adults),
    children: String(search.children),
    infants: String(search.infants),
  });
  return responseJson<AvailabilityResponse>(
    await fetcher(`/api/booking/availability?${params}`, {
      signal,
      headers: { accept: "application/json" },
    }),
    "Availability search failed",
  );
}

export function BookingResultContent({
  search,
  result,
  loading,
  error,
  onSelect,
  selectingRoomId,
}: {
  search: SearchInput;
  result: AvailabilityResponse | null;
  loading: boolean;
  error: string;
  onSelect?: (room: AvailabilityRoom) => void;
  selectingRoomId?: string | null;
}) {
  return (
    <section className="booking-results" aria-live="polite">
      {!loading && result?.roomTypes.length ? (
        <div className="booking-results-intro">
          <div>
            <p className="eyebrow">
              {search.locale === "id" ? "Kamar tersedia" : "Available rooms"}
            </p>
            <h2>
              {search.locale === "id"
                ? "Pilih ruang untuk beristirahat"
                : "Choose your place to unwind"}
            </h2>
          </div>
          <p>
            {search.locale === "id"
              ? "Harga final dihitung sebelum Anda mengisi data tamu. Nomor kamar ditentukan Front Office menjelang kedatangan."
              : "Your final price is calculated before guest details. The room number is assigned by Front Office closer to arrival."}
          </p>
        </div>
      ) : null}
      {loading ? (
        <div className="booking-state">
          <span className="loading-dot" />
          {search.locale === "id"
            ? "Memeriksa kamar untuk tanggal Anda…"
            : "Checking rooms for your dates…"}
        </div>
      ) : null}
      {error ? <div className="booking-state error-state">{error}</div> : null}
      {result
        ? result.roomTypes.map((room, index) => {
            const name = search.locale === "en" ? room.nameEn : room.nameId;
            const canBook = room.available && Boolean(room.offer);
            return (
              <article
                className={`availability-card ${canBook ? "" : "is-unavailable"}`}
                key={room.id}
              >
                <div className="availability-card-image">
                  <Image
                    src={roomImages[index % roomImages.length]!}
                    alt={name}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 760px) 100vw, 42vw"
                  />
                  <span>{room.code}</span>
                </div>
                <div className="availability-card-copy">
                  <div>
                    <p className="room-meta">
                      {canBook
                        ? search.locale === "id"
                          ? `${room.availableRooms} kamar tersedia`
                          : `${room.availableRooms} rooms available`
                        : room.offer && room.availableRooms === 0
                          ? search.locale === "id"
                            ? "Sedang ditahan sementara"
                            : "Temporarily held"
                          : room.offer &&
                              room.availableRooms < result.requestedRooms
                            ? search.locale === "id"
                              ? `Hanya ${room.availableRooms} kamar tersedia`
                              : `Only ${room.availableRooms} rooms available`
                            : search.locale === "id"
                              ? "Belum dapat dipesan"
                              : "Not bookable yet"}
                    </p>
                    <h3>{name}</h3>
                    <p className="room-capacity">
                      {search.locale === "id"
                        ? `Maksimal ${room.maximumTotalGuests} tamu`
                        : `Up to ${room.maximumTotalGuests} guests`}
                      {room.extraBedAllowed
                        ? search.locale === "id"
                          ? ` · Extra bed hingga ${room.maximumExtraBeds}`
                          : ` · Up to ${room.maximumExtraBeds} extra bed`
                        : ""}
                    </p>
                  </div>
                  <div className="availability-card-action">
                    {room.offer ? (
                      <div className="room-price">
                        <small>
                          {search.locale === "id"
                            ? `Mulai per malam`
                            : "From per night"}
                        </small>
                        <strong>{money(room.offer.nightlyFromIdr)}</strong>
                        <span>
                          {search.locale === "id"
                            ? "Pembayaran resmi dalam IDR"
                            : "Official payment in IDR"}
                        </span>
                      </div>
                    ) : (
                      <p className="room-rate-missing">
                        {search.locale === "id"
                          ? "Tarif online belum dikonfigurasi."
                          : "The online rate is not configured yet."}
                      </p>
                    )}
                    <button
                      className="button"
                      type="button"
                      disabled={!canBook || selectingRoomId === room.id}
                      onClick={() => onSelect?.(room)}
                    >
                      {selectingRoomId === room.id
                        ? search.locale === "id"
                          ? "Menghitung…"
                          : "Calculating…"
                        : search.locale === "id"
                          ? "Pilih kamar"
                          : "Select room"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        : null}
      {result && result.roomTypes.length === 0 ? (
        <div className="booking-state">
          {search.locale === "id"
            ? "Belum ada tipe kamar aktif untuk tanggal tersebut."
            : "No active room type is available for those dates yet."}
        </div>
      ) : null}
    </section>
  );
}

function BookingConfirmation({
  reservation,
  email,
  locale,
}: {
  reservation: ReservationResponse;
  email: string;
  locale: PublicLocale;
}) {
  const paymentInstructions = reservation.paymentInstructions?.length
    ? reservation.paymentInstructions
    : reservation.paymentInstruction
      ? [reservation.paymentInstruction]
      : [];
  const message =
    locale === "id"
      ? `Halo KOOKA, saya sudah melakukan transfer untuk booking ${reservation.bookingCode} sebesar ${money(reservation.requiredPaymentIdr)}. Saya akan mengirimkan bukti transfer pada chat ini.`
      : `Hello KOOKA, I have transferred ${money(reservation.requiredPaymentIdr)} for booking ${reservation.bookingCode}. I will send the payment proof in this chat.`;
  const whatsappUrl = `https://wa.me/6283831455142?text=${encodeURIComponent(message)}`;
  return (
    <main className="booking-page booking-success-page">
      <header className="booking-header">
        <Link className="brand" href="/" aria-label="KOOKA Residence home">
          <KookaLogo
            className="brand-logo"
            priority
            sizes="(max-width: 560px) 118px, 146px"
          />
        </Link>
        <span className="booking-secure-label">Direct booking · secure</span>
      </header>
      <section className="booking-success-hero">
        <p className="eyebrow">
          {locale === "id" ? "Booking berhasil dibuat" : "Booking created"}
        </p>
        <h1>
          {locale === "id"
            ? "Kamar Anda sedang kami tahan."
            : "Your room is being held."}
        </h1>
        <p>
          {locale === "id"
            ? "Selesaikan transfer sebelum batas waktu, lalu kirim bukti pembayaran ke WhatsApp KOOKA."
            : "Complete the transfer before the deadline, then send your payment proof to KOOKA via WhatsApp."}
        </p>
      </section>
      <section className="booking-confirmation-grid">
        <article className="booking-code-card">
          <span>{locale === "id" ? "Kode booking" : "Booking code"}</span>
          <strong>{reservation.bookingCode}</strong>
          <p>
            {locale === "id"
              ? "Simpan kode ini. Anda memerlukannya bersama email untuk melihat booking kembali."
              : "Keep this code. You will need it with your email to retrieve the booking."}
          </p>
        </article>
        <article className="transfer-card">
          <p className="eyebrow">
            {locale === "id" ? "Transfer bank" : "Bank transfer"}
          </p>
          <div className="transfer-amount">
            <small>{locale === "id" ? "Bayar penuh" : "Pay in full"}</small>
            <strong>{money(reservation.requiredPaymentIdr)}</strong>
          </div>
          <dl>
            <div>
              <dt>
                {locale === "id" ? "Batas pembayaran" : "Payment deadline"}
              </dt>
              <dd>
                {dateTimeLabel(reservation.paymentDeadlineAt, locale)} WIB
              </dd>
            </div>
          </dl>
          <p className="transfer-choice-label">
            {locale === "id"
              ? "Pilih salah satu rekening KOOKA berikut:"
              : "Choose any KOOKA account below:"}
          </p>
          <div className="transfer-account-list">
            {paymentInstructions.map((instruction, index) => (
              <div
                className="transfer-account"
                key={`${instruction.bankName}-${instruction.accountNumberLast4}-${index}`}
              >
                <strong>{instruction.bankName}</strong>
                <span>{instruction.accountNumber}</span>
                <small>{instruction.accountHolder}</small>
                {instruction.instruction ? (
                  <p>{instruction.instruction}</p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
        <article className="payment-steps-card">
          <p className="eyebrow">
            {locale === "id" ? "Langkah berikutnya" : "Next steps"}
          </p>
          <ol>
            <li>
              <span>1</span>
              <p>
                {locale === "id"
                  ? "Transfer tepat sejumlah tagihan ke salah satu rekening di atas."
                  : "Transfer the exact amount to any account above."}
              </p>
            </li>
            <li>
              <span>2</span>
              <p>
                {locale === "id"
                  ? "Buka WhatsApp dan kirim kode booking serta bukti transfer."
                  : "Open WhatsApp and send the booking code with payment proof."}
              </p>
            </li>
            <li>
              <span>3</span>
              <p>
                {locale === "id"
                  ? "Front Office memverifikasi pembayaran dan mengonfirmasi booking."
                  : "Front Office verifies the payment and confirms the booking."}
              </p>
            </li>
          </ol>
          <a
            className="button whatsapp-button"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            {locale === "id"
              ? "Kirim bukti via WhatsApp"
              : "Send proof via WhatsApp"}
          </a>
          <Link
            className="text-link"
            href={`/booking/lookup?code=${encodeURIComponent(reservation.bookingCode)}`}
          >
            {locale === "id" ? "Lihat booking saya" : "View my booking"}
          </Link>
          <small>{email}</small>
        </article>
      </section>
    </main>
  );
}

export default function BookingResults({ search }: { search: SearchInput }) {
  const [result, setResult] = useState<AvailabilityResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<AvailabilityRoom | null>(
    null,
  );
  const [selections, setSelections] = useState<RoomSelection[]>([]);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [selectingRoomId, setSelectingRoomId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<ReservationResponse | null>(
    null,
  );
  const [booker, setBooker] = useState({ name: "", email: "", phone: "" });
  const [acknowledged, setAcknowledged] = useState<string[]>([]);

  useEffect(() => {
    if (quote) return;
    const controller = new AbortController();
    let requestInFlight = false;

    async function refreshAvailability(initial: boolean) {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const nextResult = await loadAvailability(search, controller.signal);
        setResult(nextResult);
        setError("");
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          if (initial) {
            setError(
              search.locale === "id"
                ? "Ketersediaan belum dapat dimuat. Silakan coba kembali."
                : "Availability could not be loaded. Please try again.",
            );
          }
        }
      } finally {
        requestInFlight = false;
        if (initial) setLoading(false);
      }
    }

    void refreshAvailability(true);
    const interval = window.setInterval(
      () => void refreshAvailability(false),
      AVAILABILITY_REFRESH_MS,
    );
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [quote, search]);

  const displayStay = useMemo(
    () =>
      `${dateLabel(search.checkInDate, search.locale)} — ${dateLabel(search.checkoutDate, search.locale)}`,
    [search.checkInDate, search.checkoutDate, search.locale],
  );

  async function selectRoom(room: AvailabilityRoom) {
    if (!room.offer) return;
    setQuoteError("");
    setSelectingRoomId(room.id);
    try {
      const nextSelections = roomSelections(search, room);
      const nextQuote = await responseJson<QuoteResponse>(
        await fetch("/api/booking/quote", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey("public-quote"),
          },
          body: JSON.stringify({
            checkInDate: search.checkInDate,
            checkoutDate: search.checkoutDate,
            ratePlanCode: room.offer.ratePlanCode,
            language: search.locale,
            displayCurrency: search.currency,
            rooms: nextSelections,
          }),
        }),
      );
      setSelectedRoom(room);
      setSelections(nextSelections);
      setQuote(nextQuote);
      setAcknowledged([]);
      requestAnimationFrame(() =>
        document
          .getElementById("guest-details")
          ?.scrollIntoView({ behavior: "smooth" }),
      );
    } catch (reason) {
      setQuoteError(
        reason instanceof Error
          ? reason.message
          : search.locale === "id"
            ? "Harga belum dapat dihitung."
            : "The price could not be calculated.",
      );
    } finally {
      setSelectingRoomId(null);
    }
  }

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) return;
    if (acknowledged.length !== quote.policies.length) {
      setQuoteError(
        search.locale === "id"
          ? "Baca dan setujui seluruh kebijakan sebelum membuat booking."
          : "Please read and accept all policies before booking.",
      );
      return;
    }
    setSubmitting(true);
    setQuoteError("");
    try {
      const created = await responseJson<ReservationResponse>(
        await fetch("/api/booking/reservations", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey("public-reservation"),
          },
          body: JSON.stringify({
            quoteId: quote.quoteId,
            booker: {
              name: booker.name,
              email: booker.email,
              phone: booker.phone || null,
            },
            acknowledgedPolicyVersionIds: acknowledged,
          }),
        }),
      );
      setReservation(created);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setQuoteError(
        reason instanceof Error
          ? reason.message
          : search.locale === "id"
            ? "Booking belum dapat dibuat. Coba kembali."
            : "The booking could not be created. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (reservation) {
    return (
      <BookingConfirmation
        reservation={reservation}
        email={booker.email}
        locale={search.locale}
      />
    );
  }

  return (
    <main className="booking-page">
      <header className="booking-header">
        <Link className="brand" href="/" aria-label="KOOKA Residence home">
          <KookaLogo
            className="brand-logo"
            priority
            sizes="(max-width: 560px) 118px, 146px"
          />
        </Link>
        <Link className="booking-back" href="/#availability">
          ← {search.locale === "id" ? "Ubah pencarian" : "Change search"}
        </Link>
      </header>

      <section className="booking-summary">
        <p className="eyebrow">Direct booking · {search.currency}</p>
        <h1>
          {search.locale === "id" ? "Temukan jeda Anda." : "Find your pause."}
        </h1>
        <p className="booking-summary-lead">
          {search.locale === "id"
            ? "Pilih tipe kamar, lengkapi data tamu, lalu dapatkan kode booking dan instruksi transfer langsung dari sistem."
            : "Choose a room, enter guest details, then receive your booking code and transfer instructions instantly."}
        </p>
        <div className="stay-facts">
          <span>
            <small>Check-in</small>
            <strong>{dateLabel(search.checkInDate, search.locale)}</strong>
          </span>
          <span>
            <small>Check-out</small>
            <strong>{dateLabel(search.checkoutDate, search.locale)}</strong>
          </span>
          <span>
            <small>{search.locale === "id" ? "Tamu" : "Guests"}</small>
            <strong>{search.adults + search.children}</strong>
          </span>
          <span>
            <small>{search.locale === "id" ? "Kamar" : "Rooms"}</small>
            <strong>{search.rooms}</strong>
          </span>
        </div>
      </section>

      <BookingResultContent
        search={search}
        result={result}
        loading={loading}
        error={error}
        onSelect={selectRoom}
        selectingRoomId={selectingRoomId}
      />

      {quoteError && !quote ? (
        <div className="booking-inline-error">{quoteError}</div>
      ) : null}

      {quote && selectedRoom ? (
        <section className="guest-checkout" id="guest-details">
          <div className="guest-checkout-summary">
            <p className="eyebrow">
              {search.locale === "id" ? "Pilihan Anda" : "Your selection"}
            </p>
            <h2>
              {search.locale === "en"
                ? selectedRoom.nameEn
                : selectedRoom.nameId}
            </h2>
            <p>{displayStay}</p>
            <dl>
              <div>
                <dt>{search.locale === "id" ? "Kamar" : "Rooms"}</dt>
                <dd>{selections.length}</dd>
              </div>
              <div>
                <dt>
                  {search.locale === "id" ? "Total resmi" : "Official total"}
                </dt>
                <dd>{money(quote.totalIdr)}</dd>
              </div>
              {quote.displayEstimated ? (
                <div>
                  <dt>
                    {search.locale === "id"
                      ? "Estimasi tampilan"
                      : "Display estimate"}
                  </dt>
                  <dd>{money(quote.displayTotal, quote.displayCurrency)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="quote-expiry">
              {search.locale === "id"
                ? `Harga dan kamar ditahan sampai ${dateTimeLabel(quote.expiresAt, search.locale)} WIB.`
                : `This price and room are held until ${dateTimeLabel(quote.expiresAt, search.locale)} WIB.`}
            </p>
          </div>
          <form className="guest-details-form" onSubmit={createReservation}>
            <p className="eyebrow">
              {search.locale === "id" ? "Data pemesan" : "Booker details"}
            </p>
            <h2>
              {search.locale === "id" ? "Hampir selesai." : "Almost there."}
            </h2>
            <div className="booking-form-grid">
              <label className="full-field">
                <span>
                  {search.locale === "id" ? "Nama lengkap" : "Full name"}
                </span>
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  autoComplete="name"
                  value={booker.name}
                  onChange={(event) =>
                    setBooker({ ...booker, name: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  required
                  type="email"
                  maxLength={320}
                  autoComplete="email"
                  value={booker.email}
                  onChange={(event) =>
                    setBooker({ ...booker, email: event.target.value })
                  }
                />
              </label>
              <label>
                <span>
                  {search.locale === "id"
                    ? "Nomor WhatsApp"
                    : "WhatsApp number"}
                </span>
                <input
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  placeholder="+62"
                  value={booker.phone}
                  onChange={(event) =>
                    setBooker({ ...booker, phone: event.target.value })
                  }
                />
              </label>
            </div>
            {quote.policies.map((policy) => (
              <label className="policy-check" key={policy.id}>
                <input
                  type="checkbox"
                  checked={acknowledged.includes(policy.id)}
                  onChange={(event) =>
                    setAcknowledged((current) =>
                      event.target.checked
                        ? [...current, policy.id]
                        : current.filter((id) => id !== policy.id),
                    )
                  }
                />
                <span>
                  <strong>
                    {search.locale === "en" ? policy.titleEn : policy.titleId}
                  </strong>
                  <small>
                    {search.locale === "en"
                      ? policy.summaryEn || policy.contentEn
                      : policy.summaryId || policy.contentId}
                  </small>
                </span>
              </label>
            ))}
            <div className="manual-payment-note">
              <strong>
                {search.locale === "id"
                  ? "Pembayaran 100% melalui transfer bank"
                  : "100% payment by bank transfer"}
              </strong>
              <p>
                {search.locale === "id"
                  ? "Setelah booking dibuat, sistem menampilkan rekening dan kode booking. WhatsApp digunakan setelahnya untuk mengirim bukti bayar."
                  : "After booking, the system shows the bank account and booking code. WhatsApp is only used afterward to send payment proof."}
              </p>
            </div>
            {quoteError ? <div className="form-error">{quoteError}</div> : null}
            <button
              className="button booking-submit"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? search.locale === "id"
                  ? "Membuat booking…"
                  : "Creating booking…"
                : search.locale === "id"
                  ? `Buat booking · ${money(quote.totalIdr)}`
                  : `Book now · ${money(quote.totalIdr)}`}
            </button>
            <small className="booking-privacy">
              {search.locale === "id"
                ? "Tidak perlu membuat akun. Booking dapat dilihat kembali menggunakan kode booking dan email."
                : "No account is needed. Retrieve your booking later using the booking code and email."}
            </small>
          </form>
        </section>
      ) : null}

      <p className="booking-currency-note">
        {search.locale === "id"
          ? `Preferensi tampilan ${search.currency}; seluruh pembayaran resmi diproses dalam IDR.`
          : `${search.currency} is your display preference; all official payments are processed in IDR.`}
      </p>
    </main>
  );
}
