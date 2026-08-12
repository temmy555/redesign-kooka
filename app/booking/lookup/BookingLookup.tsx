"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import KookaLogo from "../../KookaLogo";
import PaymentCountdown from "../PaymentCountdown";

interface BookingDetail {
  bookingCode: string;
  bookerName: string;
  reservationStatus: string;
  officialCurrency: "IDR";
  displayCurrency: string;
  requiredPaymentIdr: number;
  balanceIdr: number;
  paymentDeadlineAt: string | null;
  guaranteed: boolean;
  rooms: Array<{
    lineNumber: number;
    roomTypeName: string;
    checkInDate: string;
    checkoutDate: string;
    adults: number;
    children: number;
    infants: number;
    extraBedQuantity: number;
    status: string;
  }>;
  payments: Array<{
    status: string;
    amountIdr: number;
    receivedAt: string | null;
  }>;
  paymentInstructions: Array<{
    paymentInstructionVersionId?: string;
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    instruction: string;
  }>;
  paymentInstruction?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    instruction: string;
  } | null;
  whatsappUrl: string | null;
}

interface StatusPresentation {
  variant: "confirmed" | "review" | "closed" | "waiting";
  eyebrow: string;
  title: string;
  message: string;
  detail: string;
  seal: string;
}

function money(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: string | null, locale: "id" | "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-AU" : "id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function dateOnly(value: string | undefined, locale: "id" | "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-AU" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function statusLabel(status: string, locale: "id" | "en") {
  const labels: Record<string, [string, string]> = {
    ON_HOLD: ["Menunggu pembayaran", "Awaiting payment"],
    CONFIRMED: ["Terkonfirmasi", "Confirmed"],
    CANCELLED: ["Dibatalkan", "Cancelled"],
    EXPIRED: ["Kedaluwarsa", "Expired"],
    PENDING_VERIFICATION: ["Sedang diverifikasi", "Under verification"],
    VERIFIED: ["Terverifikasi", "Verified"],
    REJECTED: ["Ditolak", "Rejected"],
  };
  return (
    labels[status]?.[locale === "en" ? 1 : 0] ?? status.replaceAll("_", " ")
  );
}

function statusPresentation(
  booking: BookingDetail,
  locale: "id" | "en",
  paymentVerified: boolean,
  paymentUnderReview: boolean,
): StatusPresentation {
  const greetingName = booking.bookerName.trim().split(/\s+/)[0] || "";
  const arrivalDate = dateOnly(booking.rooms[0]?.checkInDate, locale);
  const confirmed = booking.reservationStatus === "CONFIRMED";
  if (confirmed && paymentVerified) {
    return {
      variant: "confirmed",
      eyebrow: locale === "id" ? "Booking terkonfirmasi" : "Booking confirmed",
      title:
        locale === "id"
          ? `Terima kasih${greetingName ? `, ${greetingName}` : ""}.`
          : `Thank you${greetingName ? `, ${greetingName}` : ""}.`,
      message:
        locale === "id"
          ? "Pembayaran Anda telah terverifikasi dan reservasi sudah dikonfirmasi."
          : "Your payment has been verified and your reservation is confirmed.",
      detail:
        locale === "id"
          ? `Kami menunggu kedatangan Anda di KOOKA Residence pada ${arrivalDate}.`
          : `We look forward to welcoming you to KOOKA Residence on ${arrivalDate}.`,
      seal: locale === "id" ? "Siap menginap" : "Ready for your stay",
    };
  }
  if (confirmed) {
    return {
      variant: "confirmed",
      eyebrow: locale === "id" ? "Booking terkonfirmasi" : "Booking confirmed",
      title:
        locale === "id"
          ? `Terima kasih${greetingName ? `, ${greetingName}` : ""}.`
          : `Thank you${greetingName ? `, ${greetingName}` : ""}.`,
      message:
        locale === "id"
          ? "Reservasi Anda sudah dikonfirmasi."
          : "Your reservation is confirmed.",
      detail:
        locale === "id"
          ? `Kami menunggu kedatangan Anda di KOOKA Residence pada ${arrivalDate}.`
          : `We look forward to welcoming you to KOOKA Residence on ${arrivalDate}.`,
      seal: locale === "id" ? "Terkonfirmasi" : "Confirmed",
    };
  }
  if (paymentUnderReview) {
    return {
      variant: "review",
      eyebrow: locale === "id" ? "Pembayaran diterima" : "Payment received",
      title:
        locale === "id"
          ? "Bukti pembayaran sedang kami periksa."
          : "We are reviewing your payment proof.",
      message:
        locale === "id"
          ? "Front Office akan mengonfirmasi booking setelah pembayaran selesai diverifikasi."
          : "Front Office will confirm the booking after payment verification.",
      detail:
        locale === "id"
          ? "Buka halaman ini kembali untuk melihat status terbaru."
          : "Return to this page to see the latest status.",
      seal: locale === "id" ? "Sedang diverifikasi" : "Under review",
    };
  }
  if (
    booking.reservationStatus === "CANCELLED" ||
    booking.reservationStatus === "EXPIRED"
  ) {
    return {
      variant: "closed",
      eyebrow: statusLabel(booking.reservationStatus, locale),
      title:
        booking.reservationStatus === "CANCELLED"
          ? locale === "id"
            ? "Booking ini telah dibatalkan."
            : "This booking has been cancelled."
          : locale === "id"
            ? "Waktu pembayaran telah berakhir."
            : "The payment window has expired.",
      message:
        locale === "id"
          ? "Hubungi Front Office jika Anda memerlukan bantuan lebih lanjut."
          : "Contact Front Office if you need further assistance.",
      detail: "",
      seal: statusLabel(booking.reservationStatus, locale),
    };
  }
  return {
    variant: "waiting",
    eyebrow: locale === "id" ? "Menunggu pembayaran" : "Awaiting payment",
    title:
      locale === "id"
        ? "Selesaikan pembayaran Anda."
        : "Complete your payment.",
    message:
      locale === "id"
        ? "Transfer sesuai nominal sebelum batas waktu, lalu kirim bukti melalui WhatsApp."
        : "Transfer the exact amount before the deadline, then send proof through WhatsApp.",
    detail:
      locale === "id"
        ? "Kamar masih ditahan selama batas pembayaran masih berlaku."
        : "Your room remains held while the payment window is active.",
    seal: statusLabel(booking.reservationStatus, locale),
  };
}

export default function BookingLookup({
  initialCode,
  locale,
}: {
  initialCode: string;
  locale: "id" | "en";
}) {
  const [bookingCode, setBookingCode] = useState(initialCode);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const paymentInstructions = booking?.paymentInstructions?.length
    ? booking.paymentInstructions
    : booking?.paymentInstruction
      ? [booking.paymentInstruction]
      : [];

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const authenticated = await fetch("/api/booking/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingCode, email }),
      });
      if (!authenticated.ok) throw new Error("lookup_failed");
      const response = await fetch("/api/booking/lookup", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("lookup_failed");
      setBooking((await response.json()) as BookingDetail);
    } catch {
      setError(
        locale === "id"
          ? "Booking tidak ditemukan. Periksa kembali kode booking dan, jika diisi, pastikan email sesuai dengan data pemesanan."
          : "Booking not found. Check the booking code and, if provided, make sure the email matches your reservation.",
      );
    } finally {
      setLoading(false);
    }
  }

  const verifiedPaymentTotal =
    booking?.payments
      .filter((payment) => payment.status === "VERIFIED")
      .reduce((total, payment) => total + payment.amountIdr, 0) ?? 0;
  const paymentVerified = Boolean(
    booking &&
    (booking.guaranteed || verifiedPaymentTotal >= booking.requiredPaymentIdr),
  );
  const paymentUnderReview = Boolean(
    booking?.payments.some(
      (payment) => payment.status === "PENDING_VERIFICATION",
    ),
  );
  const paymentWindowOpen = Boolean(
    booking &&
    booking.reservationStatus === "ON_HOLD" &&
    !paymentVerified &&
    !paymentUnderReview,
  );
  const presentation = booking
    ? statusPresentation(booking, locale, paymentVerified, paymentUnderReview)
    : null;
  const arrivalDate = dateOnly(booking?.rooms[0]?.checkInDate, locale);

  return (
    <main className="booking-page lookup-page">
      <header className="booking-header">
        <Link className="brand" href="/" aria-label="KOOKA Residence home">
          <KookaLogo
            className="brand-logo"
            priority
            sizes="(max-width: 560px) 118px, 146px"
          />
        </Link>
        <Link className="booking-back" href="/">
          ← {locale === "id" ? "Kembali" : "Back"}
        </Link>
      </header>
      <section className="lookup-hero">
        <div>
          <p className="eyebrow">Guest booking</p>
          <h1>
            {locale === "id" ? "Lihat booking Anda." : "Find your booking."}
          </h1>
          <p>
            {locale === "id"
              ? "Tidak perlu login. Cukup masukkan kode booking Anda. Email dapat digunakan sebagai verifikasi tambahan."
              : "No login required. Enter your booking code. Email can be added as an extra verification step."}
          </p>
        </div>
        <form className="lookup-form" onSubmit={lookup}>
          <label>
            <span>{locale === "id" ? "Kode booking" : "Booking code"}</span>
            <input
              required
              minLength={6}
              maxLength={24}
              autoCapitalize="characters"
              value={bookingCode}
              onChange={(event) =>
                setBookingCode(event.target.value.toUpperCase())
              }
            />
          </label>
          <label>
            <span>
              {locale === "id" ? "Email (opsional)" : "Email (optional)"}
            </span>
            <input
              type="email"
              maxLength={320}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="button" type="submit" disabled={loading}>
            {loading
              ? locale === "id"
                ? "Mencari…"
                : "Searching…"
              : locale === "id"
                ? "Lihat booking"
                : "View booking"}
          </button>
        </form>
      </section>

      {booking && presentation ? (
        <section className="lookup-result">
          <div
            className={`lookup-status-banner lookup-status-${presentation.variant}`}
            aria-live="polite"
          >
            <div className="lookup-status-icon" aria-hidden="true">
              {presentation.variant === "confirmed" ? "✓" : "●"}
            </div>
            <div className="lookup-status-copy">
              <p>{presentation.eyebrow}</p>
              <h2>{presentation.title}</h2>
              <strong>{presentation.message}</strong>
              {presentation.detail ? <span>{presentation.detail}</span> : null}
            </div>
            <div className="lookup-status-seal">
              <span>{presentation.variant === "confirmed" ? "✓" : ""}</span>
              <strong>{presentation.seal}</strong>
            </div>
          </div>

          <div className="lookup-result-heading">
            <div>
              <small>{locale === "id" ? "Kode booking" : "Booking code"}</small>
              <h2>{booking.bookingCode}</h2>
            </div>
          </div>
          <div className="lookup-result-grid">
            <article>
              <p className="eyebrow">Stay</p>
              {booking.rooms.map((room) => (
                <dl key={room.lineNumber}>
                  <div>
                    <dt>{locale === "id" ? "Jenis kamar" : "Room type"}</dt>
                    <dd>{room.roomTypeName}</dd>
                  </div>
                  <div>
                    <dt>Check-in</dt>
                    <dd>{room.checkInDate}</dd>
                  </div>
                  <div>
                    <dt>Check-out</dt>
                    <dd>{room.checkoutDate}</dd>
                  </div>
                  <div>
                    <dt>{locale === "id" ? "Tamu" : "Guests"}</dt>
                    <dd>{room.adults + room.children}</dd>
                  </div>
                </dl>
              ))}
            </article>
            <article>
              <p className="eyebrow">Payment</p>
              <div className="lookup-amount">
                <small>
                  {paymentVerified
                    ? locale === "id"
                      ? "Pembayaran lunas"
                      : "Paid in full"
                    : locale === "id"
                      ? "Total pembayaran"
                      : "Payment total"}
                </small>
                <strong>{money(booking.requiredPaymentIdr)}</strong>
              </div>
              {paymentVerified ? (
                <div className="payment-verified-highlight">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>
                      {locale === "id"
                        ? "Pembayaran terverifikasi"
                        : "Payment verified"}
                    </strong>
                    <small>
                      {locale === "id"
                        ? "Tidak ada pembayaran yang perlu dilakukan lagi."
                        : "No further payment is required."}
                    </small>
                  </div>
                </div>
              ) : (
                <>
                  {paymentWindowOpen ? (
                    <PaymentCountdown
                      deadlineAt={booking.paymentDeadlineAt}
                      locale={locale}
                      onExpire={() =>
                        setBooking((current) =>
                          current?.reservationStatus === "ON_HOLD"
                            ? { ...current, reservationStatus: "EXPIRED" }
                            : current,
                        )
                      }
                    />
                  ) : null}
                  <p>
                    {locale === "id" ? "Batas pembayaran" : "Payment deadline"}:{" "}
                    {dateTime(booking.paymentDeadlineAt, locale)} WIB
                  </p>
                </>
              )}
              {booking.payments.length ? (
                <ul className="payment-history">
                  {booking.payments.map((payment, index) => (
                    <li key={`${payment.status}-${index}`}>
                      <span>{statusLabel(payment.status, locale)}</span>
                      <strong>{money(payment.amountIdr)}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
            {paymentVerified ? (
              <article className="lookup-arrival">
                <p className="eyebrow">
                  {locale === "id" ? "Kedatangan" : "Arrival"}
                </p>
                <small>Check-in</small>
                <strong>{arrivalDate}</strong>
                <p>
                  {locale === "id"
                    ? "Tunjukkan kode booking kepada Front Office saat tiba. Nomor kamar akan dikonfirmasi saat proses check-in."
                    : "Show your booking code to Front Office on arrival. Your room number will be confirmed during check-in."}
                </p>
                {booking.whatsappUrl ? (
                  <a
                    className="button whatsapp-button"
                    href={booking.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {locale === "id"
                      ? "Hubungi KOOKA via WhatsApp"
                      : "Contact KOOKA via WhatsApp"}
                  </a>
                ) : null}
              </article>
            ) : paymentWindowOpen && paymentInstructions.length ? (
              <article className="lookup-bank">
                <p className="eyebrow">
                  {locale === "id"
                    ? "Instruksi transfer"
                    : "Transfer instructions"}
                </p>
                <p>
                  {locale === "id"
                    ? "Transfer ke salah satu rekening berikut."
                    : "Transfer to any account below."}
                </p>
                <div className="lookup-bank-list">
                  {paymentInstructions.map((instruction, index) => (
                    <div
                      className="lookup-bank-account"
                      key={`${instruction.bankName}-${instruction.accountNumber}-${index}`}
                    >
                      <strong>{instruction.bankName}</strong>
                      <span>{instruction.accountNumber}</span>
                      <p>{instruction.accountHolder}</p>
                      <small>{instruction.instruction}</small>
                    </div>
                  ))}
                </div>
                {booking.whatsappUrl ? (
                  <a
                    className="button whatsapp-button"
                    href={booking.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {locale === "id"
                      ? "Konfirmasi via WhatsApp"
                      : "Confirm via WhatsApp"}
                  </a>
                ) : null}
              </article>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
