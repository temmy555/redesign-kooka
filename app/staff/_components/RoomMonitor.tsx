"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ReasonDialog } from "./FormControls";
import StaffNotice from "./StaffNotice";
import styles from "../staff.module.css";

export interface RoomMonitorRoom {
  roomUnitId: string;
  roomNumber: string;
  roomTypeId: string | null;
  occupancyStatus: string;
  housekeepingStatus: string;
  serviceabilityStatus: string;
  roomStayId: string | null;
  stayStatus: string | null;
  bookingCode: string | null;
  guestName: string | null;
  nextArrivalAt: string | null;
  nextArrivalBookingCode: string | null;
  nextArrivalGuestName: string | null;
  updatedAt: string;
}

export interface RoomBoardData {
  generatedAt: string;
  staleAfterSeconds: number;
  sharedDisplay: boolean;
  rooms: RoomMonitorRoom[];
}

type RoomFilter = "ALL" | "OCCUPIED" | "READY" | "CLEANING" | "ATTENTION";

function roomCondition(room: RoomMonitorRoom) {
  if (room.serviceabilityStatus !== "IN_SERVICE") return "ATTENTION";
  if (room.occupancyStatus === "OCCUPIED") return "OCCUPIED";
  if (["DIRTY", "CLEANING"].includes(room.housekeepingStatus))
    return "CLEANING";
  if (["CLEANED", "INSPECTED"].includes(room.housekeepingStatus))
    return "READY";
  return "ATTENTION";
}

export function filterRooms(rooms: RoomMonitorRoom[], filter: RoomFilter) {
  return filter === "ALL"
    ? rooms
    : rooms.filter((room) => roomCondition(room) === filter);
}

function conditionLabel(condition: RoomFilter, room: RoomMonitorRoom) {
  if (condition === "OCCUPIED") return "Terisi";
  if (condition === "READY") return "Siap";
  if (condition === "ATTENTION") return "Tidak aktif";
  return room.housekeepingStatus === "DIRTY"
    ? "Perlu dibersihkan"
    : "Sedang dibersihkan";
}

function conditionDescription(condition: RoomFilter) {
  if (condition === "OCCUPIED") return "Kamar sedang digunakan tamu.";
  if (condition === "READY") return "Kamar siap menerima booking.";
  if (condition === "ATTENTION")
    return "Kamar tidak dijual sampai diaktifkan kembali.";
  return "Selesaikan pembersihan agar kamar kembali siap.";
}

function dateTime(value: string | null) {
  if (!value) return "Tidak ada kedatangan terjadwal";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jadwal tidak valid";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const filters: Array<{ code: RoomFilter; label: string }> = [
  { code: "ALL", label: "Semua" },
  { code: "OCCUPIED", label: "Terisi" },
  { code: "READY", label: "Siap" },
  { code: "CLEANING", label: "Perlu dibersihkan" },
  { code: "ATTENTION", label: "Perlu perhatian" },
];

export default function RoomMonitor({
  initialData,
  canManageHousekeeping,
  canViewGuestDetails,
}: {
  initialData: RoomBoardData;
  canManageHousekeeping: boolean;
  canViewGuestDetails: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<RoomFilter>("ALL");
  const [shared, setShared] = useState(initialData.sharedDisplay);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [quickBusyRoomId, setQuickBusyRoomId] = useState("");
  const [returnRoom, setReturnRoom] = useState<RoomMonitorRoom | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const refresh = useCallback(
    async (sharedDisplay = shared) => {
      setBusy(true);
      try {
        const response = await fetch(
          `/api/staff/room-board${sharedDisplay ? "?display=shared" : ""}`,
          { cache: "no-store" },
        );
        if (response.status === 401) {
          window.location.assign("/staff/login?next=/staff/rooms");
          return;
        }
        if (!response.ok) throw new Error("Room board unavailable");
        const next = (await response.json()) as RoomBoardData;
        setData(next);
        setShared(next.sharedDisplay);
        setError(null);
      } catch {
        setError(
          "Data terakhir tetap ditampilkan. Pembaruan room monitor gagal.",
        );
      } finally {
        setBusy(false);
      }
    },
    [shared],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const visibleRooms = useMemo(
    () => filterRooms(data.rooms, filter),
    [data.rooms, filter],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map(({ code }) => [code, filterRooms(data.rooms, code).length]),
      ),
    [data.rooms],
  );
  const generatedAt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(data.generatedAt));

  async function updateRoomStatus(
    room: RoomMonitorRoom,
    operation: "START_CLEANING" | "MARK_READY" | "RETURN_TO_SERVICE",
    reason?: string,
  ) {
    setQuickBusyRoomId(room.roomUnitId);
    try {
      const response = await fetch("/api/staff/operations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `room-readiness:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          action: "QUICK_ROOM_STATUS",
          roomUnitId: room.roomUnitId,
          operation,
          reason,
        }),
      });
      const result = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(result.error?.message ?? "Status kamar gagal diubah.");
      setReturnRoom(null);
      setReturnReason("");
      setActionNotice({
        tone: "success",
        message:
          operation === "START_CLEANING"
            ? `Kamar ${room.roomNumber} mulai dibersihkan.`
            : operation === "MARK_READY"
              ? `Kamar ${room.roomNumber} sekarang siap menerima tamu.`
              : `Kamar ${room.roomNumber} sudah aktif kembali.`,
      });
      await refresh();
    } catch (actionError) {
      setActionNotice({
        tone: "error",
        message:
          actionError instanceof Error
            ? actionError.message
            : "Status kamar gagal diubah.",
      });
    } finally {
      setQuickBusyRoomId("");
    }
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Live Room Monitor</span>
          <h1>Pantauan kamar</h1>
          <p>
            Satu halaman untuk seluruh unit fisik dan status operasionalnya.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.liveIndicator}>Live · {generatedAt}</span>
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
        notice={
          actionNotice ?? (error ? { tone: "error", message: error } : null)
        }
        onDismiss={() => {
          setActionNotice(null);
          setError(null);
        }}
      />
      <div className={styles.summaryBar}>
        <span>
          <strong>{data.rooms.length}</strong> kamar aktif
        </span>
        <span>
          <strong>{counts.OCCUPIED ?? 0}</strong> terisi
        </span>
        <span>
          <strong>{counts.READY ?? 0}</strong> siap
        </span>
        <span>
          <strong>{counts.CLEANING ?? 0}</strong> perlu dibersihkan
        </span>
        <span>
          <strong>{counts.ATTENTION ?? 0}</strong> perhatian
        </span>
        <span>
          {data.sharedDisplay ? "Nama tamu dimasking" : "Detail Front Office"}
        </span>
      </div>
      <div className={styles.roomToolbar} aria-label="Filter kamar">
        {filters.map((item) => (
          <button
            aria-pressed={filter === item.code}
            className={`${styles.filterButton} ${filter === item.code ? styles.filterActive : ""}`}
            key={item.code}
            onClick={() => setFilter(item.code)}
            type="button"
          >
            {item.label} · {counts[item.code] ?? 0}
          </button>
        ))}
        {canViewGuestDetails ? (
          <button
            aria-pressed={shared}
            className={`${styles.filterButton} ${shared ? styles.filterActive : ""}`}
            onClick={() => void refresh(!shared)}
            type="button"
          >
            {shared ? "Mode shared aktif" : "Aktifkan mode shared"}
          </button>
        ) : null}
      </div>
      {visibleRooms.length ? (
        <section aria-label="Daftar kamar" className={styles.roomGrid}>
          {visibleRooms.map((room) => {
            const condition = roomCondition(room);
            const hasUpcomingGuest = Boolean(
              room.nextArrivalAt && room.nextArrivalGuestName,
            );
            const displayedGuestName =
              room.guestName ?? room.nextArrivalGuestName;
            const displayedBookingCode =
              room.bookingCode ?? room.nextArrivalBookingCode;
            const conditionClass =
              condition === "OCCUPIED"
                ? styles.roomCardOccupied
                : condition === "READY"
                  ? styles.roomCardReady
                  : condition === "ATTENTION"
                    ? styles.roomCardAttention
                    : styles.roomCardCleaning;
            return (
              <article
                className={`${styles.roomCard} ${conditionClass}`}
                key={room.roomUnitId}
              >
                <span className={styles.roomAccent} />
                <div className={styles.roomTop}>
                  <span className={styles.roomNumber}>{room.roomNumber}</span>
                  <span className={styles.statusPill}>
                    {conditionLabel(condition, room)}
                  </span>
                </div>
                <div className={styles.roomBody}>
                  {!room.guestName && hasUpcomingGuest ? (
                    <span className={styles.roomUpcomingLabel}>
                      Tamu berikutnya
                    </span>
                  ) : null}
                  <h2>
                    {displayedGuestName ??
                      (condition === "READY"
                        ? "Siap menerima tamu"
                        : condition === "OCCUPIED"
                          ? "Tamu sedang menginap"
                          : "Kamar kosong")}
                  </h2>
                  <p>
                    {displayedBookingCode
                      ? `Booking ${displayedBookingCode}`
                      : conditionDescription(condition)}
                  </p>
                  {room.guestName && hasUpcomingGuest ? (
                    <div className={styles.roomNextArrival}>
                      <span>Tamu berikutnya</span>
                      <strong>{room.nextArrivalGuestName}</strong>
                      <small>
                        Booking {room.nextArrivalBookingCode ?? "—"}
                      </small>
                    </div>
                  ) : null}
                  {canManageHousekeeping &&
                  room.occupancyStatus === "VACANT" &&
                  condition !== "READY" ? (
                    <button
                      className={styles.roomQuickAction}
                      disabled={quickBusyRoomId === room.roomUnitId}
                      onClick={() => {
                        if (room.serviceabilityStatus !== "IN_SERVICE") {
                          setReturnRoom(room);
                          return;
                        }
                        void updateRoomStatus(
                          room,
                          room.housekeepingStatus === "DIRTY"
                            ? "START_CLEANING"
                            : "MARK_READY",
                        );
                      }}
                      type="button"
                    >
                      {quickBusyRoomId === room.roomUnitId
                        ? "Memproses…"
                        : room.serviceabilityStatus !== "IN_SERVICE"
                          ? "Aktifkan kembali"
                          : room.housekeepingStatus === "DIRTY"
                            ? "Mulai bersihkan"
                            : "Selesai & jadikan siap"}
                    </button>
                  ) : null}
                </div>
                <div className={styles.roomFooter}>
                  <span>Kedatangan berikutnya</span>
                  <strong>{dateTime(room.nextArrivalAt)}</strong>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className={styles.emptyState}>
          Tidak ada kamar untuk filter yang dipilih.
        </div>
      )}
      <ReasonDialog
        confirmLabel="Aktifkan kembali"
        description="Gunakan aksi ini hanya jika kamar sudah aman dan tidak memiliki maintenance atau blok aktif."
        onCancel={() => {
          setReturnRoom(null);
          setReturnReason("");
        }}
        onChange={setReturnReason}
        onConfirm={() => {
          if (returnRoom)
            void updateRoomStatus(
              returnRoom,
              "RETURN_TO_SERVICE",
              returnReason,
            );
        }}
        open={Boolean(returnRoom)}
        title={`Aktifkan kembali kamar ${returnRoom?.roomNumber ?? ""}?`}
        value={returnReason}
      />
    </>
  );
}
