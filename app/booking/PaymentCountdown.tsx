"use client";

import { useEffect, useRef, useState } from "react";

import type { PublicLocale } from "../../src/modules/content/contracts";

export function paymentTimeRemaining(deadlineAt: string, now = Date.now()) {
  const deadline = new Date(deadlineAt).getTime();
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, deadline - now);
}

export function formatPaymentCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
  return days > 0 ? `${days}d ${clock}` : clock;
}

export default function PaymentCountdown({
  deadlineAt,
  locale,
  onExpire,
}: {
  deadlineAt: string | null;
  locale: PublicLocale;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const expiredNotified = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiredNotified.current = false;
    if (!deadlineAt) return;
    const update = () => {
      const next = paymentTimeRemaining(deadlineAt);
      setRemaining(next);
      if (next === 0 && !expiredNotified.current) {
        expiredNotified.current = true;
        onExpireRef.current?.();
      }
    };
    const initialTimer = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [deadlineAt]);

  if (!deadlineAt) return null;
  const expired = remaining === 0;
  return (
    <div
      className={`payment-countdown ${expired ? "is-expired" : ""}`}
      role="timer"
      aria-live={expired ? "polite" : "off"}
    >
      <small>
        {expired
          ? locale === "id"
            ? "Waktu pembayaran berakhir"
            : "Payment time ended"
          : locale === "id"
            ? "Selesaikan pembayaran dalam"
            : "Complete payment within"}
      </small>
      <strong>
        {remaining === null
          ? "--:--:--"
          : expired
            ? locale === "id"
              ? "Kedaluwarsa"
              : "Expired"
            : formatPaymentCountdown(remaining)}
      </strong>
      {expired ? (
        <span>
          {locale === "id"
            ? "Jangan melakukan transfer baru. Periksa status booking atau hubungi Front Office."
            : "Do not make a new transfer. Check your booking status or contact Front Office."}
        </span>
      ) : null}
    </div>
  );
}
