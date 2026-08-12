"use client";

import { useMemo, useState } from "react";

import { DateField, ReasonDialog } from "./FormControls";
import styles from "../staff.module.css";

type JsonRecord = Record<string, unknown>;
type Notice = { tone: "success" | "error"; message: string } | null;

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateValue(value: unknown) {
  if (!value) return "";
  return new Date(String(value)).toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function effectiveFrom(value: string) {
  return new Date(`${value}T00:00:00+07:00`).toISOString();
}

function effectiveTo(value: string) {
  return new Date(`${value}T23:59:59.999+07:00`).toISOString();
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
  return "Titik absensi belum dapat disimpan.";
}

function generatedLocationCode(name: string) {
  const prefix = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toUpperCase()
    .slice(0, 20);
  return `${prefix || "ATTENDANCE"}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function mutate(body: JsonRecord) {
  const response = await fetch("/api/staff/admin/attendance-locations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `attendance-location:${crypto.randomUUID()}`,
    },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(errorMessage(result));
  return result;
}

function locationStatus(location: JsonRecord) {
  if (String(location.status) !== "ACTIVE") return "Nonaktif";
  const now = Date.now();
  const starts = new Date(String(location.effectiveFrom)).getTime();
  const ends = location.effectiveTo
    ? new Date(String(location.effectiveTo)).getTime()
    : null;
  if (starts > now) return "Terjadwal";
  if (ends && ends <= now) return "Berakhir";
  return "Aktif sekarang";
}

export default function AttendanceLocationAdmin({
  canManage,
  data,
  load,
  setNotice,
}: {
  canManage: boolean;
  data: JsonRecord;
  load: () => Promise<void>;
  setNotice: (notice: Notice) => void;
}) {
  const locations = useMemo(
    () =>
      Array.isArray(data.locations) ? (data.locations as JsonRecord[]) : [],
    [data.locations],
  );
  const [editingId, setEditingId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("50");
  const [maximumAccuracy, setMaximumAccuracy] = useState("50");
  const [startsOn, setStartsOn] = useState(today);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endsOn, setEndsOn] = useState(today);
  const [reason, setReason] = useState("");
  const [readingPosition, setReadingPosition] = useState(false);
  const [deviceAccuracy, setDeviceAccuracy] = useState<number | null>(null);
  const [statusTarget, setStatusTarget] = useState<JsonRecord | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditingId("");
    setCode("");
    setName("");
    setLatitude("");
    setLongitude("");
    setRadius("50");
    setMaximumAccuracy("50");
    setStartsOn(today());
    setHasEndDate(false);
    setEndsOn(today());
    setReason("");
    setDeviceAccuracy(null);
  }

  function edit(location: JsonRecord) {
    setEditingId(String(location.id));
    setCode(String(location.code));
    setName(String(location.name));
    setLatitude(String(location.latitude));
    setLongitude(String(location.longitude));
    setRadius(String(location.radiusMeters));
    setMaximumAccuracy(String(location.maximumAccuracyMeters));
    setStartsOn(dateValue(location.effectiveFrom));
    setHasEndDate(Boolean(location.effectiveTo));
    setEndsOn(dateValue(location.effectiveTo) || today());
    setReason("");
    setDeviceAccuracy(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setNotice({
        tone: "error",
        message: "Browser ini tidak mendukung pembacaan lokasi.",
      });
      return;
    }
    setReadingPosition(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setDeviceAccuracy(position.coords.accuracy);
        setReadingPosition(false);
        setNotice({
          tone: "success",
          message: `Lokasi perangkat berhasil dibaca dengan akurasi ±${Math.round(position.coords.accuracy)} meter.`,
        });
      },
      () => {
        setReadingPosition(false);
        setNotice({
          tone: "error",
          message:
            "Lokasi tidak dapat dibaca. Izinkan akses lokasi pada browser lalu coba kembali.",
        });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const resolvedCode = code.trim() || generatedLocationCode(name);
      const auditReason =
        reason.trim() ||
        `${editingId ? "Titik absensi diperbarui" : "Titik absensi dibuat"} oleh Owner`;
      await mutate({
        action: editingId ? "UPDATE_LOCATION" : "CREATE_LOCATION",
        ...(editingId ? { locationId: editingId } : {}),
        input: {
          code: resolvedCode,
          name,
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusMeters: Number(radius),
          maximumAccuracyMeters: Number(maximumAccuracy),
          effectiveFrom: effectiveFrom(startsOn),
          effectiveTo: hasEndDate ? effectiveTo(endsOn) : null,
          reason: auditReason,
        },
      });
      setNotice({
        tone: "success",
        message: editingId
          ? "Titik absensi berhasil diperbarui dan dicatat di audit."
          : "Titik absensi berhasil dibuat dan langsung tersedia sesuai periode berlaku.",
      });
      reset();
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Titik absensi belum dapat disimpan.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus() {
    if (!statusTarget) return;
    const nextStatus =
      String(statusTarget.status) === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await mutate({
        action: "SET_LOCATION_STATUS",
        locationId: String(statusTarget.id),
        status: nextStatus,
        reason: statusReason,
      });
      setNotice({
        tone: "success",
        message:
          nextStatus === "ACTIVE"
            ? "Titik absensi diaktifkan."
            : "Titik absensi dinonaktifkan.",
      });
      setStatusTarget(null);
      setStatusReason("");
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Status titik absensi belum dapat diubah.",
      });
    }
  }

  const hasCoordinates =
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    latitude !== "" &&
    longitude !== "";

  return (
    <div className={styles.attendanceAdminLayout}>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{editingId ? "Edit titik absensi" : "Titik absensi baru"}</h2>
            <p className={styles.inlineHint}>
              Koordinat, radius, akurasi GPS, dan periode berlaku.
            </p>
          </div>
          {editingId ? (
            <button className={styles.textButton} onClick={reset} type="button">
              Batal edit
            </button>
          ) : null}
        </div>
        <form className={styles.staffForm} onSubmit={save}>
          <div className={styles.formGrid}>
            <label>
              Kode titik (opsional)
              <input
                maxLength={64}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Dibuat otomatis bila dikosongkan"
                value={code}
              />
            </label>
            <label>
              Nama titik
              <input
                maxLength={160}
                onChange={(event) => setName(event.target.value)}
                placeholder="KOOKA Residence Surabaya"
                required
                value={name}
              />
            </label>
          </div>
          <button
            className={styles.locationDeviceButton}
            disabled={readingPosition}
            onClick={useCurrentPosition}
            type="button"
          >
            <span aria-hidden="true">⌖</span>
            {readingPosition
              ? "Membaca lokasi perangkat…"
              : "Gunakan lokasi perangkat ini"}
          </button>
          <div className={styles.formGrid}>
            <label>
              Latitude
              <input
                inputMode="decimal"
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="-7.0000000"
                required
                value={latitude}
              />
            </label>
            <label>
              Longitude
              <input
                inputMode="decimal"
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="112.0000000"
                required
                value={longitude}
              />
            </label>
            <label>
              Radius yang diizinkan (meter)
              <input
                inputMode="numeric"
                max="5000"
                min="5"
                onChange={(event) =>
                  setRadius(event.target.value.replace(/\D/gu, ""))
                }
                required
                type="text"
                value={radius}
              />
            </label>
            <label>
              Maksimum akurasi GPS (meter)
              <input
                inputMode="numeric"
                max="1000"
                min="5"
                onChange={(event) =>
                  setMaximumAccuracy(event.target.value.replace(/\D/gu, ""))
                }
                required
                type="text"
                value={maximumAccuracy}
              />
            </label>
          </div>
          {deviceAccuracy !== null ? (
            <p className={styles.formHint}>
              Akurasi pembacaan terakhir: ±{Math.round(deviceAccuracy)} meter.
              Pastikan batas maksimum tidak terlalu kecil dibandingkan kondisi
              GPS aktual di properti.
            </p>
          ) : null}
          <div className={styles.attendancePeriodPanel}>
            <div className={styles.attendancePeriodHeader}>
              <div>
                <strong>Periode berlaku</strong>
                <small>
                  Tentukan kapan titik ini mulai dan berhenti digunakan.
                </small>
              </div>
              <label className={styles.attendanceEndToggle}>
                <input
                  checked={hasEndDate}
                  onChange={(event) => setHasEndDate(event.target.checked)}
                  type="checkbox"
                />
                <span
                  aria-hidden="true"
                  className={styles.attendanceToggleTrack}
                >
                  <span />
                </span>
                <span>Tetapkan tanggal berakhir</span>
              </label>
            </div>
            <div className={styles.attendancePeriodGrid}>
              <div className={styles.attendancePeriodField}>
                <span>Mulai berlaku</span>
                <DateField
                  ariaLabel="Tanggal mulai titik absensi"
                  onChange={setStartsOn}
                  value={startsOn}
                />
              </div>
              <div className={styles.attendancePeriodField}>
                <span>Berakhir pada</span>
                {hasEndDate ? (
                  <DateField
                    ariaLabel="Tanggal berakhir titik absensi"
                    min={startsOn}
                    onChange={setEndsOn}
                    value={endsOn}
                  />
                ) : (
                  <div className={styles.attendanceNoEndDate}>
                    <strong>Tanpa batas waktu</strong>
                    <small>Titik tetap aktif hingga dinonaktifkan.</small>
                  </div>
                )}
              </div>
            </div>
          </div>
          <label className={styles.attendanceReasonField}>
            Catatan perubahan (opsional)
            <textarea
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: menetapkan titik absensi utama"
              value={reason}
            />
          </label>
          <div className={styles.attendanceFormActions}>
            <button
              className={`${styles.primaryButton} ${styles.attendanceSubmitButton}`}
              disabled={!canManage || saving}
            >
              {saving
                ? "Menyimpan…"
                : editingId
                  ? "Simpan perubahan"
                  : "Tambahkan titik absensi"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.attendanceMapCard}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Pratinjau titik</h2>
            <p className={styles.inlineHint}>
              Lingkaran menunjukkan radius absensi yang dikonfigurasi.
            </p>
          </div>
        </div>
        <div className={styles.attendanceMapPreview}>
          <span className={styles.attendanceMapRadius} />
          <span className={styles.attendanceMapPin}>⌖</span>
        </div>
        <div className={styles.attendanceMapMeta}>
          <div>
            <span>Koordinat</span>
            <strong>
              {hasCoordinates
                ? `${Number(latitude).toFixed(7)}, ${Number(longitude).toFixed(7)}`
                : "Belum ditentukan"}
            </strong>
          </div>
          <div>
            <span>Radius</span>
            <strong>{radius || "0"} meter</strong>
          </div>
        </div>
        {hasCoordinates ? (
          <a
            className={styles.mapExternalLink}
            href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=19/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`}
            rel="noreferrer"
            target="_blank"
          >
            Periksa titik pada peta ↗
          </a>
        ) : null}
      </section>

      <section className={`${styles.panel} ${styles.attendanceLocationList}`}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Titik yang tersimpan</h2>
            <p className={styles.inlineHint}>
              Hanya titik aktif dalam periode berlaku yang dapat menerima
              absensi.
            </p>
          </div>
          <span className={styles.countPill}>{locations.length}</span>
        </div>
        {locations.length ? (
          <div className={styles.attendanceLocationCards}>
            {locations.map((location) => {
              const state = locationStatus(location);
              return (
                <article key={String(location.id)}>
                  <div className={styles.attendanceLocationIdentity}>
                    <span>{String(location.code)}</span>
                    <strong>{String(location.name)}</strong>
                    <small>
                      {Number(location.latitude).toFixed(6)},{" "}
                      {Number(location.longitude).toFixed(6)}
                    </small>
                  </div>
                  <div className={styles.attendanceLocationRules}>
                    <span>
                      Radius <strong>{String(location.radiusMeters)} m</strong>
                    </span>
                    <span>
                      Akurasi maks.{" "}
                      <strong>
                        {String(location.maximumAccuracyMeters)} m
                      </strong>
                    </span>
                    <span>
                      Mulai <strong>{dateValue(location.effectiveFrom)}</strong>
                    </span>
                    <span>
                      Berakhir{" "}
                      <strong>
                        {location.effectiveTo
                          ? dateValue(location.effectiveTo)
                          : "Tanpa batas"}
                      </strong>
                    </span>
                  </div>
                  <span
                    className={`${styles.statusPill} ${
                      state === "Aktif sekarang"
                        ? styles.attendanceLocationActive
                        : ""
                    }`}
                  >
                    {state}
                  </span>
                  {canManage ? (
                    <div className={styles.attendanceLocationActions}>
                      <button
                        className={styles.secondaryButton}
                        onClick={() => edit(location)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className={styles.textButton}
                        onClick={() => setStatusTarget(location)}
                        type="button"
                      >
                        {String(location.status) === "ACTIVE"
                          ? "Nonaktifkan"
                          : "Aktifkan"}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            Belum ada titik absensi. Tambahkan titik pertama agar pemeriksaan
            lokasi dapat digunakan.
          </div>
        )}
      </section>

      <ReasonDialog
        confirmLabel={
          String(statusTarget?.status) === "ACTIVE"
            ? "Nonaktifkan titik"
            : "Aktifkan titik"
        }
        description="Perubahan status langsung memengaruhi lokasi yang dapat digunakan karyawan untuk absen."
        label="Alasan perubahan status"
        onCancel={() => {
          setStatusTarget(null);
          setStatusReason("");
        }}
        onConfirm={() => void changeStatus()}
        open={Boolean(statusTarget)}
        onChange={setStatusReason}
        title={
          String(statusTarget?.status) === "ACTIVE"
            ? "Nonaktifkan titik absensi?"
            : "Aktifkan titik absensi?"
        }
        value={statusReason}
      />
    </div>
  );
}
