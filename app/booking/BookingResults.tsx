"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  PublicDisplayCurrency,
  PublicLocale,
} from "../../src/modules/content/contracts";
import KookaLogo from "../KookaLogo";
import {
  nextPublicDate,
  publicDateFromToday,
  PublicDateField,
  PublicSelect,
} from "../PublicFormControls";
import PaymentCountdown from "./PaymentCountdown";

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

export function BookingSearchForm({ search }: { search: SearchInput }) {
  const [checkInDate, setCheckInDate] = useState(search.checkInDate);
  const [checkoutDate, setCheckoutDate] = useState(search.checkoutDate);
  const [adults, setAdults] = useState(String(search.adults));
  const [rooms, setRooms] = useState(String(search.rooms));
  const locale = search.locale;
  const adultOptions = Array.from({ length: 6 }, (_, index) => {
    const value = String(index + 1);
    return { value, label: value };
  });
  const roomOptions = Array.from({ length: 4 }, (_, index) => {
    const value = String(index + 1);
    return { value, label: value };
  });

  return (
    <form className="booking-search-panel" action="/booking" method="get">
      <input name="locale" type="hidden" value={search.locale} />
      <input name="currency" type="hidden" value={search.currency} />
      <input name="children" type="hidden" value={search.children} />
      <input name="infants" type="hidden" value={search.infants} />
      <label className="booking-search-field">
        <small>Check-in</small>
        <PublicDateField
          ariaLabel="Check-in"
          locale={locale}
          min={publicDateFromToday(0)}
          name="checkInDate"
          onChange={(next) => {
            setCheckInDate(next);
            if (checkoutDate <= next) setCheckoutDate(nextPublicDate(next));
          }}
          value={checkInDate}
        />
      </label>
      <label className="booking-search-field">
        <small>Check-out</small>
        <PublicDateField
          ariaLabel="Check-out"
          locale={locale}
          min={nextPublicDate(checkInDate)}
          name="checkoutDate"
          onChange={setCheckoutDate}
          value={checkoutDate}
        />
      </label>
      <label className="booking-search-field">
        <small>{locale === "id" ? "Tamu" : "Guests"}</small>
        <PublicSelect
          ariaLabel={locale === "id" ? "Jumlah tamu" : "Number of guests"}
          name="adults"
          onChange={(next) => {
            setAdults(next);
            if (Number(rooms) > Number(next)) setRooms(next);
          }}
          options={adultOptions}
          value={adults}
        />
      </label>
      <label className="booking-search-field">
        <small>{locale === "id" ? "Kamar" : "Rooms"}</small>
        <PublicSelect
          ariaLabel={locale === "id" ? "Jumlah kamar" : "Number of rooms"}
          name="rooms"
          onChange={(next) => {
            setRooms(next);
            if (Number(adults) < Number(next)) setAdults(next);
          }}
          options={roomOptions}
          value={rooms}
        />
      </label>
      <button className="booking-change-search" type="submit">
        {locale === "id" ? "Perbarui hasil" : "Update results"} →
      </button>
    </form>
  );
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
  netAmountIdr: number;
  serviceChargeIdr: number;
  taxIdr: number;
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
  ratePlanCode: string;
  adults: number;
  children: number;
  infants: number;
  extraBedQuantity: number;
}

const roomImages = [
  "/images/kooka-assets/ark-05044.jpg",
  "/images/kooka-assets/ark-05050.jpg",
  "/images/kooka-assets/ark-05060.jpg",
  "/images/kooka-assets/ark-05070.jpg",
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

function requiredExtraBeds(
  room: AvailabilityRoom,
  adults: number,
  children: number,
) {
  const capacityExcess = Math.max(
    0,
    adults - room.maximumAdults,
    adults + children - room.maximumTotalGuests,
  );
  const increment = Math.max(1, room.extraBedCapacityIncrement);
  return Math.ceil(capacityExcess / increment);
}

function roomCanHold(room: AvailabilityRoom, adults: number, children: number) {
  const extraBedQuantity = requiredExtraBeds(room, adults, children);
  return (
    children <= room.maximumChildren &&
    extraBedQuantity <= room.maximumExtraBeds &&
    (extraBedQuantity === 0 || room.extraBedAllowed)
  );
}

export function roomSelections(
  search: SearchInput,
  selectedRooms: AvailabilityRoom[],
) {
  if (selectedRooms.length !== search.rooms) {
    throw new Error(
      search.locale === "id"
        ? `Pilih tepat ${search.rooms} kamar untuk melanjutkan.`
        : `Select exactly ${search.rooms} rooms to continue.`,
    );
  }
  if (search.adults < search.rooms) {
    throw new Error(
      search.locale === "id"
        ? "Setiap kamar memerlukan minimal satu tamu dewasa."
        : "Each room requires at least one adult guest.",
    );
  }
  const occupants = selectedRooms.map((room) => ({
    room,
    adults: 1,
    children: 0,
  }));
  let adultsRemaining = search.adults - selectedRooms.length;
  while (adultsRemaining > 0) {
    const candidate = occupants
      .filter(({ room, adults, children }) =>
        roomCanHold(room, adults + 1, children),
      )
      .sort((left, right) => {
        const leftCapacity =
          left.room.maximumTotalGuests - left.adults - left.children;
        const rightCapacity =
          right.room.maximumTotalGuests - right.adults - right.children;
        return rightCapacity - leftCapacity;
      })[0];
    if (!candidate) {
      throw new Error(
        search.locale === "id"
          ? "Kombinasi kamar yang dipilih tidak mencukupi jumlah tamu. Pilih tipe kamar lain."
          : "The selected room combination cannot accommodate all guests. Choose another room type.",
      );
    }
    candidate.adults += 1;
    adultsRemaining -= 1;
  }
  let childrenRemaining = search.children;
  while (childrenRemaining > 0) {
    const candidate = occupants
      .filter(({ room, adults, children }) =>
        roomCanHold(room, adults, children + 1),
      )
      .sort((left, right) => {
        const leftCapacity =
          left.room.maximumTotalGuests - left.adults - left.children;
        const rightCapacity =
          right.room.maximumTotalGuests - right.adults - right.children;
        return rightCapacity - leftCapacity;
      })[0];
    if (!candidate) {
      throw new Error(
        search.locale === "id"
          ? "Kombinasi kamar yang dipilih tidak mencukupi jumlah tamu anak. Pilih tipe kamar lain."
          : "The selected room combination cannot accommodate all children. Choose another room type.",
      );
    }
    candidate.children += 1;
    childrenRemaining -= 1;
  }
  const infants = distribute(search.infants, search.rooms);
  return occupants.map(({ room, adults, children }, index): RoomSelection => {
    const extraBedQuantity = requiredExtraBeds(room, adults, children);
    return {
      roomTypeId: room.id,
      ratePlanCode: room.offer!.ratePlanCode,
      adults,
      children,
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
  selectedRoomCounts = {},
  onChangeSelection,
  onContinue,
  selectionPending = false,
  selectionLocked = false,
}: {
  search: SearchInput;
  result: AvailabilityResponse | null;
  loading: boolean;
  error: string;
  selectedRoomCounts?: Record<string, number>;
  onChangeSelection?: (room: AvailabilityRoom, delta: -1 | 1) => void;
  onContinue?: () => void;
  selectionPending?: boolean;
  selectionLocked?: boolean;
}) {
  const selectedTotal = Object.values(selectedRoomCounts).reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const selectedLabels =
    result?.roomTypes
      .filter((room) => (selectedRoomCounts[room.id] ?? 0) > 0)
      .map((room) => ({
        id: room.id,
        name: search.locale === "en" ? room.nameEn : room.nameId,
        quantity: selectedRoomCounts[room.id] ?? 0,
      })) ?? [];
  return (
    <section className="booking-results" aria-live="polite">
      {!loading && result?.roomTypes.length ? (
        <div className="booking-results-intro">
          <div>
            <p className="eyebrow">
              {search.locale === "id"
                ? `${result.roomTypes.length} pilihan kamar`
                : `${result.roomTypes.length} room options`}
            </p>
            <h2>
              {search.locale === "id"
                ? "Kamar untuk masa tinggal Anda"
                : "Rooms for your stay"}
            </h2>
          </div>
          <p>
            {search.locale === "id"
              ? "Pilih jenis kamar yang sesuai. Nomor kamar fisik akan disiapkan Front Office menjelang kedatangan."
              : "Choose the room type that suits you. Your physical room number will be prepared by Front Office closer to arrival."}
          </p>
        </div>
      ) : null}
      {!loading && result?.roomTypes.length ? (
        <div className="booking-selection-tray">
          <div>
            <span>
              {search.locale === "id"
                ? `${selectedTotal} dari ${result.requestedRooms} kamar dipilih`
                : `${selectedTotal} of ${result.requestedRooms} rooms selected`}
            </span>
            <div className="booking-selection-items">
              {selectedLabels.length
                ? selectedLabels.map((item) => (
                    <small key={item.id}>
                      {item.quantity}× {item.name}
                    </small>
                  ))
                : search.locale === "id"
                  ? "Anda dapat menggabungkan tipe kamar yang berbeda."
                  : "You may combine different room types."}
            </div>
          </div>
          <button
            className="button"
            disabled={
              selectionLocked ||
              selectionPending ||
              selectedTotal !== result.requestedRooms
            }
            onClick={onContinue}
            type="button"
          >
            {selectionPending
              ? search.locale === "id"
                ? "Menghitung…"
                : "Calculating…"
              : selectionLocked
                ? search.locale === "id"
                  ? "Pilihan dikonfirmasi"
                  : "Selection confirmed"
                : search.locale === "id"
                  ? "Lanjutkan"
                  : "Continue"}
          </button>
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
            const selectedCount = selectedRoomCounts[room.id] ?? 0;
            const canSelect = room.availableRooms > 0 && Boolean(room.offer);
            const canIncrease =
              canSelect &&
              !selectionLocked &&
              selectedCount < room.availableRooms &&
              selectedTotal < result.requestedRooms;
            return (
              <article
                className={`availability-card ${canSelect ? "" : "is-unavailable"} ${selectedCount ? "is-selected" : ""}`}
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
                  <span>KOOKA Residence · {name}</span>
                </div>
                <div className="availability-card-copy">
                  <div>
                    <p className="room-meta">
                      {canSelect
                        ? search.locale === "id"
                          ? `${room.availableRooms} kamar tersedia`
                          : `${room.availableRooms} ${room.availableRooms === 1 ? "room" : "rooms"} available`
                        : room.offer && room.availableRooms === 0
                          ? search.locale === "id"
                            ? "Tidak tersedia pada tanggal ini"
                            : "Unavailable for selected dates"
                          : search.locale === "id"
                            ? "Tidak tersedia untuk booking online"
                            : "Unavailable for online booking"}
                    </p>
                    <h3>{name}</h3>
                    <ul className="availability-features">
                      <li>
                        {search.locale === "id"
                          ? `Maks. ${room.maximumTotalGuests} tamu`
                          : `Up to ${room.maximumTotalGuests} guests`}
                      </li>
                      <li>
                        {search.locale === "id"
                          ? `Maks. ${room.maximumAdults} dewasa`
                          : `Up to ${room.maximumAdults} adults`}
                      </li>
                      <li>
                        {room.extraBedAllowed
                          ? search.locale === "id"
                            ? `Extra bed hingga ${room.maximumExtraBeds}`
                            : `Up to ${room.maximumExtraBeds} extra bed`
                          : search.locale === "id"
                            ? "Tanpa extra bed"
                            : "No extra bed"}
                      </li>
                    </ul>
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
                            ? `${result.nights} malam · total ${money(room.offer.estimatedStayIdr)}`
                            : `${result.nights} nights · ${money(room.offer.estimatedStayIdr)} total`}
                        </span>
                        <em className="room-tax-note">
                          {search.locale === "id"
                            ? "Pajak dan biaya layanan, jika berlaku, ditampilkan di ringkasan sebelum booking."
                            : "Taxes and service charges, if applicable, are shown in the summary before booking."}
                        </em>
                      </div>
                    ) : (
                      <p className="room-rate-missing">
                        {search.locale === "id"
                          ? "Kamar ini belum tersedia untuk booking online. Silakan pilih kamar lain."
                          : "This room is not currently available for online booking. Please choose another room."}
                      </p>
                    )}
                    {selectedCount > 0 ? (
                      <div className="room-quantity-control">
                        <button
                          aria-label={
                            search.locale === "id"
                              ? `Kurangi ${name}`
                              : `Remove ${name}`
                          }
                          disabled={selectionLocked}
                          onClick={() => onChangeSelection?.(room, -1)}
                          type="button"
                        >
                          −
                        </button>
                        <span>
                          <strong>{selectedCount}</strong>
                          <small>
                            {search.locale === "id" ? "dipilih" : "selected"}
                          </small>
                        </span>
                        <button
                          aria-label={
                            search.locale === "id"
                              ? `Tambah ${name}`
                              : `Add ${name}`
                          }
                          disabled={!canIncrease}
                          onClick={() => onChangeSelection?.(room, 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        className="button"
                        type="button"
                        disabled={!canIncrease}
                        onClick={() => onChangeSelection?.(room, 1)}
                      >
                        {search.locale === "id"
                          ? canSelect
                            ? "Tambah kamar"
                            : "Tidak tersedia"
                          : canSelect
                            ? "Add room"
                            : "Unavailable"}
                      </button>
                    )}
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

function BookingProgress({
  locale,
  currentStep,
}: {
  locale: PublicLocale;
  currentStep: 2 | 3;
}) {
  const steps =
    locale === "id"
      ? ["Pencarian", "Pilih kamar", "Data tamu", "Pembayaran"]
      : ["Search", "Choose room", "Guest details", "Payment"];
  return (
    <nav
      aria-label={locale === "id" ? "Tahapan booking" : "Booking progress"}
      className="booking-progress"
    >
      <ol>
        {steps.map((step, index) => {
          const number = index + 1;
          return (
            <li
              className={
                number < currentStep
                  ? "is-complete"
                  : number === currentStep
                    ? "is-current"
                    : ""
              }
              key={step}
            >
              <span>{number < currentStep ? "✓" : number}</span>
              <strong>{step}</strong>
            </li>
          );
        })}
      </ol>
    </nav>
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
  const [paymentExpired, setPaymentExpired] = useState(false);
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
          {paymentExpired
            ? locale === "id"
              ? "Waktu pembayaran telah berakhir."
              : "Your payment time has ended."
            : locale === "id"
              ? "Kamar Anda sedang kami tahan."
              : "Your room is being held."}
        </h1>
        <p>
          {paymentExpired
            ? locale === "id"
              ? "Periksa status terbaru melalui View Booking sebelum melakukan tindakan berikutnya."
              : "Check the latest status through View Booking before taking the next step."
            : locale === "id"
              ? "Selesaikan transfer sebelum batas waktu, lalu kirim bukti pembayaran ke WhatsApp KOOKA."
              : "Complete the transfer before the deadline, then send your payment proof to KOOKA via WhatsApp."}
        </p>
        <PaymentCountdown
          deadlineAt={reservation.paymentDeadlineAt}
          locale={locale}
          onExpire={() => setPaymentExpired(true)}
        />
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
  const [selectedRoomCounts, setSelectedRoomCounts] = useState<
    Record<string, number>
  >({});
  const [quotedRooms, setQuotedRooms] = useState<AvailabilityRoom[]>([]);
  const [selections, setSelections] = useState<RoomSelection[]>([]);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [selectionPending, setSelectionPending] = useState(false);
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

  const quotedRoomLabel = useMemo(() => {
    const counts = new Map<string, { room: AvailabilityRoom; count: number }>();
    for (const room of quotedRooms) {
      const current = counts.get(room.id);
      counts.set(room.id, { room, count: (current?.count ?? 0) + 1 });
    }
    return [...counts.values()]
      .map(({ room, count }) => {
        const name = search.locale === "en" ? room.nameEn : room.nameId;
        return `${count}× ${name}`;
      })
      .join(" + ");
  }, [quotedRooms, search.locale]);

  function changeRoomSelection(room: AvailabilityRoom, delta: -1 | 1) {
    if (quote) return;
    setQuoteError("");
    setSelectedRoomCounts((current) => {
      const selectedTotal = Object.values(current).reduce(
        (total, quantity) => total + quantity,
        0,
      );
      const currentCount = current[room.id] ?? 0;
      const nextCount = Math.max(
        0,
        Math.min(room.availableRooms, currentCount + delta),
      );
      if (delta > 0 && selectedTotal >= search.rooms) return current;
      if (nextCount === currentCount) return current;
      const next = { ...current };
      if (nextCount === 0) delete next[room.id];
      else next[room.id] = nextCount;
      return next;
    });
  }

  async function continueWithSelection() {
    if (!result) return;
    const nextRooms = result.roomTypes.flatMap((room) =>
      Array.from({ length: selectedRoomCounts[room.id] ?? 0 }, () => room),
    );
    if (nextRooms.length !== search.rooms) return;
    setQuoteError("");
    setSelectionPending(true);
    try {
      const nextSelections = roomSelections(search, nextRooms);
      const fallbackRatePlanCode = nextRooms[0]?.offer?.ratePlanCode;
      if (!fallbackRatePlanCode) return;
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
            ratePlanCode: fallbackRatePlanCode,
            language: search.locale,
            displayCurrency: search.currency,
            rooms: nextSelections,
          }),
        }),
      );
      setQuotedRooms(nextRooms);
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
      setSelectionPending(false);
    }
  }

  function editRoomSelection() {
    setQuote(null);
    setQuotedRooms([]);
    setSelections([]);
    setAcknowledged([]);
    setQuoteError("");
    requestAnimationFrame(() =>
      document
        .querySelector(".booking-results")
        ?.scrollIntoView({ behavior: "smooth" }),
    );
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
        <Link className="booking-back" href="/">
          ← {search.locale === "id" ? "Kembali ke KOOKA" : "Back to KOOKA"}
        </Link>
      </header>

      <BookingProgress
        currentStep={quote && quotedRooms.length ? 3 : 2}
        locale={search.locale}
      />

      <section className="booking-summary">
        <div className="booking-summary-heading">
          <div className="booking-summary-title">
            <p className="eyebrow">Direct booking · {search.currency}</p>
            <h1>
              {search.locale === "id"
                ? "Pilih kamar Anda."
                : "Choose your room."}
            </h1>
          </div>
          <p className="booking-summary-lead">
            {search.locale === "id"
              ? "Pilih kamar, lalu lengkapi data tamu untuk menerima kode booking."
              : "Select a room, then enter your guest details to receive a booking code."}
          </p>
        </div>
        <BookingSearchForm search={search} />
      </section>

      <BookingResultContent
        search={search}
        result={result}
        loading={loading}
        error={error}
        selectedRoomCounts={selectedRoomCounts}
        onChangeSelection={changeRoomSelection}
        onContinue={continueWithSelection}
        selectionPending={selectionPending}
        selectionLocked={Boolean(quote)}
      />

      {quoteError && !quote ? (
        <div className="booking-inline-error">{quoteError}</div>
      ) : null}

      {quote && quotedRooms.length ? (
        <section className="guest-checkout" id="guest-details">
          <div className="guest-checkout-summary">
            <p className="eyebrow">
              {search.locale === "id" ? "Pilihan Anda" : "Your selection"}
            </p>
            <h2>{quotedRoomLabel}</h2>
            <p>{displayStay}</p>
            <dl>
              <div>
                <dt>{search.locale === "id" ? "Kamar" : "Rooms"}</dt>
                <dd>{selections.length}</dd>
              </div>
              <div>
                <dt>{search.locale === "id" ? "Subtotal" : "Subtotal"}</dt>
                <dd>{money(quote.netAmountIdr)}</dd>
              </div>
              {quote.serviceChargeIdr > 0 ? (
                <div>
                  <dt>
                    {search.locale === "id"
                      ? "Biaya layanan"
                      : "Service charge"}
                  </dt>
                  <dd>{money(quote.serviceChargeIdr)}</dd>
                </div>
              ) : null}
              {quote.taxIdr > 0 ? (
                <div>
                  <dt>{search.locale === "id" ? "Pajak" : "Taxes"}</dt>
                  <dd>{money(quote.taxIdr)}</dd>
                </div>
              ) : null}
              <div className="quote-official-total">
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
                ? `Harga berlaku sampai ${dateTimeLabel(quote.expiresAt, search.locale)} WIB. Kamar baru diamankan setelah booking berhasil dibuat.`
                : `The price is valid until ${dateTimeLabel(quote.expiresAt, search.locale)} WIB. Rooms are secured only after the booking is created.`}
            </p>
            <button
              className="guest-selection-edit"
              onClick={editRoomSelection}
              type="button"
            >
              <span aria-hidden="true">←</span>
              <strong>
                {search.locale === "id" ? "Ubah pilihan kamar" : "Change rooms"}
              </strong>
            </button>
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
