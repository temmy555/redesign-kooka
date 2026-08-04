"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PaginationMeta } from "../../../src/platform/pagination";
import { DateField } from "./FormControls";
import PaginationControls from "./PaginationControls";
import StaffNotice, { type StaffNoticeMessage } from "./StaffNotice";
import styles from "../attendance.module.css";

type AttendanceView = "clock" | "history" | "report";
type CameraState = "starting" | "ready" | "paused" | "denied" | "unsupported";
type LocationState =
  | "locating"
  | "ready"
  | "outside"
  | "accuracy_rejected"
  | "unconfigured"
  | "denied"
  | "unsupported"
  | "error";
type WorkState = "not_started" | "working" | "finished";

type LocationCheck = {
  eligible: boolean;
  result: "INSIDE" | "OUTSIDE" | "ACCURACY_REJECTED" | "NO_ACTIVE_LOCATION";
  nearest: {
    id: string;
    code: string;
    name: string;
    radiusMeters: number;
    maximumAccuracyMeters: number;
    distanceMeters: number;
  } | null;
};

type HistoryItem = {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  duration: string;
  status: "Hadir" | "Belum checkout";
};

type SessionData = {
  id: string;
  businessDate: string;
  status: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  durationMinutes: number | null;
};

type ReportRow = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  businessDate: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  durationMinutes: number | null;
  locationName: string;
  geofenceResult: string;
  status: string;
};

type ReportData = {
  range: { start: string; end: string };
  metrics: {
    activeEmployees: number;
    present: number;
    working: number;
    missingCheckout: number;
    needsReview: number;
  };
  rows: ReportRow[];
  pagination: PaginationMeta;
};

function timeLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(value))
    .replace(".", ":");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function durationLabel(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—";
  return `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
}

function jakartaDate() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function shouldUseAttendanceCamera(
  view: AttendanceView,
  workState: WorkState,
  hasSelfie: boolean,
) {
  return view === "clock" && workState !== "finished" && !hasSelfie;
}

export function attendanceCameraLabel(
  cameraState: CameraState,
  hasSelfie: boolean,
) {
  if (hasSelfie) return "Foto siap";
  if (cameraState === "ready") return "Kamera siap";
  if (cameraState === "starting") return "Membuka kamera…";
  if (cameraState === "paused") return "Kamera dijeda";
  if (cameraState === "unsupported") return "Tidak didukung";
  return "Perlu izin";
}

async function responseError(response: Response) {
  const value = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return value?.error?.message ?? "Absensi belum dapat diproses.";
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7.8h3.1l1.2-2h7.4l1.2 2H20v10.4H4V7.8Z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 5h14v14H5zM8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 19V9m7 10V5m7 14v-7" />
    </svg>
  );
}

export default function AttendanceWorkspace({
  canViewReport,
  employeeName,
}: {
  canViewReport: boolean;
  employeeName: string;
}) {
  const [view, setView] = useState<AttendanceView>("clock");
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [locationState, setLocationState] = useState<LocationState>("locating");
  const [position, setPosition] = useState<GeolocationCoordinates | null>(null);
  const [locationCheck, setLocationCheck] = useState<LocationCheck | null>(
    null,
  );
  const [selfie, setSelfie] = useState<string | null>(null);
  const [todaySession, setTodaySession] = useState<SessionData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [search, setSearch] = useState("");
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<StaffNoticeMessage>(null);
  const [reportStartDate, setReportStartDate] = useState(jakartaDate);
  const [reportEndDate, setReportEndDate] = useState(jakartaDate);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const pendingMutationKey = useRef<string | null>(null);

  const workState: WorkState = !todaySession
    ? "not_started"
    : todaySession.status === "OPEN"
      ? "working"
      : "finished";
  const checkInTime = timeLabel(todaySession?.checkedInAt);
  const checkOutTime = timeLabel(todaySession?.checkedOutAt);
  const cameraShouldRun = shouldUseAttendanceCamera(
    view,
    workState,
    Boolean(selfie),
  );

  const stopCamera = useCallback((nextState?: CameraState) => {
    cameraRequestRef.current += 1;
    const stream = streamRef.current;
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    if (nextState) setCameraState(nextState);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      stopCamera();
      setCameraState("unsupported");
      return;
    }
    stopCamera();
    const requestId = cameraRequestRef.current;
    setCameraState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          height: { ideal: 1280 },
          width: { ideal: 960 },
        },
      });
      if (
        requestId !== cameraRequestRef.current ||
        document.visibilityState !== "visible"
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraState("paused");
        return;
      }
      streamRef.current = stream;
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener(
          "ended",
          () => {
            if (streamRef.current === stream) stopCamera("paused");
          },
          { once: true },
        );
      });
      video.srcObject = stream;
      await video.play();
    } catch {
      if (requestId !== cameraRequestRef.current) return;
      stopCamera();
      setCameraState("denied");
    }
  }, [stopCamera]);

  const markCameraReady = useCallback(() => {
    const video = videoRef.current;
    const hasLiveTrack = streamRef.current
      ?.getVideoTracks()
      .some((track) => track.readyState === "live");
    if (
      video &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      hasLiveTrack
    ) {
      setCameraState("ready");
    }
  }, []);

  const validateLocation = useCallback(
    async (coordinates: GeolocationCoordinates) => {
      try {
        const response = await fetch("/api/staff/attendance/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            accuracyMeters: coordinates.accuracy,
          }),
        });
        if (!response.ok) throw new Error("location-check-failed");
        const result = (await response.json()) as LocationCheck;
        setLocationCheck(result);
        if (result.eligible) setLocationState("ready");
        else if (result.result === "OUTSIDE") setLocationState("outside");
        else if (result.result === "ACCURACY_REJECTED")
          setLocationState("accuracy_rejected");
        else setLocationState("unconfigured");
      } catch {
        setLocationCheck(null);
        setLocationState("error");
      }
    },
    [],
  );

  const readLocation = useCallback(() => {
    setLocationState("locating");
    setLocationCheck(null);
    if (!navigator.geolocation) {
      setLocationState("unsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition(result.coords);
        void validateLocation(result.coords);
      },
      () => setLocationState("denied"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }, [validateLocation]);

  const loadSelfAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      const response = await fetch("/api/staff/attendance", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = (await response.json()) as {
        today: SessionData | null;
        history: SessionData[];
      };
      setTodaySession(data.today);
      if (data.today && data.today.status !== "OPEN") {
        stopCamera("paused");
      }
      setHistory(
        data.history.map((item) => ({
          id: item.id,
          date: dateLabel(item.businessDate),
          checkIn: timeLabel(item.checkedInAt),
          checkOut: timeLabel(item.checkedOutAt),
          duration: durationLabel(item.durationMinutes),
          status: item.status === "OPEN" ? "Belum checkout" : "Hadir",
        })),
      );
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Riwayat absensi belum dapat dimuat.",
      });
    } finally {
      setLoadingAttendance(false);
    }
  }, [stopCamera]);

  const loadReport = useCallback(
    async (
      startDate: string,
      endDate: string,
      page = 1,
      pageSize = 25,
      employeeSearch = "",
    ) => {
      if (startDate > endDate) {
        setNotice({
          tone: "error",
          message: "Tanggal awal tidak boleh melewati tanggal akhir.",
        });
        return;
      }
      setLoadingReport(true);
      try {
        const query = new URLSearchParams({
          view: "report",
          startDate,
          endDate,
          page: String(page),
          pageSize: String(pageSize),
          search: employeeSearch.trim(),
        });
        const response = await fetch(`/api/staff/attendance?${query}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await responseError(response));
        setReport((await response.json()) as ReportData);
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Laporan absensi belum dapat dimuat.",
        });
      } finally {
        setLoadingReport(false);
      }
    },
    [],
  );

  useEffect(() => {
    const activation = window.setTimeout(() => {
      readLocation();
      void loadSelfAttendance();
    }, 0);
    return () => {
      window.clearTimeout(activation);
    };
  }, [loadSelfAttendance, readLocation]);

  useEffect(() => {
    const activation = window.setTimeout(() => {
      if (!cameraShouldRun || document.visibilityState !== "visible") {
        stopCamera("paused");
        return;
      }
      void startCamera();
    }, 0);
    return () => {
      window.clearTimeout(activation);
      stopCamera();
    };
  }, [cameraShouldRun, startCamera, stopCamera]);

  useEffect(() => {
    const suspendCamera = () => stopCamera("paused");
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") suspendCamera();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && cameraShouldRun) setCameraState("paused");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", suspendCamera);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", suspendCamera);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [cameraShouldRun, stopCamera]);

  const captureSelfie = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSelfie(canvas.toDataURL("image/jpeg", 0.82));
    pendingMutationKey.current = null;
    stopCamera("paused");
  }, [stopCamera]);

  const retakeSelfie = useCallback(() => {
    pendingMutationKey.current = null;
    setSelfie(null);
  }, []);

  const attendanceReady = Boolean(
    selfie && locationState === "ready" && position && !submitting,
  );
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  async function recordAttendance() {
    if (!attendanceReady || !selfie || !position) return;
    setSubmitting(true);
    try {
      const selfieBlob = await fetch(selfie).then((response) =>
        response.blob(),
      );
      const form = new FormData();
      form.set("action", workState === "working" ? "CHECK_OUT" : "CHECK_IN");
      form.set("latitude", String(position.latitude));
      form.set("longitude", String(position.longitude));
      form.set("accuracyMeters", String(position.accuracy));
      form.set("deviceTime", new Date().toISOString());
      form.set(
        "selfie",
        new File([selfieBlob], "attendance-selfie.jpg", {
          type: "image/jpeg",
        }),
      );
      pendingMutationKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/staff/attendance", {
        method: "POST",
        headers: { "Idempotency-Key": pendingMutationKey.current },
        body: form,
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as { action: string };
      pendingMutationKey.current = null;
      setSelfie(null);
      await loadSelfAttendance();
      setNotice({
        tone: "success",
        message:
          result.action === "CHECK_IN"
            ? "Absen masuk berhasil disimpan. Selamat bekerja."
            : "Absen keluar berhasil disimpan. Terima kasih.",
      });
      if (result.action === "CHECK_OUT") stopCamera("paused");
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Absensi belum dapat disimpan.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function exportReport() {
    if (!report || report.pagination.totalItems === 0) return;
    const query = new URLSearchParams({
      view: "report",
      startDate: report.range.start,
      endDate: report.range.end,
      page: "1",
      pageSize: "25",
      search: search.trim(),
      export: "1",
    });
    const response = await fetch(`/api/staff/attendance?${query}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setNotice({
        tone: "error",
        message: "Data lengkap untuk ekspor belum dapat dimuat.",
      });
      return;
    }
    const workbook = await response.blob();
    const url = URL.createObjectURL(workbook);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-absensi-${report.range.start}-${report.range.end}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.attendancePage}>
      <StaffNotice notice={notice} onDismiss={() => setNotice(null)} />
      <header className={styles.attendanceHeader}>
        <div>
          <span className={styles.eyebrow}>Employee attendance</span>
          <h1>Halo, {employeeName.split(" ")[0]}</h1>
          <p>{today}</p>
        </div>
        <span className={styles.freeMode}>Mode bebas</span>
      </header>

      <nav aria-label="Menu absensi" className={styles.desktopTabs}>
        <button
          className={view === "clock" ? styles.tabActive : ""}
          onClick={() => setView("clock")}
          type="button"
        >
          <ClockIcon /> Absen
        </button>
        <button
          className={view === "history" ? styles.tabActive : ""}
          onClick={() => setView("history")}
          type="button"
        >
          <HistoryIcon /> Riwayat saya
        </button>
        {canViewReport ? (
          <button
            className={view === "report" ? styles.tabActive : ""}
            onClick={() => {
              setView("report");
              void loadReport(reportStartDate, reportEndDate);
            }}
            type="button"
          >
            <ReportIcon /> Laporan
          </button>
        ) : null}
      </nav>

      {view === "clock" ? (
        <section className={styles.clockView}>
          <div className={styles.statusHero}>
            <span>Status hari ini</span>
            <strong>
              {workState === "not_started"
                ? "Belum absen"
                : workState === "working"
                  ? "Sedang bekerja"
                  : "Absensi selesai"}
            </strong>
            <div className={styles.todayTimeline}>
              <div>
                <small>Masuk</small>
                <b>{checkInTime ?? "—"}</b>
              </div>
              <span />
              <div>
                <small>Keluar</small>
                <b>{checkOutTime ?? "—"}</b>
              </div>
            </div>
          </div>

          {workState !== "finished" ? (
            <div className={styles.captureGrid}>
              <section className={styles.cameraCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span>Langkah 1</span>
                    <h2>Ambil selfie</h2>
                  </div>
                  <span
                    className={`${styles.miniStatus} ${
                      cameraState === "ready" || selfie ? styles.statusOkay : ""
                    }`}
                  >
                    {attendanceCameraLabel(cameraState, Boolean(selfie))}
                  </span>
                </div>
                <div className={styles.cameraViewport}>
                  <video
                    aria-label="Pratinjau kamera depan"
                    autoPlay
                    muted
                    onCanPlay={markCameraReady}
                    onPlaying={markCameraReady}
                    playsInline
                    ref={videoRef}
                  />
                  {selfie ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local camera capture has no stable URL.
                    <img alt="Hasil selfie absensi" src={selfie} />
                  ) : null}
                  {cameraState !== "ready" && !selfie ? (
                    <div className={styles.cameraFallback}>
                      <CameraIcon />
                      <strong>
                        {cameraState === "starting"
                          ? "Menyiapkan kamera depan"
                          : cameraState === "paused"
                            ? "Kamera dijeda"
                            : cameraState === "unsupported"
                              ? "Kamera tidak didukung"
                              : "Kamera belum dapat digunakan"}
                      </strong>
                      <p>
                        {cameraState === "paused"
                          ? "Aktifkan kamera saat Anda siap mengambil selfie."
                          : cameraState === "unsupported"
                            ? "Gunakan browser atau perangkat yang mendukung akses kamera."
                            : "Izinkan akses kamera pada browser, lalu coba kembali."}
                      </p>
                    </div>
                  ) : null}
                  {cameraState === "ready" && !selfie ? (
                    <span className={styles.faceGuide} aria-hidden="true" />
                  ) : null}
                </div>
                <div className={styles.cameraActions}>
                  {selfie ? (
                    <button onClick={retakeSelfie} type="button">
                      <CameraIcon /> Ambil ulang
                    </button>
                  ) : cameraState === "ready" ? (
                    <>
                      <button onClick={captureSelfie} type="button">
                        <CameraIcon /> Ambil foto
                      </button>
                      <button
                        className={styles.cameraStopButton}
                        onClick={() => stopCamera("paused")}
                        type="button"
                      >
                        Matikan kamera
                      </button>
                    </>
                  ) : (
                    <button onClick={() => void startCamera()} type="button">
                      Aktifkan kamera
                    </button>
                  )}
                  {selfie ? <span>Foto siap digunakan</span> : null}
                </div>
              </section>

              <section className={styles.locationCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span>Langkah 2</span>
                    <h2>Pastikan lokasi</h2>
                  </div>
                  <span
                    className={`${styles.miniStatus} ${
                      locationState === "ready" ? styles.statusOkay : ""
                    }`}
                  >
                    {locationState === "ready"
                      ? "Dalam jangkauan"
                      : locationState === "locating"
                        ? "Memeriksa…"
                        : locationState === "outside"
                          ? "Di luar area"
                          : locationState === "accuracy_rejected"
                            ? "Akurasi rendah"
                            : locationState === "unconfigured"
                              ? "Belum disetel"
                              : locationState === "error"
                                ? "Gagal memeriksa"
                                : "Perlu izin"}
                  </span>
                </div>
                <div className={styles.locationMap}>
                  <div className={styles.mapRings}>
                    <span />
                    <span />
                    <span>
                      <LocationIcon />
                    </span>
                  </div>
                </div>
                <div className={styles.locationDetail}>
                  <div>
                    <span>Titik absensi</span>
                    <strong>
                      {locationCheck?.nearest?.name ??
                        (locationState === "unconfigured"
                          ? "Belum ada titik aktif"
                          : "Menunggu pemeriksaan lokasi")}
                    </strong>
                    <small>
                      {locationCheck?.nearest
                        ? `Jarak ${Math.round(locationCheck.nearest.distanceMeters)} m · radius ${locationCheck.nearest.radiusMeters} m · akurasi maks. ${locationCheck.nearest.maximumAccuracyMeters} m.`
                        : "Validasi dilakukan server terhadap titik aktif yang ditetapkan admin."}
                    </small>
                  </div>
                  {position ? (
                    <div className={styles.accuracyBadge}>
                      <span>Akurasi perangkat</span>
                      <strong>±{Math.round(position.accuracy)} m</strong>
                    </div>
                  ) : null}
                </div>
                {locationState !== "ready" ? (
                  <button
                    className={styles.locationRetry}
                    onClick={readLocation}
                    type="button"
                  >
                    Periksa lokasi
                  </button>
                ) : null}
              </section>
            </div>
          ) : (
            <section className={styles.completedCard}>
              <span>✓</span>
              <div>
                <h2>Absensi hari ini selesai</h2>
                <p>
                  Terima kasih. Catatan masuk dan keluar Anda sudah lengkap.
                </p>
              </div>
            </section>
          )}

          {workState !== "finished" ? (
            <div className={styles.attendanceActionBar}>
              <div>
                <span>{selfie ? "✓ Selfie siap" : "○ Selfie diperlukan"}</span>
                <span>
                  {locationState === "ready"
                    ? "✓ Berada dalam titik absensi"
                    : "○ Lokasi diperlukan"}
                </span>
              </div>
              <button
                disabled={!attendanceReady}
                onClick={() => void recordAttendance()}
                type="button"
              >
                {submitting
                  ? "Menyimpan…"
                  : workState === "working"
                    ? "Absen keluar"
                    : "Absen masuk"}
              </button>
            </div>
          ) : null}
          {loadingAttendance ? (
            <p className={styles.prototypeNote}>Memuat catatan absensi…</p>
          ) : null}
        </section>
      ) : null}

      {view === "history" ? (
        <section className={styles.historyView}>
          <div className={styles.viewHeading}>
            <div>
              <span>Catatan pribadi</span>
              <h2>Riwayat absensi saya</h2>
              <p>Hanya pemilik akun dan admin berizin yang dapat melihatnya.</p>
            </div>
            <span className={styles.monthPill}>Agustus 2026</span>
          </div>
          <div className={styles.historyList}>
            {history.map((item) => (
              <article key={item.id}>
                <div className={styles.historyDate}>
                  <span>{item.date.split(",")[0]}</span>
                  <strong>{item.date.split(",")[1]}</strong>
                </div>
                <div className={styles.historyTimes}>
                  <span>
                    Masuk <strong>{item.checkIn}</strong>
                  </span>
                  <i />
                  <span>
                    Keluar <strong>{item.checkOut}</strong>
                  </span>
                </div>
                <div className={styles.historyResult}>
                  <span
                    className={
                      item.status === "Hadir" ? styles.present : styles.missing
                    }
                  >
                    {item.status}
                  </span>
                  <strong>{item.duration}</strong>
                </div>
              </article>
            ))}
            {!loadingAttendance && history.length === 0 ? (
              <div className={styles.prototypeNote}>
                Belum ada riwayat absensi.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {view === "report" && canViewReport ? (
        <section className={styles.reportView}>
          <div className={styles.viewHeading}>
            <div>
              <span>Owner &amp; administrator</span>
              <h2>Laporan absensi</h2>
              <p>Pantau kehadiran dan catatan yang perlu diperiksa.</p>
            </div>
            <button
              className={styles.exportButton}
              disabled={!report || report.pagination.totalItems === 0}
              onClick={() => void exportReport()}
              type="button"
            >
              Ekspor Excel
            </button>
          </div>
          <div className={styles.reportFilters}>
            <div className={styles.dateRangeFilter}>
              <label>
                <span>Dari tanggal</span>
                <DateField
                  ariaLabel="Tanggal awal laporan"
                  max={reportEndDate}
                  onChange={(value) => setReportStartDate(value)}
                  value={reportStartDate}
                />
              </label>
              <span className={styles.dateRangeSeparator} aria-hidden="true">
                →
              </span>
              <label>
                <span>Sampai tanggal</span>
                <DateField
                  ariaLabel="Tanggal akhir laporan"
                  min={reportStartDate}
                  onChange={(value) => setReportEndDate(value)}
                  value={reportEndDate}
                />
              </label>
              <button
                className={styles.applyDateFilter}
                disabled={loadingReport}
                onClick={() =>
                  void loadReport(
                    reportStartDate,
                    reportEndDate,
                    1,
                    report?.pagination.pageSize ?? 25,
                    search,
                  )
                }
                type="button"
              >
                {loadingReport ? "Memuat…" : "Tampilkan"}
              </button>
            </div>
            <div className={styles.reportSearch}>
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Cari nama karyawan"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama karyawan"
                type="search"
                value={search}
              />
            </div>
          </div>
          <div className={styles.reportMetrics}>
            <article>
              <span>Hadir</span>
              <strong>{report?.metrics.present ?? 0}</strong>
              <small>
                Dari {report?.metrics.activeEmployees ?? 0} karyawan aktif
              </small>
            </article>
            <article>
              <span>Sedang bekerja</span>
              <strong>{report?.metrics.working ?? 0}</strong>
              <small>Session masih terbuka</small>
            </article>
            <article>
              <span>Belum checkout</span>
              <strong>{report?.metrics.missingCheckout ?? 0}</strong>
              <small>Perlu ditanyakan langsung</small>
            </article>
            <article>
              <span>Perlu diperiksa</span>
              <strong>{report?.metrics.needsReview ?? 0}</strong>
              <small>Lokasi atau akurasi</small>
            </article>
          </div>
          <div className={styles.reportTableWrap}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Masuk</th>
                  <th>Keluar</th>
                  <th>Durasi</th>
                  <th>Lokasi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(report?.rows ?? []).map((row) => (
                  <tr key={`${row.employeeId}-${row.businessDate}`}>
                    <td>
                      <strong>{row.employeeName}</strong>
                      <small>
                        {row.employeeCode} · {row.businessDate}
                      </small>
                    </td>
                    <td>{timeLabel(row.checkedInAt)}</td>
                    <td>{timeLabel(row.checkedOutAt)}</td>
                    <td>
                      {row.status === "Sedang bekerja"
                        ? "Berjalan"
                        : durationLabel(row.durationMinutes)}
                    </td>
                    <td>{row.locationName}</td>
                    <td>
                      <span
                        className={
                          row.status === "Lengkap" ||
                          row.status === "Sedang bekerja"
                            ? styles.present
                            : styles.missing
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report ? (
            <PaginationControls
              onPageChange={(page) =>
                void loadReport(
                  reportStartDate,
                  reportEndDate,
                  page,
                  report.pagination.pageSize,
                  search,
                )
              }
              onPageSizeChange={(pageSize) =>
                void loadReport(
                  reportStartDate,
                  reportEndDate,
                  1,
                  pageSize,
                  search,
                )
              }
              pageSizes={[25, 50, 100]}
              pagination={report.pagination}
            />
          ) : null}
          {report && report.rows.length === 0 ? (
            <p className={styles.prototypeNote}>
              Belum ada catatan absensi pada periode ini.
            </p>
          ) : null}
        </section>
      ) : null}

      <nav aria-label="Navigasi bawah absensi" className={styles.mobileTabs}>
        <button
          className={view === "clock" ? styles.mobileTabActive : ""}
          onClick={() => setView("clock")}
          type="button"
        >
          <ClockIcon /> <span>Absen</span>
        </button>
        <button
          className={view === "history" ? styles.mobileTabActive : ""}
          onClick={() => setView("history")}
          type="button"
        >
          <HistoryIcon /> <span>Riwayat</span>
        </button>
        {canViewReport ? (
          <button
            className={view === "report" ? styles.mobileTabActive : ""}
            onClick={() => {
              setView("report");
              void loadReport(reportStartDate, reportEndDate);
            }}
            type="button"
          >
            <ReportIcon /> <span>Laporan</span>
          </button>
        ) : null}
      </nav>
    </div>
  );
}
