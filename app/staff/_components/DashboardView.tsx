"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import StaffNotice from "./StaffNotice";
import styles from "../staff.module.css";

export interface StaffQueueItem {
  queueType: string;
  entityId: string;
  bookingCode: string | null;
  roomNumber: string | null;
  guestName: string | null;
  status: string;
  scheduledAt: string | null;
  amountIdr: string | null;
  alert: string | null;
}

export interface DashboardData {
  metadata: {
    timezone: string;
    businessDate: string;
    dataAsOf: string;
    currency: string;
  };
  summary: Record<string, number> & { occupancyPercent: number };
  queues: Partial<Record<string, StaffQueueItem[]>>;
  reconciliation: {
    openCount: number;
    criticalCount: number;
    exceptions: Array<{
      id: string;
      checkCode: string;
      severity: string;
      status: string;
    }>;
  };
}

const queueLabels: Record<string, string> = {
  ARRIVAL: "Kedatangan hari ini",
  DEPARTURE: "Keberangkatan hari ini",
  UNASSIGNED: "Belum mendapat kamar",
  PAYMENT_REVIEW: "Verifikasi pembayaran",
};

const queueActions: Record<string, { href: string; label: string }> = {
  ARRIVAL: {
    href: "/staff/front-office?tab=stay",
    label: "Proses kedatangan",
  },
  DEPARTURE: {
    href: "/staff/front-office?tab=stay",
    label: "Proses checkout",
  },
  UNASSIGNED: {
    href: "/staff/front-office?tab=stay",
    label: "Alokasikan kamar",
  },
  PAYMENT_REVIEW: {
    href: "/staff/front-office?tab=payment",
    label: "Periksa pembayaran",
  },
};

function number(value: number | undefined) {
  return new Intl.NumberFormat("id-ID").format(value ?? 0);
}

export function formatIdr(value: number | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function time(value: string | null) {
  if (!value) return "Waktu belum ditentukan";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu tidak valid";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function humanStatus(value: string) {
  const labels: Record<string, string> = {
    CHECKOUT_PENDING: "Checkout perlu diproses",
    FOLIO_UNSETTLED: "Tagihan belum lunas",
    ROOM_UNASSIGNED: "Kamar belum dialokasikan",
    STALE: "Menunggu verifikasi",
  };
  if (labels[value]) return labels[value];
  return value.replaceAll("_", " ").toLocaleLowerCase("id-ID");
}

function QueuePanel({ type, rows }: { type: string; rows: StaffQueueItem[] }) {
  const action = queueActions[type];
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>{queueLabels[type] ?? type}</h2>
        <div className={styles.panelHeaderActions}>
          <span className={styles.countPill}>{rows.length}</span>
          {action ? (
            <Link className={styles.panelAction} href={action.href}>
              {action.label}
            </Link>
          ) : null}
        </div>
      </div>
      {rows.length ? (
        <ul className={styles.queueList}>
          {rows.slice(0, 8).map((row) => (
            <li className={styles.queueRow} key={`${type}-${row.entityId}`}>
              <div className={styles.queuePrimary}>
                <strong>
                  {row.guestName ?? row.bookingCode ?? "Tanpa nama"}
                </strong>
                <small>
                  {row.bookingCode ?? "Belum ada kode booking"}
                  {row.roomNumber ? ` · Kamar ${row.roomNumber}` : ""}
                </small>
              </div>
              <div className={styles.queueMeta}>
                <strong>{time(row.scheduledAt)}</strong>
                <small>{humanStatus(row.status)}</small>
                {row.amountIdr && Math.abs(Number(row.amountIdr)) >= 0.5 ? (
                  <small className={styles.queueAmount}>
                    Sisa tagihan {formatIdr(Number(row.amountIdr))}
                  </small>
                ) : null}
              </div>
              <div className={styles.queueActions}>
                {row.alert ? (
                  <span className={styles.alertPill}>
                    {humanStatus(row.alert)}
                  </span>
                ) : (
                  <span className={styles.statusPill}>Terpantau</span>
                )}
                {action ? (
                  <Link
                    className={styles.queueOpenAction}
                    href={
                      ["ARRIVAL", "DEPARTURE", "UNASSIGNED"].includes(type)
                        ? `${action.href}&reservationRoomId=${encodeURIComponent(row.entityId)}&action=${type === "DEPARTURE" ? "CHECK_OUT" : "CHECK_IN"}`
                        : action.href
                    }
                  >
                    Buka
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.emptyState}>
          Tidak ada item pada antrean ini.
        </div>
      )}
    </section>
  );
}

export default function DashboardView({
  initialData,
}: {
  initialData: DashboardData;
}) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/staff/reports", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/staff/login?next=/staff");
        return;
      }
      if (!response.ok) throw new Error("Dashboard belum dapat diperbarui.");
      setData((await response.json()) as DashboardData);
      setError(null);
    } catch {
      setError(
        "Data terakhir tetap ditampilkan. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const arrivals = data.queues.ARRIVAL ?? [];
  const departures = data.queues.DEPARTURE ?? [];
  const unassigned = data.queues.UNASSIGNED ?? [];
  const payment = data.queues.PAYMENT_REVIEW ?? [];
  const attention =
    unassigned.length +
    departures.filter((item) => item.alert).length +
    payment.filter((item) => item.alert).length +
    data.reconciliation.criticalCount;
  const updated = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data.metadata.dataAsOf));

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>
            Business date · {data.metadata.businessDate}
          </span>
          <h1>Hari ini</h1>
          <p>Ringkasan operasional KOOKA dalam waktu Jakarta.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.liveIndicator}>Diperbarui {updated}</span>
          <button
            className={styles.refreshButton}
            disabled={busy}
            onClick={() => void refresh()}
            type="button"
          >
            {busy ? "Memuat…" : "Perbarui"}
          </button>
        </div>
      </header>
      <StaffNotice
        notice={error ? { tone: "error", message: error } : null}
        onDismiss={() => setError(null)}
      />
      <section aria-label="Ringkasan hari ini" className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>Okupansi</span>
          <strong>
            {number(data.summary.occupied_rooms)} /{" "}
            {number(data.summary.physical_rooms)}
          </strong>
          <small>{number(data.summary.occupancyPercent)}% kamar terisi</small>
          <Link className={styles.metricAction} href="/staff/rooms">
            Lihat pantauan kamar
          </Link>
        </article>
        <article className={styles.metricCard}>
          <span>Kedatangan</span>
          <strong>{arrivals.length}</strong>
          <small>
            {unassigned.length} booking 7 hari ke depan belum mendapat kamar
          </small>
          <Link
            className={styles.metricAction}
            href="/staff/front-office?tab=stay"
          >
            Proses kedatangan
          </Link>
        </article>
        <article className={styles.metricCard}>
          <span>Tagihan belum lunas</span>
          <strong>{formatIdr(data.summary.outstanding_idr)}</strong>
          <small>
            Total sisa tagihan dari seluruh booking yang masih terbuka
          </small>
          <Link
            className={styles.metricAction}
            href="/staff/front-office?tab=folio"
          >
            Lihat tagihan dan pelunasan
          </Link>
        </article>
        <article
          className={`${styles.metricCard} ${attention ? styles.attentionCard : ""}`}
        >
          <span>Perlu perhatian</span>
          <strong>{attention}</strong>
          <small>
            Booking belum mendapat kamar, pembayaran tertunda, atau data perlu
            diperiksa
          </small>
          <a className={styles.metricAction} href="#attention-queues">
            Lihat yang perlu ditindaklanjuti
          </a>
        </article>
      </section>
      <div className={styles.dashboardGrid}>
        <div className={styles.sideStack} id="attention-queues">
          <QueuePanel rows={arrivals} type="ARRIVAL" />
          <QueuePanel rows={departures} type="DEPARTURE" />
        </div>
        <div className={styles.sideStack}>
          <QueuePanel rows={unassigned} type="UNASSIGNED" />
          <QueuePanel rows={payment} type="PAYMENT_REVIEW" />
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Pantauan cepat</h2>
            </div>
            <div className={styles.emptyState}>
              <p>
                Lihat status seluruh unit fisik, tamu yang menghuni, dan
                kesiapan kamar.
              </p>
              <Link className={styles.secondaryButton} href="/staff/rooms">
                Buka pantauan kamar
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
