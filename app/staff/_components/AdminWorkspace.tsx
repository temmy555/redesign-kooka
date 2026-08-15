"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DateField,
  FileField,
  MultiFileField,
  type SelectOption,
  KookaSelect,
  MoneyInput,
  ReasonDialog,
} from "./FormControls";
import AttendanceLocationAdmin from "./AttendanceLocationAdmin";
import PaginationControls from "./PaginationControls";
import StaffNotice from "./StaffNotice";
import styles from "../staff.module.css";
import { auditActionLabel } from "../../../src/platform/audit-labels";
import type { PaginationMeta } from "../../../src/platform/pagination";

type JsonRecord = Record<string, unknown>;
type Notice = { tone: "success" | "error"; message: string } | null;

const areas = [
  ["setup", "Setup awal"],
  ["property", "Properti & waktu"],
  ["rooms", "Kamar"],
  ["commercial", "Harga & pembayaran"],
  ["content", "Landing & menu"],
  ["team", "Staf"],
  ["attendance", "Lokasi absensi"],
  ["reports", "Laporan"],
] as const;

type AdminArea = (typeof areas)[number][0];

const roleOptions: SelectOption[] = [
  { value: "", label: "Tanpa role awal" },
  { value: "OWNER", label: "Owner" },
  { value: "FRONT_OFFICE", label: "Front Office" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "FNB", label: "F&B" },
] as SelectOption[];

const standardRoomAmenities = [
  {
    code: "GARDEN_VIEW",
    iconKey: "garden-view",
    nameId: "Pemandangan taman",
    nameEn: "Garden view",
    selectedByDefault: true,
  },
  {
    code: "ELECTRIC_KETTLE",
    iconKey: "electric-kettle",
    nameId: "Ketel listrik",
    nameEn: "Electric kettle",
    selectedByDefault: true,
  },
  {
    code: "PRIVATE_BATHROOM",
    iconKey: "private-bathroom",
    nameId: "Kamar mandi pribadi",
    nameEn: "Private bathroom",
    selectedByDefault: true,
  },
  {
    code: "SHOWER",
    iconKey: "shower",
    nameId: "Shower",
    nameEn: "Shower",
    selectedByDefault: true,
  },
  {
    code: "AIR_CONDITIONING",
    iconKey: "air-conditioning",
    nameId: "AC",
    nameEn: "Air conditioning",
    selectedByDefault: true,
  },
  {
    code: "NO_SMOKING",
    iconKey: "no-smoking",
    nameId: "Dilarang merokok",
    nameEn: "No smoking",
    selectedByDefault: true,
  },
  {
    code: "WORK_DINING_TABLE",
    iconKey: "work-dining-table",
    nameId: "Meja kerja / makan",
    nameEn: "Work / dining table",
    selectedByDefault: false,
  },
  {
    code: "SIDE_TABLE",
    iconKey: "side-table",
    nameId: "Meja samping",
    nameEn: "Side table",
    selectedByDefault: false,
  },
  {
    code: "SHELVES",
    iconKey: "shelves",
    nameId: "Rak",
    nameEn: "Shelves",
    selectedByDefault: false,
  },
  {
    code: "MEZZANINE_SPACE",
    iconKey: "mezzanine-space",
    nameId: "Area mezzanine",
    nameEn: "Mezzanine space",
    selectedByDefault: false,
  },
  {
    code: "ONE_SHARED_BATHROOM",
    iconKey: "shared-bathroom",
    nameId: "1 kamar mandi bersama",
    nameEn: "1 shared bathroom",
    selectedByDefault: false,
  },
  {
    code: "PRIVATE_ROOM_ENTRANCE",
    iconKey: "private-room-entrance",
    nameId: "Setiap kamar memiliki pintu sendiri",
    nameEn: "Each room has its own door",
    selectedByDefault: false,
  },
  {
    code: "SPACIOUS_CONNECTING_CORRIDOR",
    iconKey: "spacious-corridor",
    nameId: "Terhubung melalui koridor yang luas",
    nameEn: "Connected by a spacious corridor",
    selectedByDefault: false,
  },
  {
    code: "TOWEL_RACK",
    iconKey: "towel-rack",
    nameId: "Rak handuk",
    nameEn: "Towel rack",
    selectedByDefault: false,
  },
  {
    code: "STORAGE_RACK",
    iconKey: "storage-rack",
    nameId: "Rak penyimpanan",
    nameEn: "Storage rack",
    selectedByDefault: false,
  },
] as const;

function key(action: string) {
  return `${action}:${crypto.randomUUID()}`;
}

function internalCode(prefix: string, maximumLength = 80) {
  const suffix = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase();
  const prefixLimit = Math.max(1, maximumLength - suffix.length - 1);
  const normalized = prefix
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toUpperCase()
    .slice(0, prefixLimit);
  return `${normalized || "I"}-${suffix}`;
}

function messageFrom(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    value.error &&
    typeof value.error === "object" &&
    "message" in value.error
  )
    return String(value.error.message);
  return "Permintaan belum dapat diproses.";
}

async function post(endpoint: string, body: JsonRecord, method = "POST") {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key(String(body.action ?? "admin")),
    },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(messageFrom(result));
  return result as JsonRecord;
}

function human(value: string) {
  return value.replaceAll("_", " ").toLocaleLowerCase("id-ID");
}

function latestBy(items: JsonRecord[], parentKey: string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const parentId = String(item[parentKey] ?? "");
    if (!parentId || seen.has(parentId)) return false;
    seen.add(parentId);
    return true;
  });
}

function activeVersion(item: JsonRecord) {
  return ["ACTIVE", "SCHEDULED"].includes(String(item.lifecycleStatus));
}

export function effectiveVersion(item: JsonRecord, now = Date.now()) {
  if (typeof item.effectiveNow === "boolean") return item.effectiveNow;
  if (!activeVersion(item)) return false;
  const effectiveFrom = new Date(String(item.effectiveFrom ?? "")).getTime();
  if (!Number.isFinite(effectiveFrom) || effectiveFrom > now) return false;
  if (item.effectiveTo === null || item.effectiveTo === undefined) return true;
  const effectiveTo = new Date(String(item.effectiveTo)).getTime();
  return Number.isFinite(effectiveTo) && effectiveTo > now;
}

function recordOf(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function rowsOf(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? (value as JsonRecord[]) : [];
}

function percent(value: unknown) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value ?? 0) * 100)}%`;
}

function dateLabel(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function idr(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function scrollToForm(id: string) {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 0);
}

function propertyConfigurationKey(value: unknown) {
  if (!value || typeof value !== "object") return "property-loading";
  const settings = (value as JsonRecord).settings;
  if (!Array.isArray(settings)) return "property-loaded";
  return settings
    .map((setting) => {
      if (!setting || typeof setting !== "object") return "";
      const resolved = (setting as JsonRecord).resolved;
      return resolved && typeof resolved === "object"
        ? String((resolved as JsonRecord).versionId ?? "")
        : "inactive";
    })
    .join("|");
}

export default function AdminWorkspace({
  permissions,
}: {
  permissions: string[];
}) {
  const granted = useMemo(() => new Set(permissions), [permissions]);
  const availableAreas = areas.filter(([area]) => {
    if (area === "setup") return true;
    if (area === "property") return granted.has("configuration.view");
    if (area === "rooms") return granted.has("room_master.view");
    if (area === "commercial") return granted.has("commercial.view");
    if (area === "content")
      return granted.has("cms.content.view") || granted.has("commercial.view");
    if (area === "team")
      return (
        granted.has("identity.employee.manage") && granted.has("audit.view")
      );
    if (area === "attendance")
      return (
        granted.has("attendance.location.view") ||
        granted.has("attendance.report.view")
      );
    return granted.has("report.view");
  });
  const [active, setActive] = useState<AdminArea>(
    availableAreas[0]?.[0] ?? "setup",
  );
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const endpoints: Array<[string, string]> = [];
    if (granted.has("configuration.view"))
      endpoints.push(["property", "/api/staff/admin/configuration"]);
    if (granted.has("room_master.view"))
      endpoints.push(["rooms", "/api/staff/admin/room-master"]);
    if (granted.has("commercial.view"))
      endpoints.push(
        ["commercial", "/api/staff/admin/commercial-master"],
        ["menu", "/api/staff/admin/menu"],
      );
    if (granted.has("cms.content.view"))
      endpoints.push(["content", "/api/staff/admin/content"]);
    if (granted.has("cms.media.manage"))
      endpoints.push(["media", "/api/staff/admin/media"]);
    if (granted.has("identity.employee.manage") && granted.has("audit.view"))
      endpoints.push(["team", "/api/staff/admin/overview"]);
    if (granted.has("attendance.location.view"))
      endpoints.push(["attendance", "/api/staff/admin/attendance-locations"]);
    try {
      const settled = await Promise.allSettled(
        endpoints.map(async ([name, endpoint]) => {
          const response = await fetch(endpoint, { cache: "no-store" });
          if (response.ok) {
            return { name, response: await response.json() } as const;
          }
          let details = "";
          try {
            const payload = await response.json();
            const message =
              typeof payload?.error === "object" && payload.error
                ? String(payload.error.message ?? payload.error.code ?? "")
                : "";
            details = message ? ` (${message})` : "";
          } catch {
            try {
              details = ` (${await response.text()})`;
            } catch {
              details = "";
            }
          }
          return {
            name,
            response: null,
            error: `${endpoint} -> ${response.status}${details}`,
          };
        }),
      );
      const partial: Record<string, unknown> = {};
      const failed: string[] = [];
      for (const item of settled) {
        if (item.status === "fulfilled" && item.value.response !== null) {
          partial[item.value.name] = item.value.response;
          continue;
        }
        const errorMessage =
          item.status === "fulfilled"
            ? item.value.error
            : item.reason instanceof Error
              ? item.reason.message
              : String(item.reason);
        failed.push(String(errorMessage ?? "Unknown admin endpoint error"));
      }
      setData(partial);
      if (failed.length > 0) {
        console.error("Failed to load admin endpoints:", failed);
        setNotice({
          tone: "error",
          message: `Sebagian data administrasi gagal dimuat: ${failed.join("; ")}.`,
        });
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Sebagian data administrasi belum dapat dimuat.",
      });
    } finally {
      setLoading(false);
    }
  }, [granted, setNotice]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Owner & administration</span>
          <h1>Pengaturan</h1>
          <p>
            Data properti, kamar, harga, konten, staf, audit, dan laporan dalam
            satu pusat kontrol.
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
      <nav aria-label="Bagian pengaturan" className={styles.workspaceTabs}>
        {availableAreas.map(([area, label]) => (
          <button
            aria-current={active === area ? "page" : undefined}
            className={active === area ? styles.workspaceTabActive : ""}
            key={area}
            onClick={() => {
              setActive(area);
              setNotice(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <StaffNotice notice={notice} onDismiss={() => setNotice(null)} />
      {active === "setup" ? (
        <SetupOverview
          availableAreas={availableAreas.map(([area]) => area)}
          data={data}
          loading={loading}
          onOpen={setActive}
        />
      ) : null}
      {active === "property" ? (
        <PropertyAdmin
          data={(data.property ?? {}) as JsonRecord}
          key={propertyConfigurationKey(data.property)}
          load={load}
          setNotice={setNotice}
        />
      ) : null}
      {active === "rooms" ? (
        <RoomAdmin
          data={(data.rooms ?? {}) as JsonRecord}
          load={load}
          setNotice={setNotice}
        />
      ) : null}
      {active === "commercial" ? (
        <CommercialAdmin
          data={(data.commercial ?? {}) as JsonRecord}
          propertyData={(data.property ?? {}) as JsonRecord}
          roomData={(data.rooms ?? {}) as JsonRecord}
          load={load}
          setNotice={setNotice}
        />
      ) : null}
      {active === "content" ? (
        <ContentAdmin
          commercial={data.commercial}
          content={data.content}
          media={data.media}
          menu={data.menu}
          rooms={data.rooms}
          canManageMedia={granted.has("cms.media.manage")}
          canPublishMedia={granted.has("cms.media.publish")}
          canManageMenu={granted.has("commercial.manage")}
          load={load}
          setNotice={setNotice}
        />
      ) : null}
      {active === "team" ? (
        <TeamAdmin
          data={(data.team ?? {}) as JsonRecord}
          load={load}
          setNotice={setNotice}
        />
      ) : null}
      {active === "attendance" ? (
        <AttendanceLocationAdmin
          canManage={granted.has("attendance.location.manage")}
          data={(data.attendance ?? {}) as JsonRecord}
          load={load}
          setNotice={setNotice}
        />
      ) : null}
      {active === "reports" ? <ReportAdmin setNotice={setNotice} /> : null}
    </>
  );
}

type SetupStep = {
  area: Exclude<AdminArea, "setup">;
  title: string;
  description: string;
  level: "WAJIB" | "DISARANKAN" | "OPSIONAL" | "SIAP";
  done: boolean;
  checks: Array<{ label: string; done: boolean }>;
};

function SetupOverview({
  availableAreas,
  data,
  loading,
  onOpen,
}: {
  availableAreas: AdminArea[];
  data: Record<string, unknown>;
  loading: boolean;
  onOpen: (area: AdminArea) => void;
}) {
  const propertyData = recordOf(data.property);
  const property = recordOf(propertyData.property);
  const settings = rowsOf(propertyData.settings);
  const hasActiveSetting = (code: string) =>
    settings.some(
      (setting) =>
        String(setting.code) === code &&
        Boolean(setting.resolved) &&
        typeof setting.resolved === "object",
    );
  const propertyProfileReady = Boolean(property.name && property.address);
  const stayTimingReady = hasActiveSetting("STAY_TIMING");
  const paymentDeadlineReady = hasActiveSetting("BOOKING_PAYMENT");

  const roomData = recordOf(data.rooms);
  const activeRoomTypes = latestBy(
    rowsOf(roomData.roomTypes),
    "roomTypeId",
  ).filter(activeVersion);
  const activeRoomUnits = rowsOf(roomData.roomUnits).filter(
    (room) =>
      String(room.status ?? "ACTIVE") === "ACTIVE" && Boolean(room.roomTypeId),
  );

  const commercialData = recordOf(data.commercial);
  const activeRates = latestBy(
    rowsOf(commercialData.ratePlans),
    "ratePlanId",
  ).filter(activeVersion);
  const activeInstructions = latestBy(
    rowsOf(commercialData.paymentInstructions),
    "instructionSetId",
  ).filter(activeVersion);
  const activeDocumentProfiles = rowsOf(commercialData.documents).filter(
    effectiveVersion,
  );
  const activeTaxes = latestBy(
    rowsOf(commercialData.taxes),
    "profileId",
  ).filter(activeVersion);
  const lodgingTaxes = activeTaxes.filter(
    (tax) => String(tax.domain) === "LODGING",
  );
  const ratesWithoutTaxDecision = activeRates.filter(
    (rate) =>
      !lodgingTaxes.some(
        (tax) => String(tax.profileId) === String(rate.taxProfileId ?? ""),
      ),
  );
  const explicitlyUntaxedRates = activeRates.filter((rate) =>
    lodgingTaxes.some(
      (tax) =>
        String(tax.profileId) === String(rate.taxProfileId ?? "") &&
        Boolean(tax.noTax),
    ),
  );
  const activeRateVersionIds = new Set(
    activeRates.map((rate) => String(rate.versionId)),
  );
  const pricedRoomTypeIds = new Set(
    rowsOf(commercialData.rateRules)
      .filter((rule) =>
        activeRateVersionIds.has(String(rule.ratePlanVersionId)),
      )
      .map((rule) => String(rule.roomTypeId)),
  );
  const allRoomTypesPriced =
    activeRoomTypes.length > 0 &&
    activeRoomTypes.every((roomType) =>
      pricedRoomTypeIds.has(String(roomType.roomTypeId)),
    );

  const contentReady =
    rowsOf(data.media).length > 0 ||
    rowsOf(data.content).length > 0 ||
    rowsOf(data.menu).length > 0;
  const teamData = recordOf(data.team);
  const team = rowsOf(teamData.team);
  const roleCodes = new Set(
    rowsOf(teamData.grants).map((grant) => String(grant.roleCode)),
  );
  const frontOfficeReady = roleCodes.has("FRONT_OFFICE");
  const attendanceLocations = rowsOf(recordOf(data.attendance).locations);
  const attendanceReady = attendanceLocations.some(
    (location) => String(location.status) === "ACTIVE",
  );

  const steps: SetupStep[] = [
    {
      area: "property",
      title: "Properti dan waktu operasional",
      description:
        "Isi identitas properti, jam check-in/checkout, dan batas pembayaran online.",
      level: "WAJIB",
      done: propertyProfileReady && stayTimingReady && paymentDeadlineReady,
      checks: [
        { label: "Profil dan alamat", done: propertyProfileReady },
        { label: "Jam menginap", done: stayTimingReady },
        { label: "Batas pembayaran", done: paymentDeadlineReady },
      ],
    },
    {
      area: "rooms",
      title: "Jenis dan nomor kamar",
      description:
        "Buat jenis kamar yang dipilih tamu, lalu hubungkan nomor kamar fisik.",
      level: "WAJIB",
      done: activeRoomTypes.length > 0 && activeRoomUnits.length > 0,
      checks: [
        {
          label: `${activeRoomTypes.length} jenis aktif`,
          done: activeRoomTypes.length > 0,
        },
        {
          label: `${activeRoomUnits.length} kamar siap`,
          done: activeRoomUnits.length > 0,
        },
      ],
    },
    {
      area: "commercial",
      title: "Harga dan pembayaran",
      description:
        "Pasang harga, tentukan pajak, aktifkan rekening transfer, dan siapkan profil dokumen.",
      level: "WAJIB",
      done:
        allRoomTypesPriced &&
        activeInstructions.length > 0 &&
        activeRates.length > 0 &&
        ratesWithoutTaxDecision.length === 0 &&
        activeDocumentProfiles.length > 0,
      checks: [
        {
          label: "Semua jenis kamar memiliki harga",
          done: allRoomTypesPriced,
        },
        {
          label: `${activeInstructions.length} rekening transfer aktif`,
          done: activeInstructions.length > 0,
        },
        {
          label: !activeRates.length
            ? "Status pajak diperiksa setelah harga dibuat"
            : ratesWithoutTaxDecision.length
              ? `${ratesWithoutTaxDecision.length} harga belum menentukan pajak`
              : explicitlyUntaxedRates.length
                ? `${explicitlyUntaxedRates.length} harga ditetapkan tanpa pajak`
                : "Semua harga memakai pajak",
          done: activeRates.length > 0 && !ratesWithoutTaxDecision.length,
        },
        {
          label: activeDocumentProfiles.length
            ? "Profil invoice dan kuitansi aktif"
            : "Profil invoice dan kuitansi belum aktif",
          done: activeDocumentProfiles.length > 0,
        },
      ],
    },
    {
      area: "content",
      title: "Landing page dan menu",
      description:
        "Tambahkan foto properti, konten landing, serta katalog makanan bila diperlukan.",
      level: "DISARANKAN",
      done: contentReady,
      checks: [
        {
          label: "Konten, foto, atau menu sudah tersedia",
          done: contentReady,
        },
      ],
    },
    {
      area: "team",
      title: "Akun dan role staf",
      description:
        "Buat akun individual dan pilih role agar setiap staf hanya melihat tugasnya.",
      level: "DISARANKAN",
      done: team.length > 0 && frontOfficeReady,
      checks: [
        { label: `${team.length} akun staf`, done: team.length > 0 },
        { label: "Front Office tersedia", done: frontOfficeReady },
      ],
    },
    {
      area: "attendance",
      title: "Titik absensi",
      description:
        "Tentukan lokasi dan radius absensi jika fitur attendance akan digunakan.",
      level: "OPSIONAL",
      done: attendanceReady,
      checks: [{ label: "Minimal satu titik aktif", done: attendanceReady }],
    },
    {
      area: "reports",
      title: "Laporan",
      description:
        "Tidak memerlukan setup. Laporan terisi otomatis setelah operasional berjalan.",
      level: "SIAP",
      done: true,
      checks: [{ label: "Tidak perlu konfigurasi", done: true }],
    },
  ];
  const visibleSteps = steps.filter((step) =>
    availableAreas.includes(step.area),
  );
  const requiredSteps = visibleSteps.filter((step) => step.level === "WAJIB");
  const completedRequired = requiredSteps.filter((step) => step.done).length;
  const nextStep =
    requiredSteps.find((step) => !step.done) ??
    visibleSteps.find((step) => !step.done && step.level !== "OPSIONAL");
  const progress = requiredSteps.length
    ? Math.round((completedRequired / requiredSteps.length) * 100)
    : 100;

  return (
    <div className={styles.setupWorkspace}>
      <section className={styles.setupHero}>
        <div>
          <span className={styles.pageEyebrow}>Panduan setup</span>
          <h2>Siapkan sistem sesuai urutan</h2>
          <p>
            Selesaikan tiga tahap wajib agar pencarian kamar, booking online,
            pembayaran, dan penerbitan dokumen dapat berjalan.
          </p>
        </div>
        <div className={styles.setupProgressSummary}>
          <strong>{loading ? "…" : `${progress}%`}</strong>
          <span>
            {loading
              ? "Memeriksa data"
              : `${completedRequired} dari ${requiredSteps.length} tahap wajib selesai`}
          </span>
          <div
            aria-label={`Progres setup ${progress}%`}
            className={styles.setupProgressTrack}
          >
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>
      <section className={styles.setupSteps}>
        {visibleSteps.map((step, index) => (
          <article
            className={`${styles.setupStepCard} ${step.done ? styles.setupStepDone : ""}`}
            key={step.area}
          >
            <div className={styles.setupStepNumber}>{index + 1}</div>
            <div className={styles.setupStepBody}>
              <div className={styles.setupStepHeading}>
                <div>
                  <span>{step.level}</span>
                  <h3>{step.title}</h3>
                </div>
                <span
                  className={`${styles.setupStatus} ${step.done ? styles.setupStatusDone : ""}`}
                >
                  {loading
                    ? "Memeriksa"
                    : step.done
                      ? "Siap"
                      : step.level === "OPSIONAL"
                        ? "Belum diatur"
                        : "Perlu dilengkapi"}
                </span>
              </div>
              <p>{step.description}</p>
              <div className={styles.setupChecks}>
                {step.checks.map((check) => (
                  <span key={check.label}>
                    <i className={check.done ? styles.checkDone : ""} />
                    {check.label}
                  </span>
                ))}
              </div>
            </div>
            <button
              className={
                step.done ? styles.secondaryButton : styles.primaryButton
              }
              onClick={() => onOpen(step.area)}
              type="button"
            >
              {step.done ? "Lihat" : "Atur sekarang"}
            </button>
          </article>
        ))}
      </section>
      {nextStep ? (
        <section className={styles.setupNextAction}>
          <div>
            <span>Langkah berikutnya</span>
            <strong>{nextStep.title}</strong>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => onOpen(nextStep.area)}
            type="button"
          >
            Lanjutkan setup
          </button>
        </section>
      ) : (
        <section
          className={`${styles.setupNextAction} ${styles.setupComplete}`}
        >
          <div>
            <span>Setup utama selesai</span>
            <strong>Alur booking hingga penerbitan dokumen sudah siap.</strong>
          </div>
        </section>
      )}
    </div>
  );
}

function PropertyAdmin({ data, load, setNotice }: AdminProps) {
  const property = (data.property ?? {}) as JsonRecord;
  const settings = Array.isArray(data.settings)
    ? (data.settings as JsonRecord[])
    : [];
  const [name, setName] = useState(String(property.name ?? ""));
  const [address, setAddress] = useState(String(property.address ?? ""));
  const [timezone, setTimezone] = useState(
    String(property.timezone ?? "Asia/Jakarta"),
  );
  const [locale, setLocale] = useState(String(property.defaultLocale ?? "en"));
  const [reason, setReason] = useState("");
  const settingByCode = (code: string) =>
    settings.find((setting) => String(setting.code) === code);
  const staySetting = settingByCode("STAY_TIMING");
  const paymentSetting = settingByCode("BOOKING_PAYMENT");
  const extraBedSetting = settingByCode("EXTRA_BED_PRICING");
  const valuesOf = (setting: JsonRecord | undefined) => {
    const resolved = setting?.resolved;
    if (!resolved || typeof resolved !== "object") return {} as JsonRecord;
    const values = (resolved as JsonRecord).values;
    return values && typeof values === "object"
      ? (values as JsonRecord)
      : ({} as JsonRecord);
  };
  const stayValues = valuesOf(staySetting);
  const paymentValues = valuesOf(paymentSetting);
  const extraBedValues = valuesOf(extraBedSetting);
  const activeCheckIn = String(stayValues.checkInTime ?? "14:00");
  const activeCheckout = String(stayValues.checkoutTime ?? "12:00");
  const activeOnlineDeadline = String(
    paymentValues.onlineDeadlineMinutes ?? "60",
  );
  const activeSameDayDeadline = String(
    paymentValues.sameDayDeadlineMinutes ?? "60",
  );
  const activeExtraBedRate =
    extraBedValues.nightlyRateIdr === undefined
      ? ""
      : String(extraBedValues.nightlyRateIdr);
  const activeSettingCount = settings.filter(
    (setting) => setting.resolved && typeof setting.resolved === "object",
  ).length;
  const versionCount = settings.reduce(
    (total, setting) =>
      total + (Array.isArray(setting.versions) ? setting.versions.length : 0),
    0,
  );
  const [checkInTime, setCheckInTime] = useState(activeCheckIn);
  const [checkoutTime, setCheckoutTime] = useState(activeCheckout);
  const [onlineDeadline, setOnlineDeadline] = useState(activeOnlineDeadline);
  const [sameDayDeadline, setSameDayDeadline] = useState(activeSameDayDeadline);
  const [extraBedRate, setExtraBedRate] = useState(activeExtraBedRate);
  const [settingReason, setSettingReason] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        reason.trim() || "Profil properti diperbarui oleh Owner";
      await post("/api/staff/admin/configuration", {
        action: "UPDATE_PROPERTY_PROFILE",
        name,
        address: address || null,
        timezone,
        defaultLocale: locale,
        reason: auditReason,
      });
      setNotice({
        tone: "success",
        message: "Profil properti diperbarui dan tercatat di audit.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Pembaruan gagal.",
      });
    }
  }
  async function saveOperationalSettings(event: React.FormEvent) {
    event.preventDefault();
    const auditReason =
      settingReason.trim() || "Pengaturan operasional diperbarui oleh Owner";
    const definitions = [
      {
        code: "STAY_TIMING",
        name: "Jam check-in dan checkout",
        values: {
          checkInTime,
          checkoutTime,
          arrivalHandling: "FLEXIBLE_FRONT_OFFICE",
          enforceEarlyCheckInCutoff: false,
          enforceLateArrivalCutoff: false,
          automaticNoShowFromTime: false,
        },
      },
      {
        code: "BOOKING_PAYMENT",
        name: "Batas pembayaran booking online",
        values: {
          onlineDeadlineMinutes: Number(onlineDeadline),
          sameDayDeadlineMinutes: Number(sameDayDeadline),
          onlinePaymentPercentage: 100,
        },
      },
      ...(extraBedRate
        ? [
            {
              code: "EXTRA_BED_PRICING",
              name: "Harga extra bed",
              values: {
                nightlyRateIdr: Number(extraBedRate),
                noTax: true,
                taxRate: 0,
                serviceChargeRate: 0,
                taxInclusive: false,
                serviceChargeInclusive: false,
              },
            },
          ]
        : []),
    ];
    try {
      for (const definition of definitions) {
        const draft = await post("/api/staff/admin/configuration", {
          action: "CREATE_SETTING_DRAFT",
          input: {
            ...definition,
            effectiveFrom: new Date().toISOString(),
            effectiveTo: null,
            reason: auditReason,
            requiresApproval: false,
          },
        });
        await post("/api/staff/admin/configuration", {
          action: "PUBLISH_SETTING",
          versionId: String(draft.id),
          reason: auditReason,
        });
      }
      setSettingReason("");
      setNotice({
        tone: "success",
        message: "Konfigurasi operasional disimpan dan langsung diaktifkan.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Konfigurasi operasional gagal disimpan.",
      });
    }
  }
  return (
    <div className={styles.actionGrid}>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Profil properti</h2>
        </div>
        <form className={styles.staffForm} onSubmit={save}>
          <label>
            Nama properti
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Alamat
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <div className={styles.formGrid}>
            <label>
              Zona waktu
              <KookaSelect
                ariaLabel="Zona waktu properti"
                value={timezone}
                onChange={setTimezone}
                options={[
                  { value: "Asia/Jakarta", label: "WIB (Asia/Jakarta)" },
                ]}
              />
            </label>
            <label>
              Bahasa utama
              <KookaSelect
                ariaLabel="Bahasa utama properti"
                value={locale}
                onChange={setLocale}
                options={[
                  { value: "id", label: "Indonesia" },
                  { value: "en", label: "English" },
                ]}
              />
            </label>
          </div>
          <label>
            Catatan perubahan (opsional)
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton}>Simpan profil</button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Jam & aturan operasional</h2>
        </div>
        <form className={styles.staffForm} onSubmit={saveOperationalSettings}>
          <p className={styles.formHint}>
            Jam di bawah adalah jadwal standar untuk informasi tamu dan
            perencanaan operasional, bukan batas kedatangan. Early check-in dan
            kedatangan terlambat diputuskan Front Office langsung di lokasi
            tanpa cutoff otomatis, selama kamar siap dan masa menginap masih
            berlaku.
          </p>
          <div className={styles.formGrid}>
            <label>
              Jadwal check-in standar
              <input
                onChange={(event) => setCheckInTime(event.target.value)}
                required
                type="time"
                value={checkInTime}
              />
            </label>
            <label>
              Jadwal checkout standar
              <input
                onChange={(event) => setCheckoutTime(event.target.value)}
                required
                type="time"
                value={checkoutTime}
              />
            </label>
            <label>
              Batas bayar online (menit)
              <input
                max="1440"
                min="15"
                onChange={(event) => setOnlineDeadline(event.target.value)}
                required
                type="number"
                value={onlineDeadline}
              />
            </label>
            <label>
              Batas bayar same-day (menit)
              <input
                max="1440"
                min="15"
                onChange={(event) => setSameDayDeadline(event.target.value)}
                required
                type="number"
                value={sameDayDeadline}
              />
            </label>
          </div>
          <label>
            Harga extra bed / malam (opsional sampai harga resmi tersedia)
            <MoneyInput
              ariaLabel="Harga extra bed per malam"
              onChange={setExtraBedRate}
              value={extraBedRate}
            />
          </label>
          <label>
            Catatan perubahan (opsional)
            <textarea
              onChange={(event) => setSettingReason(event.target.value)}
              value={settingReason}
            />
          </label>
          <button className={styles.primaryButton}>
            Simpan &amp; aktifkan konfigurasi
          </button>
        </form>
      </section>
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Pengaturan aktif</h2>
            <p className={styles.panelSubtitle}>
              Ringkasan nilai yang sedang digunakan oleh sistem.
            </p>
          </div>
          <span className={styles.countPill}>{activeSettingCount} aktif</span>
        </div>
        <div className={styles.settingsSummaryGrid}>
          <article className={styles.settingSummaryCard}>
            <span>Waktu menginap</span>
            <strong>
              {`${activeCheckIn.replace(":", ".")} — ${activeCheckout.replace(":", ".")}`}
            </strong>
            <small>
              {`Check-in dan checkout standar${!staySetting?.resolved ? " · belum disimpan" : ""}`}
            </small>
          </article>
          <article className={styles.settingSummaryCard}>
            <span>Pembayaran online</span>
            <strong>{activeOnlineDeadline} menit</strong>
            <small>
              {`Same-day ${activeSameDayDeadline} menit${!paymentSetting?.resolved ? " · belum disimpan" : ""}`}
            </small>
          </article>
          <article className={styles.settingSummaryCard}>
            <span>Extra bed / malam</span>
            <strong>
              {activeExtraBedRate ? idr(activeExtraBedRate) : "Belum diatur"}
            </strong>
            <small>
              {extraBedSetting?.resolved
                ? "Harga aktif saat ini"
                : "Isi harga pada formulir jika sudah tersedia"}
            </small>
          </article>
        </div>
        {settings.length > 0 ? (
          <details className={styles.settingsHistory}>
            <summary>Riwayat perubahan ({versionCount})</summary>
            <div className={styles.masterList}>
              {settings.map((setting) => {
                const resolved =
                  setting.resolved && typeof setting.resolved === "object"
                    ? (setting.resolved as JsonRecord)
                    : null;
                return (
                  <article key={String(setting.id)}>
                    <div>
                      <strong>{String(setting.name)}</strong>
                      <small>
                        {Array.isArray(setting.versions)
                          ? `${setting.versions.length} perubahan tersimpan`
                          : "Belum ada perubahan"}
                      </small>
                    </div>
                    <span className={styles.statusPill}>
                      {resolved
                        ? `versi ${String(resolved.versionNumber)}`
                        : "belum aktif"}
                    </span>
                  </article>
                );
              })}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}

type AdminProps = {
  data: JsonRecord;
  load: () => Promise<void>;
  setNotice: (notice: Notice) => void;
};

function RoomAdmin({ data, load, setNotice }: AdminProps) {
  const roomTypes = Array.isArray(data.roomTypes)
    ? (data.roomTypes as JsonRecord[])
    : [];
  const roomUnits = Array.isArray(data.roomUnits)
    ? (data.roomUnits as JsonRecord[])
    : [];
  const amenities = Array.isArray(data.amenities)
    ? (data.amenities as JsonRecord[])
    : [];
  const resourcePools = Array.isArray(data.resourcePools)
    ? (data.resourcePools as JsonRecord[])
    : [];
  const [roomNumber, setRoomNumber] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [sortOrder, setSortOrder] = useState("1");
  const [floor, setFloor] = useState("");
  const [unitReason, setUnitReason] = useState("");
  const [amenityCode, setAmenityCode] = useState("");
  const [amenityNameId, setAmenityNameId] = useState("");
  const [amenityNameEn, setAmenityNameEn] = useState("");
  const [amenityReason, setAmenityReason] = useState("");
  const [editingRoomTypeId, setEditingRoomTypeId] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [typeNameId, setTypeNameId] = useState("");
  const [typeNameEn, setTypeNameEn] = useState("");
  const [typeDescriptionId, setTypeDescriptionId] = useState("");
  const [typeDescriptionEn, setTypeDescriptionEn] = useState("");
  const [bedConfiguration, setBedConfiguration] = useState("");
  const [standardAdults, setStandardAdults] = useState("2");
  const [maximumAdults, setMaximumAdults] = useState("2");
  const [maximumChildren, setMaximumChildren] = useState("0");
  const [maximumTotalGuests, setMaximumTotalGuests] = useState("2");
  const [extraBedAllowed, setExtraBedAllowed] = useState(false);
  const [maximumExtraBeds, setMaximumExtraBeds] = useState("0");
  const [extraBedCapacityIncrement, setExtraBedCapacityIncrement] =
    useState("0");
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [typeReason, setTypeReason] = useState("");
  const [archiveTypeId, setArchiveTypeId] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [changeUnitId, setChangeUnitId] = useState("");
  const [changeUnitTypeId, setChangeUnitTypeId] = useState("");
  const [changeUnitReason, setChangeUnitReason] = useState("");
  const [resourceCode, setResourceCode] = useState("");
  const [resourceNameId, setResourceNameId] = useState("");
  const [resourceNameEn, setResourceNameEn] = useState("");
  const [resourceCapacity, setResourceCapacity] = useState("0");
  const [resourceTracked, setResourceTracked] = useState(true);
  const [resourceReason, setResourceReason] = useState("");
  async function createUnit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        unitReason.trim() || `Kamar ${roomNumber} ditambahkan oleh Owner`;
      await post("/api/staff/admin/room-master", {
        action: "CREATE_ROOM_UNIT",
        roomNumber,
        sortOrder: Number(sortOrder),
        floorOrArea: floor || null,
        roomTypeId,
        effectiveFrom: new Date().toISOString(),
        reason: auditReason,
      });
      setNotice({
        tone: "success",
        message: `Kamar ${roomNumber} berhasil dibuat.`,
      });
      setRoomNumber("");
      setRoomTypeId("");
      setFloor("");
      setUnitReason("");
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Kamar gagal dibuat.",
      });
    }
  }
  async function changeUnitType(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        changeUnitReason.trim() || "Jenis kamar fisik diperbarui oleh Owner";
      await post("/api/staff/admin/room-master", {
        action: "CHANGE_ROOM_UNIT_TYPE",
        roomUnitId: changeUnitId,
        roomTypeId: changeUnitTypeId,
        effectiveFrom: new Date().toISOString(),
        reason: auditReason,
      });
      setChangeUnitId("");
      setChangeUnitTypeId("");
      setChangeUnitReason("");
      setNotice({ tone: "success", message: "Jenis unit kamar diperbarui." });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Jenis unit gagal diubah.",
      });
    }
  }
  async function createResource(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        resourceReason.trim() || "Persediaan tambahan dibuat oleh Owner";
      await post("/api/staff/admin/room-master", {
        action: "CREATE_RESOURCE_POOL",
        code:
          resourceCode.trim() ||
          internalCode(resourceNameEn || resourceNameId, 64),
        nameId: resourceNameId,
        nameEn: resourceNameEn,
        physicalCapacity: Number(resourceCapacity),
        inventoryTracked: resourceTracked,
        reason: auditReason,
      });
      setResourceCode("");
      setResourceNameId("");
      setResourceNameEn("");
      setResourceCapacity("0");
      setResourceReason("");
      setNotice({
        tone: "success",
        message: "Resource inventory ditambahkan.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Resource gagal dibuat.",
      });
    }
  }
  async function createAmenity(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        amenityReason.trim() || "Fasilitas kamar dibuat oleh Owner";
      await post("/api/staff/admin/room-master", {
        action: "CREATE_AMENITY",
        code:
          amenityCode.trim() || internalCode(amenityNameEn || amenityNameId),
        nameId: amenityNameId,
        nameEn: amenityNameEn,
        reason: auditReason,
      });
      setAmenityCode("");
      setAmenityNameId("");
      setAmenityNameEn("");
      setAmenityReason("");
      setNotice({ tone: "success", message: "Amenity baru berhasil dibuat." });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Amenity gagal dibuat.",
      });
    }
  }
  const activeTypes = roomTypes.filter(
    (item, index, list) =>
      item.lifecycleStatus === "ACTIVE" &&
      list.findIndex((other) => other.roomTypeId === item.roomTypeId) === index,
  );
  const latestTypes = roomTypes.filter(
    (item, index, list) =>
      list.findIndex((other) => other.roomTypeId === item.roomTypeId) === index,
  );
  const amenityMasters = amenities.filter(
    (item, index, list) =>
      list.findIndex((other) => other.id === item.id) === index,
  );

  async function applyStandardAmenities() {
    try {
      const defaultAmenityIds: string[] = [];
      let createdCount = 0;
      for (const preset of standardRoomAmenities) {
        const existing = amenityMasters.find(
          (amenity) => String(amenity.code) === preset.code,
        );
        if (existing) {
          if (preset.selectedByDefault) {
            defaultAmenityIds.push(String(existing.id));
          }
          continue;
        }
        const created = await post("/api/staff/admin/room-master", {
          action: "CREATE_AMENITY",
          code: preset.code,
          iconKey: preset.iconKey,
          nameId: preset.nameId,
          nameEn: preset.nameEn,
          reason: "Menyiapkan fasilitas standar kamar",
        });
        createdCount += 1;
        if (preset.selectedByDefault) {
          defaultAmenityIds.push(String(created.id));
        }
      }
      setSelectedAmenityIds((current) => [
        ...new Set([...current, ...defaultAmenityIds]),
      ]);
      setNotice({
        tone: "success",
        message: `${createdCount ? `${createdCount} pilihan fasilitas baru berhasil ditambahkan. ` : ""}Enam fasilitas umum sudah dipilih. Centang fasilitas tambahan yang sesuai, lalu simpan jenis kamar.`,
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Fasilitas standar gagal disiapkan.",
      });
    }
  }

  function resetRoomTypeForm() {
    setEditingRoomTypeId("");
    setTypeCode("");
    setTypeNameId("");
    setTypeNameEn("");
    setTypeDescriptionId("");
    setTypeDescriptionEn("");
    setBedConfiguration("");
    setStandardAdults("2");
    setMaximumAdults("2");
    setMaximumChildren("0");
    setMaximumTotalGuests("2");
    setExtraBedAllowed(false);
    setMaximumExtraBeds("0");
    setExtraBedCapacityIncrement("0");
    setSelectedAmenityIds([]);
    setTypeReason("");
  }

  function editRoomType(item: JsonRecord) {
    setEditingRoomTypeId(String(item.roomTypeId));
    setTypeCode(String(item.code ?? ""));
    setTypeNameId(String(item.nameId ?? ""));
    setTypeNameEn(String(item.nameEn ?? ""));
    setTypeDescriptionId(String(item.descriptionId ?? ""));
    setTypeDescriptionEn(String(item.descriptionEn ?? ""));
    setBedConfiguration(String(item.bedConfiguration ?? ""));
    setStandardAdults(String(item.standardAdults ?? 2));
    setMaximumAdults(String(item.maximumAdults ?? 2));
    setMaximumChildren(String(item.maximumChildren ?? 0));
    setMaximumTotalGuests(String(item.maximumTotalGuests ?? 2));
    setExtraBedAllowed(Boolean(item.extraBedAllowed));
    setMaximumExtraBeds(String(item.maximumExtraBeds ?? 0));
    setExtraBedCapacityIncrement(String(item.extraBedCapacityIncrement ?? 0));
    setSelectedAmenityIds(
      Array.isArray(item.amenityIds)
        ? item.amenityIds.map((value) => String(value))
        : [],
    );
    setTypeReason("");
  }

  async function saveRoomType(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        typeReason.trim() ||
        `${editingRoomTypeId ? "Jenis kamar diperbarui" : "Jenis kamar ditambahkan"} oleh Owner`;
      const resolvedTypeCode =
        typeCode.trim() || internalCode(typeNameEn || typeNameId, 40);
      const draft = await post("/api/staff/admin/room-master", {
        action: "CREATE_ROOM_TYPE_DRAFT",
        input: {
          roomTypeId: editingRoomTypeId || undefined,
          code: resolvedTypeCode,
          nameId: typeNameId,
          nameEn: typeNameEn,
          descriptionId: typeDescriptionId || null,
          descriptionEn: typeDescriptionEn || null,
          bedConfiguration: bedConfiguration || null,
          standardAdults: Number(standardAdults),
          maximumAdults: Number(maximumAdults),
          maximumChildren: Number(maximumChildren),
          maximumTotalGuests: Number(maximumTotalGuests),
          extraBedAllowed,
          maximumExtraBeds: extraBedAllowed ? Number(maximumExtraBeds) : 0,
          extraBedCapacityIncrement: extraBedAllowed
            ? Number(extraBedCapacityIncrement)
            : 0,
          amenityIds: selectedAmenityIds,
          effectiveFrom: new Date().toISOString(),
          effectiveTo: null,
          reason: auditReason,
        },
      });
      await post("/api/staff/admin/room-master", {
        action: "PUBLISH_ROOM_TYPE",
        versionId: String(draft.id),
        reason: auditReason,
      });
      setNotice({
        tone: "success",
        message: editingRoomTypeId
          ? `Jenis kamar ${typeNameId} berhasil diperbarui dan diaktifkan.`
          : `Jenis kamar ${typeNameId} berhasil ditambahkan dan diaktifkan.`,
      });
      resetRoomTypeForm();
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Jenis kamar gagal disimpan.",
      });
    }
  }

  async function archiveRoomType() {
    try {
      await post("/api/staff/admin/room-master", {
        action: "ARCHIVE_MASTER",
        target: "ROOM_TYPE",
        targetId: archiveTypeId,
        reason: archiveReason,
      });
      setArchiveTypeId("");
      setArchiveReason("");
      setNotice({ tone: "success", message: "Jenis kamar diarsipkan." });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Jenis kamar gagal diarsipkan.",
      });
    }
  }
  return (
    <div className={styles.actionGrid}>
      <section
        className={`${styles.formCard} ${styles.actionGridWide} ${styles.setupOrderOne}`}
      >
        <div className={styles.panelHeader}>
          <div>
            <h2>
              {editingRoomTypeId ? "Edit jenis kamar" : "Tambah jenis kamar"}
            </h2>
            <p className={styles.formHint}>
              Jenis kamar adalah kategori yang dipilih tamu saat booking. Nomor
              kamar fisik ditambahkan terpisah di bawahnya.
            </p>
          </div>
          {editingRoomTypeId ? (
            <button
              className={styles.textButton}
              onClick={resetRoomTypeForm}
              type="button"
            >
              Batalkan edit
            </button>
          ) : null}
        </div>
        <form className={styles.staffForm} onSubmit={saveRoomType}>
          <div className={styles.formGrid}>
            <label>
              Konfigurasi tempat tidur
              <input
                maxLength={160}
                placeholder="Contoh: 1 queen bed"
                value={bedConfiguration}
                onChange={(event) => setBedConfiguration(event.target.value)}
              />
            </label>
            <label>
              Nama Indonesia
              <input
                required
                value={typeNameId}
                onChange={(event) => setTypeNameId(event.target.value)}
              />
            </label>
            <label>
              Nama English
              <input
                required
                value={typeNameEn}
                onChange={(event) => setTypeNameEn(event.target.value)}
              />
            </label>
            <label>
              Deskripsi Indonesia
              <textarea
                value={typeDescriptionId}
                onChange={(event) => setTypeDescriptionId(event.target.value)}
              />
            </label>
            <label>
              Deskripsi English
              <textarea
                value={typeDescriptionEn}
                onChange={(event) => setTypeDescriptionEn(event.target.value)}
              />
            </label>
          </div>
          {!editingRoomTypeId ? (
            <p className={styles.formHint}>
              Kode internal jenis kamar dibuat otomatis oleh sistem.
            </p>
          ) : null}
          <div className={styles.formGrid}>
            <label>
              Kapasitas standar dewasa
              <input
                min="0"
                required
                type="number"
                value={standardAdults}
                onChange={(event) => setStandardAdults(event.target.value)}
              />
            </label>
            <label>
              Maksimum dewasa
              <input
                min={standardAdults || "0"}
                required
                type="number"
                value={maximumAdults}
                onChange={(event) => setMaximumAdults(event.target.value)}
              />
            </label>
            <label>
              Maksimum anak
              <input
                min="0"
                required
                type="number"
                value={maximumChildren}
                onChange={(event) => setMaximumChildren(event.target.value)}
              />
            </label>
            <label>
              Maksimum total tamu
              <input
                min="1"
                required
                type="number"
                value={maximumTotalGuests}
                onChange={(event) => setMaximumTotalGuests(event.target.value)}
              />
            </label>
          </div>
          <label className={styles.checkboxLabel}>
            <input
              checked={extraBedAllowed}
              onChange={(event) => {
                setExtraBedAllowed(event.target.checked);
                if (!event.target.checked) {
                  setMaximumExtraBeds("0");
                  setExtraBedCapacityIncrement("0");
                }
              }}
              type="checkbox"
            />
            Jenis kamar ini dapat menggunakan extra bed
          </label>
          {extraBedAllowed ? (
            <div className={styles.formGrid}>
              <label>
                Maksimum extra bed
                <input
                  min="1"
                  required
                  type="number"
                  value={maximumExtraBeds}
                  onChange={(event) => setMaximumExtraBeds(event.target.value)}
                />
              </label>
              <label>
                Tambahan kapasitas per extra bed
                <input
                  min="1"
                  required
                  type="number"
                  value={extraBedCapacityIncrement}
                  onChange={(event) =>
                    setExtraBedCapacityIncrement(event.target.value)
                  }
                />
              </label>
            </div>
          ) : null}
          <fieldset className={styles.fieldGroup}>
            <legend>Fasilitas kamar</legend>
            <div className={styles.amenityQuickSetup}>
              <div>
                <strong>15 pilihan fasilitas kamar</strong>
                <small>
                  Enam fasilitas umum akan dicentang otomatis. Fasilitas khusus
                  seperti mezzanine dan shared bathroom dipilih sesuai jenis
                  kamar.
                </small>
              </div>
              <button
                className={styles.secondaryButton}
                onClick={() => void applyStandardAmenities()}
                type="button"
              >
                Siapkan 15 pilihan fasilitas
              </button>
            </div>
            {amenityMasters.length ? (
              <div className={styles.formGrid}>
                {amenityMasters.map((amenity) => {
                  const amenityId = String(amenity.id);
                  return (
                    <label className={styles.checkboxLabel} key={amenityId}>
                      <input
                        checked={selectedAmenityIds.includes(amenityId)}
                        onChange={(event) =>
                          setSelectedAmenityIds((current) =>
                            event.target.checked
                              ? [...current, amenityId]
                              : current.filter((id) => id !== amenityId),
                          )
                        }
                        type="checkbox"
                      />
                      {String(amenity.name ?? amenity.code)}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className={styles.formHint}>
                Klik tombol fasilitas standar atau tambahkan fasilitas khusus
                melalui formulir di bawah.
              </p>
            )}
          </fieldset>
          <label>
            Catatan perubahan (opsional)
            <textarea
              value={typeReason}
              onChange={(event) => setTypeReason(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton}>
            {editingRoomTypeId
              ? "Simpan & aktifkan perubahan"
              : "Tambah & aktifkan jenis kamar"}
          </button>
        </form>
      </section>
      <section
        className={`${styles.panel} ${styles.menuCatalogPanel} ${styles.setupOrderTwo}`}
      >
        <div className={styles.panelHeader}>
          <h2>Daftar jenis kamar</h2>
          <span className={styles.countPill}>
            {latestTypes.length} jenis kamar
          </span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.workTable}>
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Kapasitas</th>
                <th>Extra bed</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {latestTypes.map((item) => (
                <tr key={String(item.roomTypeId)}>
                  <td>
                    <strong>{String(item.nameId ?? item.code)}</strong>
                  </td>
                  <td>
                    {String(item.standardAdults ?? 0)} standar · maks.{" "}
                    {String(item.maximumTotalGuests ?? 0)} tamu
                  </td>
                  <td>
                    {item.extraBedAllowed
                      ? `Maks. ${String(item.maximumExtraBeds ?? 0)}`
                      : "Tidak tersedia"}
                  </td>
                  <td>
                    <span className={styles.statusPill}>
                      {human(String(item.lifecycleStatus ?? item.status))}
                    </span>
                  </td>
                  <td>
                    <div className={styles.inlineActions}>
                      <button
                        className={styles.textButton}
                        onClick={() => editRoomType(item)}
                        type="button"
                      >
                        Edit
                      </button>
                      {item.status !== "ARCHIVED" ? (
                        <button
                          className={styles.textButton}
                          onClick={() =>
                            setArchiveTypeId(String(item.roomTypeId))
                          }
                          type="button"
                        >
                          Arsipkan
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {latestTypes.length === 0 ? (
                <tr>
                  <td colSpan={5}>Belum ada jenis kamar.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className={`${styles.formCard} ${styles.setupOrderThree}`}>
        <div className={styles.panelHeader}>
          <h2>Tambah nomor kamar</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createUnit}>
          <div className={styles.formGrid}>
            <label>
              Nomor kamar
              <input
                required
                value={roomNumber}
                onChange={(event) => setRoomNumber(event.target.value)}
              />
            </label>
            <label>
              Urutan
              <input
                required
                min="1"
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </label>
            <label>
              Tipe kamar
              <KookaSelect
                ariaLabel="Tipe kamar"
                value={roomTypeId}
                onChange={setRoomTypeId}
                options={activeTypes.map((item) => ({
                  value: String(item.roomTypeId),
                  label: String(item.nameId ?? item.code),
                }))}
                placeholder="Pilih tipe"
              />
            </label>
            <label>
              Lantai / area
              <input
                value={floor}
                onChange={(event) => setFloor(event.target.value)}
              />
            </label>
          </div>
          <label>
            Catatan (opsional)
            <textarea
              value={unitReason}
              onChange={(event) => setUnitReason(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton}>Tambah kamar</button>
        </form>
      </section>
      <section className={`${styles.formCard} ${styles.setupAdvancedCard}`}>
        <div className={styles.panelHeader}>
          <h2>Ubah jenis kamar fisik</h2>
          <span className={styles.countPill}>Opsional</span>
        </div>
        <form className={styles.staffForm} onSubmit={changeUnitType}>
          <label>
            Nomor kamar
            <KookaSelect
              ariaLabel="Unit kamar yang diubah"
              value={changeUnitId}
              onChange={setChangeUnitId}
              options={roomUnits.map((room) => ({
                value: String(room.id),
                label: `Kamar ${String(room.roomNumber)}`,
                description: String(room.roomTypeName ?? "Belum bertipe"),
              }))}
              placeholder="Pilih kamar"
            />
          </label>
          <label>
            Jenis kamar baru
            <KookaSelect
              ariaLabel="Jenis kamar baru"
              value={changeUnitTypeId}
              onChange={setChangeUnitTypeId}
              options={activeTypes.map((item) => ({
                value: String(item.roomTypeId),
                label: String(item.nameId ?? item.code),
              }))}
              placeholder="Pilih jenis kamar"
            />
          </label>
          <label>
            Catatan (opsional)
            <textarea
              onChange={(event) => setChangeUnitReason(event.target.value)}
              value={changeUnitReason}
            />
          </label>
          <button className={styles.primaryButton}>Ubah jenis unit</button>
        </form>
      </section>
      <section className={`${styles.formCard} ${styles.setupAdvancedCard}`}>
        <div className={styles.panelHeader}>
          <h2>Persediaan tambahan</h2>
          <span className={styles.countPill}>Opsional</span>
        </div>
        <form className={styles.staffForm} onSubmit={createResource}>
          <div className={styles.formGrid}>
            <label>
              Kapasitas fisik
              <input
                min="0"
                onChange={(event) => setResourceCapacity(event.target.value)}
                required
                type="number"
                value={resourceCapacity}
              />
            </label>
            <label>
              Nama Indonesia
              <input
                onChange={(event) => setResourceNameId(event.target.value)}
                required
                value={resourceNameId}
              />
            </label>
            <label>
              Nama English
              <input
                onChange={(event) => setResourceNameEn(event.target.value)}
                required
                value={resourceNameEn}
              />
            </label>
          </div>
          <p className={styles.formHint}>
            Kode internal persediaan dibuat otomatis oleh sistem.
          </p>
          <label className={styles.checkboxLabel}>
            <input
              checked={resourceTracked}
              onChange={(event) => setResourceTracked(event.target.checked)}
              type="checkbox"
            />
            Pantau jumlah persediaan ini
          </label>
          <label>
            Catatan (opsional)
            <textarea
              onChange={(event) => setResourceReason(event.target.value)}
              value={resourceReason}
            />
          </label>
          <button className={styles.primaryButton}>Tambah persediaan</button>
        </form>
      </section>
      <section className={`${styles.formCard} ${styles.setupAdvancedCard}`}>
        <div className={styles.panelHeader}>
          <h2>Tambah fasilitas kamar</h2>
          <span className={styles.countPill}>Opsional</span>
        </div>
        <form className={styles.staffForm} onSubmit={createAmenity}>
          <div className={styles.formGrid}>
            <label>
              Nama Indonesia
              <input
                required
                value={amenityNameId}
                onChange={(event) => setAmenityNameId(event.target.value)}
              />
            </label>
            <label>
              Nama English
              <input
                required
                value={amenityNameEn}
                onChange={(event) => setAmenityNameEn(event.target.value)}
              />
            </label>
          </div>
          <p className={styles.formHint}>
            Kode internal fasilitas dibuat otomatis oleh sistem.
          </p>
          <label>
            Catatan (opsional)
            <textarea
              value={amenityReason}
              onChange={(event) => setAmenityReason(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton}>Tambah fasilitas</button>
        </form>
      </section>
      <section
        className={`${styles.panel} ${styles.menuCatalogPanel} ${styles.setupOrderFour}`}
      >
        <div className={styles.panelHeader}>
          <h2>Daftar kamar fisik</h2>
          <span className={styles.countPill}>
            {roomUnits.length} unit · {amenityMasters.length} amenity ·{" "}
            {resourcePools.length} resource
          </span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.workTable}>
            <thead>
              <tr>
                <th>Nomor</th>
                <th>Area</th>
                <th>Jenis kamar</th>
                <th>Occupancy</th>
                <th>Housekeeping</th>
                <th>Serviceability</th>
              </tr>
            </thead>
            <tbody>
              {roomUnits.map((room) => (
                <tr key={String(room.id)}>
                  <td>
                    <strong>Kamar {String(room.roomNumber)}</strong>
                  </td>
                  <td>{String(room.floorOrArea ?? "—")}</td>
                  <td>{String(room.roomTypeName ?? "—")}</td>
                  <td>{human(String(room.occupancyStatus ?? "unknown"))}</td>
                  <td>{human(String(room.housekeepingStatus ?? "unknown"))}</td>
                  <td>
                    <span className={styles.statusPill}>
                      {human(String(room.serviceabilityStatus ?? room.status))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ReasonDialog
        confirmLabel="Arsipkan jenis kamar"
        description="Jenis kamar tidak akan tersedia untuk booking baru. Sistem akan menolak arsip bila masih ada unit atau komitmen yang belum aman."
        onCancel={() => {
          setArchiveTypeId("");
          setArchiveReason("");
        }}
        onChange={setArchiveReason}
        onConfirm={() => void archiveRoomType()}
        open={Boolean(archiveTypeId)}
        title="Arsipkan jenis kamar?"
        value={archiveReason}
      />
    </div>
  );
}

function CommercialAdmin({
  data,
  propertyData,
  roomData,
  load,
  setNotice,
}: AdminProps & { propertyData: JsonRecord; roomData: JsonRecord }) {
  const property = recordOf(propertyData.property);
  const taxes = Array.isArray(data.taxes) ? (data.taxes as JsonRecord[]) : [];
  const rates = Array.isArray(data.ratePlans)
    ? (data.ratePlans as JsonRecord[])
    : [];
  const exchange = Array.isArray(data.exchangeRates)
    ? (data.exchangeRates as JsonRecord[])
    : [];
  const policies = Array.isArray(data.policies)
    ? (data.policies as JsonRecord[])
    : [];
  const instructions = Array.isArray(data.paymentInstructions)
    ? (data.paymentInstructions as JsonRecord[])
    : [];
  const documents = Array.isArray(data.documents)
    ? (data.documents as JsonRecord[])
    : [];
  const rateRules = Array.isArray(data.rateRules)
    ? (data.rateRules as JsonRecord[])
    : [];
  const latestTaxes = latestBy(taxes, "profileId");
  const latestRates = latestBy(rates, "ratePlanId");
  const latestPolicies = latestBy(policies, "policySetId");
  const latestInstructions = latestBy(instructions, "instructionSetId");
  const latestExchange = latestBy(exchange, "quoteCurrency");
  const activeTaxes = latestTaxes.filter(activeVersion);
  const activeRates = latestRates.filter(activeVersion);
  const activePolicies = latestPolicies.filter(activeVersion);
  const activeInstructions = latestInstructions.filter(activeVersion);
  const activeDocuments = documents.filter(effectiveVersion);
  const activeDocument = activeDocuments[0];
  const roomTypes = Array.isArray(roomData.roomTypes)
    ? (roomData.roomTypes as JsonRecord[]).filter(
        (item, index, list) =>
          item.lifecycleStatus === "ACTIVE" &&
          list.findIndex((other) => other.roomTypeId === item.roomTypeId) ===
            index,
      )
    : [];
  const activeRateVersionIds = new Set(
    activeRates.map((rate) => String(rate.versionId)),
  );
  const pricedRoomTypeIds = new Set(
    rateRules
      .filter((rule) =>
        activeRateVersionIds.has(String(rule.ratePlanVersionId)),
      )
      .map((rule) => String(rule.roomTypeId)),
  );
  const missingPriceRoomTypes = roomTypes.filter(
    (roomType) => !pricedRoomTypeIds.has(String(roomType.roomTypeId)),
  );
  const lodgingTaxes = activeTaxes.filter((item) => item.domain === "LODGING");
  const initialLodgingTaxProfileId =
    lodgingTaxes.length === 1 ? String(lodgingTaxes[0]?.profileId ?? "") : "";
  const roomRatesWithoutTaxDecision = activeRates.filter((rate) => {
    const linkedTax = lodgingTaxes.find(
      (tax) => String(tax.profileId) === String(rate.taxProfileId ?? ""),
    );
    return !linkedTax;
  });
  const explicitlyUntaxedRoomRates = activeRates.filter((rate) =>
    lodgingTaxes.some(
      (tax) =>
        String(tax.profileId) === String(rate.taxProfileId ?? "") &&
        Boolean(tax.noTax),
    ),
  );
  const [domain, setDomain] = useState("LODGING");
  const [taxRate, setTaxRate] = useState("0");
  const [serviceRate, setServiceRate] = useState("0");
  const [noTax, setNoTax] = useState(true);
  const [taxPriceMode, setTaxPriceMode] = useState("EXCLUSIVE");
  const [applyTaxToActiveRates, setApplyTaxToActiveRates] = useState(true);
  const [reason, setReason] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [displayRate, setDisplayRate] = useState("");
  const [planNameId, setPlanNameId] = useState("Harga Standar");
  const [planNameEn, setPlanNameEn] = useState("Standard Rate");
  const [planRoomTypeId, setPlanRoomTypeId] = useState("");
  const [nightlyRate, setNightlyRate] = useState("");
  const [minimumStay, setMinimumStay] = useState("1");
  const [selectedTaxProfileId, setSelectedTaxProfileId] = useState(
    initialLodgingTaxProfileId,
  );
  const [selectedCancellationPolicySetId, setSelectedCancellationPolicySetId] =
    useState("");
  const [showRateOptions, setShowRateOptions] = useState(false);
  const [rateStartsOn, setRateStartsOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [rateEndsOn, setRateEndsOn] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  });
  const [rateReason, setRateReason] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankReason, setBankReason] = useState("");
  const [policyTitleId, setPolicyTitleId] = useState("");
  const [policyTitleEn, setPolicyTitleEn] = useState("");
  const [policyContentId, setPolicyContentId] = useState("");
  const [policyContentEn, setPolicyContentEn] = useState("");
  const [policyReason, setPolicyReason] = useState("");
  const [documentLegalName, setDocumentLegalName] = useState(() =>
    String(activeDocument?.legalName ?? property.name ?? ""),
  );
  const [documentDisplayName, setDocumentDisplayName] = useState(() =>
    String(activeDocument?.displayName ?? property.name ?? ""),
  );
  const [documentAddress, setDocumentAddress] = useState(() =>
    String(activeDocument?.address ?? property.address ?? ""),
  );
  const [documentContact, setDocumentContact] = useState(() =>
    String(activeDocument?.contact ?? ""),
  );
  const [documentReason, setDocumentReason] = useState("");
  const [editingTaxProfileId, setEditingTaxProfileId] = useState("");
  const [editingRatePlanId, setEditingRatePlanId] = useState("");
  const [editingInstructionSetId, setEditingInstructionSetId] = useState("");
  const [editingPolicySetId, setEditingPolicySetId] = useState("");
  const [editingDocumentProfileId, setEditingDocumentProfileId] = useState(
    String(activeDocument?.profileId ?? ""),
  );
  const [retireTarget, setRetireTarget] = useState<{
    subject:
      | "TAX_PROFILE"
      | "RATE_PLAN"
      | "PAYMENT_INSTRUCTION"
      | "POLICY"
      | "DOCUMENT_PROFILE";
    versionId: string;
    label: string;
  } | null>(null);
  const [retireReason, setRetireReason] = useState("");
  function taxDescription(item: JsonRecord | undefined) {
    if (!item || item.noTax) return "Tanpa pajak";
    const mode =
      item.taxInclusive && item.serviceChargeInclusive
        ? "sudah termasuk harga"
        : "ditambahkan ke harga";
    return `Pajak ${percent(item.taxRate)} · layanan ${percent(item.serviceChargeRate)} · ${mode}`;
  }

  async function createTax(event: React.FormEvent) {
    event.preventDefault();
    try {
      const domainName =
        domain === "LODGING"
          ? "Kamar"
          : domain === "FNB"
            ? "F&B"
            : "Layanan / tour";
      const auditReason =
        reason.trim() || `Pengaturan pajak ${domainName} dibuat oleh Owner`;
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_TAX_DRAFT",
        profileId: editingTaxProfileId || undefined,
        code: internalCode(`TAX-${domain}`),
        name: noTax ? `Tanpa pajak — ${domainName}` : `Pajak — ${domainName}`,
        domain,
        taxRate: noTax ? "0" : String(Number(taxRate) / 100),
        serviceChargeRate: noTax ? "0" : String(Number(serviceRate) / 100),
        taxInclusive: !noTax && taxPriceMode === "INCLUSIVE",
        serviceChargeInclusive: !noTax && taxPriceMode === "INCLUSIVE",
        noTax,
        effectiveFrom: new Date().toISOString(),
        reason: auditReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "REVIEW_VERSION",
        subject: "TAX_PROFILE",
        versionId: String(draft.id),
        decision: "APPROVE",
        reason: auditReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "PUBLISH_VERSION",
        subject: "TAX_PROFILE",
        versionId: String(draft.id),
        reason: auditReason,
      });
      let updatedRatePlans = 0;
      if (domain === "LODGING" && applyTaxToActiveRates) {
        const applied = await post("/api/staff/admin/commercial-master", {
          action: "APPLY_TAX_TO_ACTIVE_ROOM_RATES",
          taxProfileVersionId: String(draft.id),
          reason: `${auditReason}; diterapkan ke harga kamar aktif`,
        });
        updatedRatePlans = Number(applied.updatedRatePlans ?? 0);
      }
      if (domain === "LODGING") {
        setSelectedTaxProfileId(String(draft.parentId ?? ""));
      }
      setTaxRate("0");
      setServiceRate("0");
      setTaxPriceMode("EXCLUSIVE");
      setReason("");
      setEditingTaxProfileId("");
      setNotice({
        tone: "success",
        message: `${
          editingTaxProfileId
            ? "Pengaturan pajak diperbarui dan versi barunya sudah aktif."
            : "Konfigurasi pajak dibuat, disetujui, dan diaktifkan."
        }${
          domain === "LODGING" && applyTaxToActiveRates
            ? ` ${updatedRatePlans} harga kamar diperbarui.`
            : ""
        }`,
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Draft pajak gagal dibuat.",
      });
    }
  }
  async function createRatePlan(event: React.FormEvent) {
    event.preventDefault();
    try {
      const selectedRoomType = roomTypes.find(
        (item) => String(item.roomTypeId) === planRoomTypeId,
      );
      const auditReason =
        rateReason.trim() ||
        `Harga kamar ${String(selectedRoomType?.nameId ?? "dipilih")} dibuat oleh Owner`;
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_RATE_PLAN_DRAFT",
        ratePlanId: editingRatePlanId || undefined,
        code: internalCode(
          `RATE-${String(selectedRoomType?.code ?? planNameId)}`,
        ),
        nameId: planNameId,
        nameEn: planNameEn,
        sourceEligibility: "ALL",
        taxProfileId: selectedTaxProfileId || null,
        paymentInstructionSetId: null,
        cancellationPolicySetId: selectedCancellationPolicySetId || null,
        effectiveFrom: editingRatePlanId
          ? new Date().toISOString()
          : new Date(`${rateStartsOn}T00:00:00+07:00`).toISOString(),
        effectiveTo: null,
        requiresApproval: false,
        reason: auditReason,
        rules: [
          {
            roomTypeId: planRoomTypeId,
            name: `Harga dasar ${planNameId}`,
            ruleType: "BASE",
            priority: 1,
            startsOn: rateStartsOn,
            endsOn: rateEndsOn,
            weekdaysMask: 127,
            nightlyRateIdr: Number(nightlyRate),
            minimumStay: Number(minimumStay),
            closedToArrival: false,
            closedToDeparture: false,
          },
        ],
      });
      await post("/api/staff/admin/commercial-master", {
        action: "PUBLISH_VERSION",
        subject: "RATE_PLAN",
        versionId: String(draft.id),
        reason: auditReason,
      });
      setPlanNameId("Harga Standar");
      setPlanNameEn("Standard Rate");
      setPlanRoomTypeId("");
      setSelectedCancellationPolicySetId("");
      setNightlyRate("");
      setRateReason("");
      setEditingRatePlanId("");
      setNotice({
        tone: "success",
        message: editingRatePlanId
          ? "Harga kamar diperbarui dan versi barunya sudah aktif."
          : "Harga kamar dibuat dan langsung aktif untuk tipe kamar terpilih.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Rate plan gagal dibuat.",
      });
    }
  }
  async function createRate(event: React.FormEvent) {
    event.preventDefault();
    try {
      const idrPerCurrency = Number(displayRate);
      if (!Number.isFinite(idrPerCurrency) || idrPerCurrency <= 0) {
        throw new Error(`Masukkan nilai 1 ${currency} dalam rupiah.`);
      }
      const now = new Date();
      const expires = new Date(now.getTime() + 86_400_000);
      await post("/api/staff/admin/commercial-master", {
        action: "CREATE_EXCHANGE_RATE",
        quoteCurrency: currency,
        rate: (1 / idrPerCurrency).toFixed(12),
        source: "Owner preference",
        asOfAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        reason: `Kurs tampilan ${currency} diperbarui oleh Owner`,
      });
      setDisplayRate("");
      setNotice({
        tone: "success",
        message: `Preferensi tampilan ${currency} diperbarui; transaksi tetap IDR.`,
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Kurs gagal dibuat.",
      });
    }
  }
  async function createPaymentInstruction(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        bankReason.trim() || "Rekening transfer dibuat oleh Owner";
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_PAYMENT_INSTRUCTION_DRAFT",
        instructionSetId: editingInstructionSetId || undefined,
        code: internalCode(`BANK-${bankName}`),
        name: `${bankName} — ${accountHolder}`,
        bankName,
        accountHolder,
        accountNumber,
        instructionId: `Transfer ke ${bankName} atas nama ${accountHolder}. Cantumkan kode booking pada bukti transfer.`,
        instructionEn: `Transfer to ${bankName} under ${accountHolder}. Include the booking code in the transfer receipt.`,
        effectiveFrom: new Date().toISOString(),
        reason: auditReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "REVIEW_VERSION",
        subject: "PAYMENT_INSTRUCTION",
        versionId: String(draft.id),
        decision: "APPROVE",
        reason: auditReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "PUBLISH_VERSION",
        subject: "PAYMENT_INSTRUCTION",
        versionId: String(draft.id),
        reason: auditReason,
      });
      setBankName("");
      setAccountHolder("");
      setAccountNumber("");
      setBankReason("");
      setEditingInstructionSetId("");
      setNotice({
        tone: "success",
        message: editingInstructionSetId
          ? "Rekening transfer diperbarui dan versi barunya sudah aktif."
          : "Instruksi transfer dibuat dan diaktifkan.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Instruksi transfer gagal dibuat.",
      });
    }
  }
  async function createPolicy(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        policyReason.trim() ||
        "Kebijakan pembatalan dan refund dibuat oleh Owner";
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_POLICY_DRAFT",
        policySetId: editingPolicySetId || undefined,
        code: internalCode("CANCELLATION-REFUND"),
        policyType: "CANCELLATION_REFUND",
        titleId: policyTitleId,
        titleEn: policyTitleEn,
        contentId: policyContentId,
        contentEn: policyContentEn,
        effectiveFrom: new Date().toISOString(),
        reason: auditReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "REVIEW_VERSION",
        subject: "POLICY",
        versionId: String(draft.id),
        decision: "APPROVE",
        reason: auditReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "PUBLISH_VERSION",
        subject: "POLICY",
        versionId: String(draft.id),
        reason: auditReason,
      });
      setPolicyTitleId("");
      setPolicyTitleEn("");
      setPolicyContentId("");
      setPolicyContentEn("");
      setPolicyReason("");
      setEditingPolicySetId("");
      setNotice({
        tone: "success",
        message: editingPolicySetId
          ? "Kebijakan diperbarui dan versi barunya sudah aktif."
          : "Kebijakan pembatalan/refund dibuat dan diaktifkan.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Kebijakan gagal dibuat.",
      });
    }
  }

  async function createDocumentProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      const auditReason =
        documentReason.trim() ||
        "Profil invoice dan kuitansi dikonfigurasi oleh Owner";
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_DOCUMENT_PROFILE_DRAFT",
        documentProfileId: editingDocumentProfileId || undefined,
        code: internalCode("DOCUMENT-KOOKA"),
        legalName: documentLegalName,
        displayName: documentDisplayName,
        address: documentAddress,
        contact: documentContact || null,
        taxIdentity: null,
        logoFileId: null,
        footerId: "Terima kasih telah memilih KOOKA Residence Surabaya.",
        footerEn: "Thank you for choosing KOOKA Residence Surabaya.",
        templateReference: "kooka-a5-v1",
        effectiveFrom: new Date().toISOString(),
        reason: auditReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "REVIEW_VERSION",
        subject: "DOCUMENT_PROFILE",
        versionId: String(draft.id),
        decision: "APPROVE",
        reason: auditReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "PUBLISH_VERSION",
        subject: "DOCUMENT_PROFILE",
        versionId: String(draft.id),
        reason: auditReason,
      });
      setDocumentReason("");
      setEditingDocumentProfileId(
        String(draft.parentId ?? editingDocumentProfileId),
      );
      setNotice({
        tone: "success",
        message: editingDocumentProfileId
          ? "Profil invoice dan kuitansi diperbarui dan sudah aktif."
          : "Profil invoice dan kuitansi dibuat dan langsung aktif.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Profil dokumen gagal disimpan.",
      });
    }
  }

  function editTax(item: JsonRecord) {
    setEditingTaxProfileId(String(item.profileId));
    setDomain(String(item.domain ?? "LODGING"));
    setNoTax(Boolean(item.noTax));
    setTaxRate(String(Number(item.taxRate ?? 0) * 100));
    setServiceRate(String(Number(item.serviceChargeRate ?? 0) * 100));
    setTaxPriceMode(
      item.taxInclusive && item.serviceChargeInclusive
        ? "INCLUSIVE"
        : "EXCLUSIVE",
    );
    setReason("");
    scrollToForm("tax-settings-form");
  }

  function editRatePlan(item: JsonRecord) {
    const rule = rateRules.find(
      (candidate) =>
        String(candidate.ratePlanVersionId) === String(item.versionId),
    );
    setEditingRatePlanId(String(item.ratePlanId));
    setPlanNameId(String(item.nameId ?? "Harga Standar"));
    setPlanNameEn(String(item.nameEn ?? "Standard Rate"));
    setPlanRoomTypeId(String(rule?.roomTypeId ?? ""));
    setNightlyRate(
      rule?.nightlyRateIdr === null || rule?.nightlyRateIdr === undefined
        ? ""
        : String(Math.trunc(Number(rule.nightlyRateIdr))),
    );
    setMinimumStay(String(rule?.minimumStay ?? 1));
    setRateStartsOn(String(rule?.startsOn ?? rateStartsOn).slice(0, 10));
    setRateEndsOn(String(rule?.endsOn ?? rateEndsOn).slice(0, 10));
    setSelectedTaxProfileId(String(item.taxProfileId ?? ""));
    setSelectedCancellationPolicySetId(
      String(item.cancellationPolicySetId ?? ""),
    );
    setShowRateOptions(true);
    setRateReason("");
    scrollToForm("rate-settings-form");
  }

  function editPaymentInstruction(item: JsonRecord) {
    setEditingInstructionSetId(String(item.instructionSetId));
    setBankName(String(item.bankName ?? ""));
    setAccountHolder(String(item.accountHolder ?? ""));
    setAccountNumber("");
    setBankReason("");
    scrollToForm("bank-settings-form");
  }

  function editPolicy(item: JsonRecord) {
    setEditingPolicySetId(String(item.policySetId));
    setPolicyTitleId(String(item.titleId ?? ""));
    setPolicyTitleEn(String(item.titleEn ?? ""));
    setPolicyContentId(String(item.contentId ?? ""));
    setPolicyContentEn(String(item.contentEn ?? ""));
    setPolicyReason("");
    scrollToForm("policy-settings-form");
  }

  function editDocumentProfile(item: JsonRecord) {
    setEditingDocumentProfileId(String(item.profileId));
    setDocumentLegalName(String(item.legalName ?? property.name ?? ""));
    setDocumentDisplayName(String(item.displayName ?? property.name ?? ""));
    setDocumentAddress(String(item.address ?? property.address ?? ""));
    setDocumentContact(String(item.contact ?? ""));
    setDocumentReason("");
    scrollToForm("document-profile-form");
  }

  async function retireVersion() {
    if (!retireTarget) return;
    try {
      await post("/api/staff/admin/commercial-master", {
        action: "RETIRE_VERSION",
        subject: retireTarget.subject,
        versionId: retireTarget.versionId,
        reason: retireReason,
      });
      setNotice({
        tone: "success",
        message: `${retireTarget.label} telah dinonaktifkan. Riwayat lama tetap tersimpan.`,
      });
      setRetireTarget(null);
      setRetireReason("");
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Pengaturan belum dapat dinonaktifkan.",
      });
    }
  }

  function statusLabel(item: JsonRecord) {
    return item.lifecycleStatus === "SCHEDULED" ? "Dijadwalkan" : "Aktif";
  }

  function rateRuleFor(item: JsonRecord) {
    return rateRules.find(
      (rule) => String(rule.ratePlanVersionId) === String(item.versionId),
    );
  }

  function roomTypeName(roomTypeId: unknown) {
    const roomType = roomTypes.find(
      (item) => String(item.roomTypeId) === String(roomTypeId ?? ""),
    );
    return String(roomType?.nameId ?? "Semua jenis kamar");
  }

  return (
    <div className={styles.actionGrid}>
      <section
        className={`${styles.setupInlineGuide} ${styles.actionGridWide}`}
      >
        <div>
          <span className={styles.pageEyebrow}>Agar booking online aktif</span>
          <h2>Lengkapi harga, pembayaran, dan dokumen</h2>
          <p>
            Harga, status pajak, rekening transfer, dan profil dokumen wajib
            disiapkan agar alur booking sampai penerbitan invoice berjalan.
          </p>
        </div>
        <div className={styles.setupInlineChecks}>
          <span>
            <i className={roomTypes.length ? styles.checkDone : ""} />
            {roomTypes.length} jenis kamar
          </span>
          <span>
            <i
              className={
                !missingPriceRoomTypes.length && roomTypes.length
                  ? styles.checkDone
                  : ""
              }
            />
            {missingPriceRoomTypes.length
              ? `${missingPriceRoomTypes.length} jenis belum memiliki harga`
              : "Semua jenis memiliki harga"}
          </span>
          <span>
            <i className={activeInstructions.length ? styles.checkDone : ""} />
            {activeInstructions.length} rekening aktif
          </span>
          <span>
            <i className={activeDocuments.length ? styles.checkDone : ""} />
            {activeDocuments.length
              ? "Profil invoice dan kuitansi aktif"
              : "Profil invoice dan kuitansi belum aktif"}
          </span>
          <span>
            <i
              className={
                activeRates.length && !roomRatesWithoutTaxDecision.length
                  ? styles.checkDone
                  : ""
              }
            />
            {!activeRates.length
              ? "Belum ada harga untuk diperiksa pajaknya"
              : roomRatesWithoutTaxDecision.length
                ? `${roomRatesWithoutTaxDecision.length} harga belum menentukan pajak`
                : explicitlyUntaxedRoomRates.length
                  ? `${explicitlyUntaxedRoomRates.length} harga ditetapkan tanpa pajak`
                  : "Semua harga memakai pajak"}
          </span>
        </div>
      </section>
      <section
        className={`${styles.formCard} ${styles.setupOrderTwo}`}
        id="tax-settings-form"
      >
        <div className={styles.panelHeader}>
          <h2>
            {editingTaxProfileId
              ? "Edit pajak & biaya layanan"
              : "Pajak & biaya layanan"}
          </h2>
          <span className={styles.countPill}>Opsional</span>
          {editingTaxProfileId ? (
            <button
              className={styles.textButton}
              onClick={() => setEditingTaxProfileId("")}
              type="button"
            >
              Batalkan edit
            </button>
          ) : null}
        </div>
        <form className={styles.staffForm} onSubmit={createTax}>
          <p className={styles.formHint}>
            Pilih penerapannya, lalu tentukan apakah transaksi menggunakan
            pajak. Informasi pencatatan lainnya dibuat otomatis.
          </p>
          <div className={styles.formGrid}>
            <label>
              Diterapkan untuk
              <KookaSelect
                ariaLabel="Penerapan pajak"
                value={domain}
                onChange={setDomain}
                options={[
                  { value: "LODGING", label: "Kamar" },
                  { value: "FNB", label: "F&B" },
                  { value: "SERVICE", label: "Layanan / tour" },
                ]}
              />
            </label>
            <label>
              Perlakuan pajak
              <KookaSelect
                ariaLabel="Perlakuan pajak"
                value={noTax ? "NO_TAX" : "WITH_TAX"}
                onChange={(value) => setNoTax(value === "NO_TAX")}
                options={[
                  { value: "NO_TAX", label: "Tanpa pajak" },
                  { value: "WITH_TAX", label: "Gunakan pajak" },
                ]}
              />
            </label>
            {!noTax ? (
              <>
                <label>
                  Pajak (%)
                  <input
                    max="100"
                    min="0"
                    required
                    step="0.01"
                    type="number"
                    value={taxRate}
                    onChange={(event) => setTaxRate(event.target.value)}
                  />
                </label>
                <label>
                  Biaya layanan (%)
                  <input
                    max="100"
                    min="0"
                    required
                    step="0.01"
                    type="number"
                    value={serviceRate}
                    onChange={(event) => setServiceRate(event.target.value)}
                  />
                </label>
                <label>
                  Harga yang dimasukkan
                  <KookaSelect
                    ariaLabel="Cara pajak diterapkan pada harga"
                    value={taxPriceMode}
                    onChange={setTaxPriceMode}
                    options={[
                      {
                        value: "EXCLUSIVE",
                        label: "Belum termasuk pajak",
                        description:
                          "Pajak dan biaya layanan ditambahkan ke harga kamar.",
                      },
                      {
                        value: "INCLUSIVE",
                        label: "Sudah termasuk pajak",
                        description:
                          "Total kamar tetap; pajak dipisahkan dari harga tersebut.",
                      },
                    ]}
                  />
                </label>
              </>
            ) : null}
          </div>
          {domain === "LODGING" ? (
            <label className={styles.checkboxLabel}>
              <input
                checked={applyTaxToActiveRates}
                onChange={(event) =>
                  setApplyTaxToActiveRates(event.target.checked)
                }
                type="checkbox"
              />
              Terapkan pengaturan ini ke seluruh harga kamar aktif
            </label>
          ) : null}
          <label>
            Catatan internal (opsional)
            <textarea
              placeholder="Contoh: konfigurasi awal kamar"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton}>
            {editingTaxProfileId
              ? "Simpan perubahan pajak"
              : "Simpan pengaturan pajak"}
          </button>
        </form>
      </section>
      <section
        className={`${styles.formCard} ${styles.setupOrderTwo}`}
        id="bank-settings-form"
      >
        <div className={styles.panelHeader}>
          <h2>
            {editingInstructionSetId
              ? "Edit rekening transfer"
              : "Instruksi transfer bank"}
          </h2>
          {editingInstructionSetId ? (
            <button
              className={styles.textButton}
              onClick={() => setEditingInstructionSetId("")}
              type="button"
            >
              Batalkan edit
            </button>
          ) : null}
        </div>
        <form className={styles.staffForm} onSubmit={createPaymentInstruction}>
          <div className={styles.formGrid}>
            <label>
              Nama bank
              <input
                onChange={(event) => setBankName(event.target.value)}
                required
                value={bankName}
              />
            </label>
            <label>
              Nama pemilik rekening
              <input
                onChange={(event) => setAccountHolder(event.target.value)}
                required
                value={accountHolder}
              />
            </label>
            <label>
              Nomor rekening
              <input
                inputMode="numeric"
                onChange={(event) =>
                  setAccountNumber(event.target.value.replace(/\D/gu, ""))
                }
                required
                value={accountNumber}
              />
              {editingInstructionSetId ? (
                <small>
                  Masukkan kembali nomor rekening lengkap untuk keamanan.
                </small>
              ) : null}
            </label>
          </div>
          <label>
            Catatan internal (opsional)
            <textarea
              placeholder="Contoh: rekening utama reservasi"
              onChange={(event) => setBankReason(event.target.value)}
              value={bankReason}
            />
          </label>
          <button className={styles.primaryButton}>
            {editingInstructionSetId
              ? "Simpan perubahan rekening"
              : "Simpan & aktifkan rekening"}
          </button>
        </form>
      </section>
      <section
        className={`${styles.formCard} ${styles.setupOrderTwo}`}
        id="document-profile-form"
      >
        <div className={styles.panelHeader}>
          <div>
            <h2>
              {editingDocumentProfileId
                ? "Edit profil invoice & kuitansi"
                : "Profil invoice & kuitansi"}
            </h2>
            <p className={styles.formHint}>
              Wajib agar invoice, kuitansi, proforma, dan refund note dapat
              diterbitkan.
            </p>
          </div>
          <span className={styles.countPill}>
            {activeDocuments.length ? "Aktif" : "Wajib"}
          </span>
        </div>
        <form className={styles.staffForm} onSubmit={createDocumentProfile}>
          <div className={styles.formGrid}>
            <label>
              Nama resmi properti
              <input
                onChange={(event) => setDocumentLegalName(event.target.value)}
                required
                value={documentLegalName}
              />
            </label>
            <label>
              Nama yang tampil di dokumen
              <input
                onChange={(event) => setDocumentDisplayName(event.target.value)}
                required
                value={documentDisplayName}
              />
            </label>
          </div>
          <label>
            Alamat pada dokumen
            <textarea
              onChange={(event) => setDocumentAddress(event.target.value)}
              required
              value={documentAddress}
            />
          </label>
          <label>
            Kontak pada dokumen (opsional)
            <input
              onChange={(event) => setDocumentContact(event.target.value)}
              placeholder="Nomor WhatsApp dan/atau email"
              value={documentContact}
            />
          </label>
          <label>
            Catatan internal (opsional)
            <textarea
              onChange={(event) => setDocumentReason(event.target.value)}
              placeholder="Contoh: identitas dokumen utama KOOKA"
              value={documentReason}
            />
          </label>
          <button className={styles.primaryButton}>
            {editingDocumentProfileId
              ? "Simpan perubahan profil dokumen"
              : "Simpan & aktifkan profil dokumen"}
          </button>
        </form>
      </section>
      <section
        className={`${styles.formCard} ${styles.actionGridWide} ${styles.setupAdvancedCard}`}
        id="policy-settings-form"
      >
        <div className={styles.panelHeader}>
          <h2>
            {editingPolicySetId
              ? "Edit kebijakan pembatalan & refund"
              : "Kebijakan pembatalan & refund"}
          </h2>
          <span className={styles.countPill}>Opsional</span>
          {editingPolicySetId ? (
            <button
              className={styles.textButton}
              onClick={() => setEditingPolicySetId("")}
              type="button"
            >
              Batalkan edit
            </button>
          ) : null}
        </div>
        <form className={styles.staffForm} onSubmit={createPolicy}>
          <div className={styles.formGrid}>
            <label>
              Judul Indonesia
              <input
                onChange={(event) => setPolicyTitleId(event.target.value)}
                required
                value={policyTitleId}
              />
            </label>
            <label>
              Judul English
              <input
                onChange={(event) => setPolicyTitleEn(event.target.value)}
                required
                value={policyTitleEn}
              />
            </label>
          </div>
          <div className={styles.formGrid}>
            <label>
              Isi kebijakan Indonesia
              <textarea
                onChange={(event) => setPolicyContentId(event.target.value)}
                required
                value={policyContentId}
              />
            </label>
            <label>
              Policy content English
              <textarea
                onChange={(event) => setPolicyContentEn(event.target.value)}
                required
                value={policyContentEn}
              />
            </label>
          </div>
          <label>
            Catatan internal (opsional)
            <textarea
              placeholder="Contoh: kebijakan awal properti"
              onChange={(event) => setPolicyReason(event.target.value)}
              value={policyReason}
            />
          </label>
          <button className={styles.primaryButton}>
            {editingPolicySetId
              ? "Simpan perubahan kebijakan"
              : "Simpan & aktifkan kebijakan"}
          </button>
        </form>
      </section>
      <section
        className={`${styles.formCard} ${styles.actionGridWide} ${styles.setupOrderOne}`}
        id="rate-settings-form"
      >
        <div className={styles.panelHeader}>
          <h2>{editingRatePlanId ? "Edit harga kamar" : "Harga kamar"}</h2>
          {editingRatePlanId ? (
            <button
              className={styles.textButton}
              onClick={() => setEditingRatePlanId("")}
              type="button"
            >
              Batalkan edit
            </button>
          ) : null}
        </div>
        <form className={styles.staffForm} onSubmit={createRatePlan}>
          <p className={styles.formHint}>
            Tentukan harga per malam untuk satu jenis kamar. Pengaturan dasar
            lainnya sudah disiapkan otomatis.
          </p>
          <div className={styles.formGrid}>
            <label>
              Jenis kamar
              <KookaSelect
                ariaLabel="Tipe kamar rate plan"
                onChange={setPlanRoomTypeId}
                options={roomTypes.map((item) => ({
                  value: String(item.roomTypeId),
                  label: String(item.nameId ?? item.code),
                }))}
                placeholder="Pilih tipe kamar"
                value={planRoomTypeId}
              />
            </label>
            <label>
              Nama harga (Indonesia)
              <input
                onChange={(event) => setPlanNameId(event.target.value)}
                required
                value={planNameId}
              />
            </label>
            <label>
              Nama harga (English)
              <input
                onChange={(event) => setPlanNameEn(event.target.value)}
                required
                value={planNameEn}
              />
            </label>
            <label>
              Harga per malam (IDR)
              <MoneyInput
                ariaLabel="Harga kamar per malam"
                onChange={setNightlyRate}
                required
                value={nightlyRate}
              />
            </label>
          </div>
          <div className={styles.formGrid}>
            <label>
              Pajak untuk harga ini
              <KookaSelect
                ariaLabel="Pajak untuk harga kamar"
                onChange={setSelectedTaxProfileId}
                options={[
                  {
                    value: "",
                    label: "Belum ditentukan",
                    description:
                      "Pajak tidak dihitung sampai profil pajak dipilih.",
                  },
                  ...lodgingTaxes.map((item) => ({
                    value: String(item.profileId),
                    label: String(item.name ?? "Pengaturan pajak kamar"),
                    description: taxDescription(item),
                  })),
                ]}
                value={selectedTaxProfileId}
              />
            </label>
            <label>
              Kebijakan pembatalan (opsional)
              <KookaSelect
                ariaLabel="Kebijakan pembatalan harga kamar"
                onChange={setSelectedCancellationPolicySetId}
                options={[
                  { value: "", label: "Tidak dipilih" },
                  ...activePolicies.map((item) => ({
                    value: String(item.policySetId),
                    label: String(item.titleId ?? "Kebijakan pembatalan"),
                  })),
                ]}
                value={selectedCancellationPolicySetId}
              />
            </label>
          </div>
          <div
            className={`${styles.taxStatusCard} ${
              selectedTaxProfileId
                ? styles.taxStatusConfigured
                : styles.taxStatusWarning
            }`}
          >
            <strong>
              {selectedTaxProfileId
                ? "Status pajak harga kamar sudah ditentukan"
                : "Status pajak harga kamar belum ditentukan"}
            </strong>
            <span>
              {selectedTaxProfileId
                ? taxDescription(
                    lodgingTaxes.find(
                      (item) => String(item.profileId) === selectedTaxProfileId,
                    ),
                  )
                : "Booking dari harga ini belum akan menghitung pajak."}
            </span>
          </div>
          <p className={styles.formHint}>
            Semua rekening transfer yang aktif berlaku untuk seluruh harga kamar
            dan akan ditampilkan kepada tamu setelah booking online.
          </p>
          <button
            className={styles.secondaryButton}
            onClick={() => setShowRateOptions((current) => !current)}
            type="button"
          >
            {showRateOptions
              ? "Sembunyikan pengaturan tambahan"
              : "Tampilkan pengaturan tambahan"}
          </button>
          {showRateOptions ? (
            <div className={styles.formGrid}>
              <label>
                Minimum menginap (malam)
                <input
                  min="1"
                  onChange={(event) => setMinimumStay(event.target.value)}
                  required
                  type="number"
                  value={minimumStay}
                />
              </label>
              <label>
                Berlaku mulai
                <DateField
                  ariaLabel="Tanggal mulai harga"
                  onChange={setRateStartsOn}
                  value={rateStartsOn}
                />
              </label>
              <label>
                Berlaku sampai
                <DateField
                  ariaLabel="Tanggal akhir harga"
                  min={rateStartsOn}
                  onChange={setRateEndsOn}
                  value={rateEndsOn}
                />
              </label>
            </div>
          ) : null}
          <label>
            Catatan internal (opsional)
            <textarea
              placeholder="Contoh: harga standar pembukaan"
              onChange={(event) => setRateReason(event.target.value)}
              value={rateReason}
            />
          </label>
          <button className={styles.primaryButton}>
            {editingRatePlanId
              ? "Simpan perubahan harga"
              : "Simpan & aktifkan harga"}
          </button>
        </form>
      </section>
      <section
        className={`${styles.formCard} ${styles.setupAdvancedCard}`}
        id="currency-settings-form"
      >
        <div className={styles.panelHeader}>
          <h2>Kurs tampilan</h2>
          <span className={styles.countPill}>Opsional</span>
        </div>
        <form className={styles.staffForm} onSubmit={createRate}>
          <div className={styles.formGrid}>
            <label>
              Mata uang
              <KookaSelect
                ariaLabel="Currency kurs tampilan"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: "USD", label: "USD" },
                  { value: "AUD", label: "AUD" },
                ]}
              />
            </label>
            <label>
              Nilai 1 {currency} dalam rupiah
              <MoneyInput
                ariaLabel={`Nilai 1 ${currency} dalam rupiah`}
                required
                value={displayRate}
                onChange={setDisplayRate}
              />
            </label>
          </div>
          <p className={styles.formHint}>
            Contoh: bila 1 USD sekitar Rp16.500, masukkan 16.500. Nilai ini
            hanya untuk estimasi tampilan; seluruh transaksi tetap IDR.
          </p>
          <button className={styles.primaryButton}>Simpan kurs tampilan</button>
        </form>
      </section>
      <section
        className={`${styles.panel} ${styles.menuCatalogPanel} ${styles.setupOrderThree}`}
      >
        <div className={styles.panelHeader}>
          <h2>Pengaturan yang aktif</h2>
          <span className={styles.countPill}>
            {activeTaxes.length} pajak · {activeRates.length} harga ·{" "}
            {activeInstructions.length} rekening · {activeDocuments.length}{" "}
            profil dokumen · {activePolicies.length} kebijakan ·{" "}
            {latestExchange.length} kurs
          </span>
        </div>
        <div className={styles.menuCatalogGroups}>
          <section className={styles.commercialGroup}>
            <div className={styles.commercialGroupHeader}>
              <h3>Pajak &amp; biaya layanan</h3>
              <small>{activeTaxes.length} pengaturan berlaku</small>
            </div>
            <div className={styles.masterList}>
              {activeTaxes.map((tax) => (
                <article key={String(tax.versionId)}>
                  <div>
                    <strong>{String(tax.name ?? "Pengaturan pajak")}</strong>
                    <small>
                      {tax.domain === "LODGING"
                        ? "Kamar"
                        : tax.domain === "FNB"
                          ? "F&B"
                          : "Layanan / tour"}
                      {tax.noTax
                        ? " · tanpa pajak"
                        : ` · pajak ${percent(tax.taxRate)} · layanan ${percent(tax.serviceChargeRate)}`}
                    </small>
                  </div>
                  <div className={styles.commercialActions}>
                    <span className={styles.statusPill}>
                      {statusLabel(tax)}
                    </span>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => editTax(tax)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={() =>
                        setRetireTarget({
                          subject: "TAX_PROFILE",
                          versionId: String(tax.versionId),
                          label: String(tax.name ?? "Pengaturan pajak"),
                        })
                      }
                      type="button"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                </article>
              ))}
              {!activeTaxes.length ? (
                <p className={styles.emptyCompact}>
                  Belum ada pengaturan pajak yang aktif.
                </p>
              ) : null}
            </div>
          </section>

          <section className={styles.commercialGroup}>
            <div className={styles.commercialGroupHeader}>
              <h3>Harga kamar</h3>
              <small
                className={
                  activeInstructions.length
                    ? styles.configurationReady
                    : styles.configurationWarning
                }
              >
                {activeRates.length} harga berlaku ·{" "}
                {activeInstructions.length
                  ? `${activeInstructions.length} rekening transfer aktif`
                  : "belum ada rekening transfer aktif"}
              </small>
            </div>
            <div className={styles.masterList}>
              {activeRates.map((rate) => {
                const rule = rateRuleFor(rate);
                const linkedTax = activeTaxes.find(
                  (tax) =>
                    String(tax.profileId) === String(rate.taxProfileId ?? ""),
                );
                const linkedPolicy = activePolicies.find(
                  (policy) =>
                    String(policy.policySetId) ===
                    String(rate.cancellationPolicySetId ?? ""),
                );
                return (
                  <article key={String(rate.versionId)}>
                    <div>
                      <strong>{String(rate.nameId ?? "Harga kamar")}</strong>
                      <small>
                        {roomTypeName(rule?.roomTypeId)} ·{" "}
                        {idr(rule?.nightlyRateIdr)} / malam · minimum{" "}
                        {String(rule?.minimumStay ?? 1)} malam
                      </small>
                      <small
                        className={
                          linkedTax && !linkedTax.noTax
                            ? styles.configurationReady
                            : styles.configurationWarning
                        }
                      >
                        Pajak:{" "}
                        {linkedTax
                          ? taxDescription(linkedTax)
                          : "Belum ditentukan"}
                      </small>
                      <small>
                        Berlaku {dateLabel(rule?.startsOn)} –{" "}
                        {dateLabel(rule?.endsOn)}
                      </small>
                      {linkedPolicy ? (
                        <small>Kebijakan: {String(linkedPolicy.titleId)}</small>
                      ) : null}
                    </div>
                    <div className={styles.commercialActions}>
                      <span className={styles.statusPill}>
                        {statusLabel(rate)}
                      </span>
                      <button
                        className={styles.secondaryButton}
                        onClick={() => editRatePlan(rate)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className={styles.dangerButton}
                        onClick={() =>
                          setRetireTarget({
                            subject: "RATE_PLAN",
                            versionId: String(rate.versionId),
                            label: String(rate.nameId ?? "Harga kamar"),
                          })
                        }
                        type="button"
                      >
                        Nonaktifkan
                      </button>
                    </div>
                  </article>
                );
              })}
              {!activeRates.length ? (
                <p className={styles.emptyCompact}>
                  Belum ada harga kamar yang aktif.
                </p>
              ) : null}
            </div>
          </section>

          <section className={styles.commercialGroup}>
            <div className={styles.commercialGroupHeader}>
              <h3>Rekening transfer</h3>
              <small>{activeInstructions.length} rekening berlaku</small>
            </div>
            <div className={styles.masterList}>
              {activeInstructions.map((instruction) => (
                <article key={String(instruction.versionId)}>
                  <div>
                    <strong>{String(instruction.bankName ?? "Bank")}</strong>
                    <small>
                      {String(instruction.accountHolder ?? "—")} · rekening
                      berakhir {String(instruction.accountNumberLast4 ?? "—")}
                    </small>
                  </div>
                  <div className={styles.commercialActions}>
                    <span className={styles.statusPill}>
                      {statusLabel(instruction)}
                    </span>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => editPaymentInstruction(instruction)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={() =>
                        setRetireTarget({
                          subject: "PAYMENT_INSTRUCTION",
                          versionId: String(instruction.versionId),
                          label: `Rekening ${String(instruction.bankName ?? "bank")}`,
                        })
                      }
                      type="button"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                </article>
              ))}
              {!activeInstructions.length ? (
                <p className={styles.emptyCompact}>
                  Belum ada rekening transfer yang aktif.
                </p>
              ) : null}
            </div>
          </section>

          <section className={styles.commercialGroup}>
            <div className={styles.commercialGroupHeader}>
              <h3>Profil invoice &amp; kuitansi</h3>
              <small>{activeDocuments.length} profil berlaku</small>
            </div>
            <div className={styles.masterList}>
              {activeDocuments.map((document) => (
                <article key={String(document.versionId)}>
                  <div>
                    <strong>
                      {String(document.displayName ?? "Profil dokumen")}
                    </strong>
                    <small>{String(document.legalName ?? "—")}</small>
                    <small>
                      {String(document.address ?? "Alamat belum tersedia")}
                    </small>
                    {document.contact ? (
                      <small>{String(document.contact)}</small>
                    ) : null}
                  </div>
                  <div className={styles.commercialActions}>
                    <span className={styles.statusPill}>
                      {statusLabel(document)}
                    </span>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => editDocumentProfile(document)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={() =>
                        setRetireTarget({
                          subject: "DOCUMENT_PROFILE",
                          versionId: String(document.versionId),
                          label: String(
                            document.displayName ?? "Profil dokumen",
                          ),
                        })
                      }
                      type="button"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                </article>
              ))}
              {!activeDocuments.length ? (
                <p className={styles.emptyCompact}>
                  Belum ada profil invoice dan kuitansi yang aktif.
                </p>
              ) : null}
            </div>
          </section>

          <section className={styles.commercialGroup}>
            <div className={styles.commercialGroupHeader}>
              <h3>Kebijakan pembatalan &amp; refund</h3>
              <small>{activePolicies.length} kebijakan berlaku</small>
            </div>
            <div className={styles.masterList}>
              {activePolicies.map((policy) => (
                <article key={String(policy.versionId)}>
                  <div>
                    <strong>{String(policy.titleId ?? "Kebijakan")}</strong>
                    <small>
                      {String(policy.contentId ?? "").slice(0, 150) ||
                        "Isi kebijakan belum tersedia."}
                    </small>
                  </div>
                  <div className={styles.commercialActions}>
                    <span className={styles.statusPill}>
                      {statusLabel(policy)}
                    </span>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => editPolicy(policy)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={() =>
                        setRetireTarget({
                          subject: "POLICY",
                          versionId: String(policy.versionId),
                          label: String(policy.titleId ?? "Kebijakan"),
                        })
                      }
                      type="button"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                </article>
              ))}
              {!activePolicies.length ? (
                <p className={styles.emptyCompact}>
                  Belum ada kebijakan pembatalan yang aktif.
                </p>
              ) : null}
            </div>
          </section>

          <section className={styles.commercialGroup}>
            <div className={styles.commercialGroupHeader}>
              <h3>Kurs tampilan</h3>
              <small>Hanya untuk estimasi; transaksi tetap IDR</small>
            </div>
            <div className={styles.masterList}>
              {latestExchange.map((item) => (
                <article key={String(item.quoteCurrency)}>
                  <div>
                    <strong>{String(item.quoteCurrency)}</strong>
                    <small>
                      1 {String(item.quoteCurrency)} ≈{" "}
                      {idr(1 / Number(item.rate ?? 1))} · diperbarui{" "}
                      {dateLabel(item.asOfAt)}
                    </small>
                  </div>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => {
                      setCurrency(String(item.quoteCurrency));
                      setDisplayRate(
                        String(Math.round(1 / Number(item.rate ?? 1))),
                      );
                      scrollToForm("currency-settings-form");
                    }}
                    type="button"
                  >
                    Perbarui
                  </button>
                </article>
              ))}
              {!latestExchange.length ? (
                <p className={styles.emptyCompact}>Belum ada kurs tampilan.</p>
              ) : null}
            </div>
          </section>
        </div>
      </section>
      <ReasonDialog
        confirmLabel="Nonaktifkan pengaturan"
        description="Pengaturan tidak akan dipakai untuk transaksi baru. Booking, invoice, dan riwayat lama tetap tersimpan tanpa berubah."
        onCancel={() => {
          setRetireTarget(null);
          setRetireReason("");
        }}
        onChange={setRetireReason}
        onConfirm={() => void retireVersion()}
        open={Boolean(retireTarget)}
        title={`Nonaktifkan ${retireTarget?.label ?? "pengaturan"}?`}
        value={retireReason}
      />
    </div>
  );
}

function ContentAdmin({
  commercial,
  content,
  media,
  menu,
  rooms,
  canManageMedia,
  canPublishMedia,
  canManageMenu,
  load,
  setNotice,
}: {
  commercial: unknown;
  content: unknown;
  media: unknown;
  menu: unknown;
  rooms: unknown;
  canManageMedia: boolean;
  canPublishMedia: boolean;
  canManageMenu: boolean;
  load: () => Promise<void>;
  setNotice: (notice: Notice) => void;
}) {
  const pages = Array.isArray(content) ? (content as JsonRecord[]) : [];
  const assets = (Array.isArray(media) ? (media as JsonRecord[]) : []).filter(
    (asset) => String(asset.status) !== "ARCHIVED",
  );
  const roomData = recordOf(rooms);
  const activeRoomTypes = latestBy(
    rowsOf(roomData.roomTypes),
    "roomTypeId",
  ).filter(activeVersion);
  const menuRows = useMemo(
    () => (Array.isArray(menu) ? (menu as JsonRecord[]) : []),
    [menu],
  );
  const commercialData = recordOf(commercial);
  const activeFnbTaxes = latestBy(
    rowsOf(commercialData.taxes),
    "profileId",
  ).filter((tax) => activeVersion(tax) && String(tax.domain) === "FNB");
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const menuCatalog = useMemo(() => {
    const categories = new Map<
      string,
      {
        categoryId: string;
        categoryCode: string;
        categoryNameId: string;
        categoryNameEn: string;
        categoryStatus: string;
        categorySortOrder: number;
        items: Map<
          string,
          {
            itemId: string;
            itemCode: string;
            itemStatus: string;
            currentlyAvailable: boolean;
            itemSortOrder: number;
            versions: JsonRecord[];
            latestVersion?: JsonRecord;
            activatableVersionId?: string;
          }
        >;
      }
    >();

    for (const row of menuRows) {
      const categoryId = String(row.categoryId ?? "");
      if (!categoryId) continue;
      let category = categories.get(categoryId);
      if (!category) {
        category = {
          categoryId,
          categoryCode: String(row.categoryCode ?? ""),
          categoryNameId: String(row.categoryNameId ?? ""),
          categoryNameEn: String(row.categoryNameEn ?? ""),
          categoryStatus: String(row.categoryStatus ?? "DRAFT"),
          categorySortOrder: Number(row.categorySortOrder ?? 0),
          items: new Map(),
        };
        categories.set(categoryId, category);
      }

      const itemId = String(row.itemId ?? "");
      if (!itemId) continue;
      let item = category.items.get(itemId);
      if (!item) {
        item = {
          itemId,
          itemCode: String(row.itemCode ?? ""),
          itemStatus: String(row.itemStatus ?? "DRAFT"),
          currentlyAvailable: Boolean(row.currentlyAvailable),
          itemSortOrder: Number(row.itemSortOrder ?? 0),
          versions: [],
        };
        category.items.set(itemId, item);
      }
      if (row.versionId) item.versions.push(row);
    }

    const result = [];
    for (const category of categories.values()) {
      const items = [];
      for (const item of category.items.values()) {
        const versions = [...item.versions].sort(
          (left, right) =>
            Number(right.versionNumber ?? 0) - Number(left.versionNumber ?? 0),
        );
        const latestVersion = versions[0];
        const activatableVersion = versions.find((candidate) =>
          ["DRAFT", "SCHEDULED"].includes(
            String(candidate.lifecycleStatus ?? ""),
          ),
        );
        items.push({
          ...item,
          versions,
          latestVersion,
          activatableVersionId: String(activatableVersion?.versionId ?? ""),
        });
      }
      result.push({
        ...category,
        items: items.sort(
          (first, second) =>
            Number(first.itemSortOrder ?? 0) -
              Number(second.itemSortOrder ?? 0) ||
            String(first.itemCode).localeCompare(
              String(second.itemCode),
              "id-ID",
            ),
        ),
      });
    }

    return result.sort(
      (first, second) =>
        Number(first.categorySortOrder ?? 0) -
          Number(second.categorySortOrder ?? 0) ||
        String(first.categoryNameId).localeCompare(
          String(second.categoryNameId),
          "id-ID",
        ),
    );
  }, [menuRows]);
  const menuCategoryOptions = menuCatalog.map((category) => ({
    value: category.categoryId,
    label: category.categoryNameId || category.categoryCode,
  }));
  const [files, setFiles] = useState<File[]>([]);
  const [heroVideoFile, setHeroVideoFile] = useState<File | null>(null);
  const [heroVideoTitle, setHeroVideoTitle] = useState("");
  const [heroVideoAltId, setHeroVideoAltId] = useState(
    "Suasana KOOKA Residence Surabaya",
  );
  const [heroVideoAltEn, setHeroVideoAltEn] = useState(
    "The atmosphere at KOOKA Residence Surabaya",
  );
  const [landingImageFile, setLandingImageFile] = useState<File | null>(null);
  const [landingImageSection, setLandingImageSection] = useState<
    "experience" | "gallery"
  >("experience");
  const [landingImageTitle, setLandingImageTitle] = useState("");
  const [landingImageAltId, setLandingImageAltId] = useState("");
  const [landingImageAltEn, setLandingImageAltEn] = useState("");
  const [landingImageCaptionId, setLandingImageCaptionId] = useState("");
  const [landingImageCaptionEn, setLandingImageCaptionEn] = useState("");
  const [landingSectionDrafts, setLandingSectionDrafts] = useState<
    Record<string, string[]>
  >({});
  const [landingExistingAssetDrafts, setLandingExistingAssetDrafts] = useState<
    Record<string, string>
  >({});
  const [landingMetadataDrafts, setLandingMetadataDrafts] = useState<
    Record<
      string,
      Partial<
        Record<"title" | "altId" | "altEn" | "captionId" | "captionEn", string>
      >
    >
  >({});
  const [title, setTitle] = useState("");
  const [altId, setAltId] = useState("");
  const [altEn, setAltEn] = useState("");
  const [rights, setRights] = useState("Foto milik KOOKA Residence");
  const [selectedUploadRoomTypeId, setSelectedUploadRoomTypeId] = useState("");
  const [selectedGalleryRoomTypeId, setSelectedGalleryRoomTypeId] =
    useState("");
  const [selectedGalleryAssetIds, setSelectedGalleryAssetIds] = useState<
    string[]
  >([]);
  const [deleteMediaTarget, setDeleteMediaTarget] = useState<JsonRecord | null>(
    null,
  );
  const [deleteMediaReason, setDeleteMediaReason] = useState("");
  const [nameId, setNameId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [categorySortDrafts, setCategorySortDrafts] = useState<
    Record<string, string>
  >({});
  const [itemSortDrafts, setItemSortDrafts] = useState<Record<string, string>>(
    {},
  );
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemNameId, setNewItemNameId] = useState("");
  const [newItemNameEn, setNewItemNameEn] = useState("");
  const [newItemDescriptionId, setNewItemDescriptionId] = useState("");
  const [newItemDescriptionEn, setNewItemDescriptionEn] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemTaxProfileId, setNewItemTaxProfileId] = useState("");
  const [newItemReason, setNewItemReason] = useState("Tambah item menu");
  const [newItemEffectiveFrom, setNewItemEffectiveFrom] = useState(today);
  const autoGeneratedCategoryCode = useMemo(() => {
    const nameSeed = (nameId || "KATEGORI")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .toUpperCase()
      .slice(0, 24);
    const matchingCodes = menuCatalog
      .map((category) => category.categoryCode)
      .filter((code) => code.startsWith(`${nameSeed}-`))
      .map((code) => Number(code.slice(nameSeed.length + 1)))
      .filter((value) => Number.isInteger(value) && value > 0);
    const nextSequence = Math.max(0, ...matchingCodes) + 1;
    return `${nameSeed}-${String(nextSequence).padStart(2, "0")}`;
  }, [menuCatalog, nameId]);
  const activeHeroVideo = assets.find((asset) => {
    if (
      String(asset.mediaType) !== "VIDEO" ||
      String(asset.status) !== "PUBLISHED"
    )
      return false;
    const usages = Array.isArray(asset.usages)
      ? (asset.usages as JsonRecord[])
      : [];
    return usages.some(
      (usage) => String(usage.usageType) === "LANDING_HERO_VIDEO",
    );
  });

  const landingSections = [
    {
      key: "experience" as const,
      usageType: "LANDING_EXPERIENCE_MEDIA",
      title: "The KOOKA feeling",
      description:
        "Tiga foto editorial di bagian suasana dan pengalaman KOOKA.",
    },
    {
      key: "gallery" as const,
      usageType: "LANDING_GALLERY_MEDIA",
      title: "Galeri landing page",
      description: "Tiga foto pada kolase galeri sebelum bagian lokasi.",
    },
  ];

  function landingSectionAssetIds(section: "experience" | "gallery") {
    const usageType =
      section === "experience"
        ? "LANDING_EXPERIENCE_MEDIA"
        : "LANDING_GALLERY_MEDIA";
    return assets
      .flatMap((asset) => {
        const usages = Array.isArray(asset.usages)
          ? (asset.usages as JsonRecord[])
          : [];
        return usages
          .filter((usage) => String(usage.usageType) === usageType)
          .map((usage) => ({
            assetId: String(asset.id),
            order: Number(usage.sortOrder ?? 0),
          }));
      })
      .sort((left, right) => left.order - right.order)
      .map((item) => item.assetId);
  }

  function landingSectionSelection(section: "experience" | "gallery") {
    return landingSectionDrafts[section] ?? landingSectionAssetIds(section);
  }

  function setLandingSectionSelection(
    section: "experience" | "gallery",
    assetIds: string[],
  ) {
    setLandingSectionDrafts((current) => ({
      ...current,
      [section]: assetIds,
    }));
  }

  function updateLandingMetadataDraft(
    assetId: string,
    field: "title" | "altId" | "altEn" | "captionId" | "captionEn",
    value: string,
  ) {
    setLandingMetadataDrafts((current) => ({
      ...current,
      [assetId]: { ...current[assetId], [field]: value },
    }));
  }

  function roomGalleryAssetIds(roomTypeId: string) {
    if (!roomTypeId) return [];
    return [
      ...new Set(
        assets
          .filter(
            (asset) =>
              String(asset.mediaType) === "IMAGE" &&
              String(asset.status) === "PUBLISHED" &&
              String(asset.scanStatus) === "CLEAN" &&
              Boolean(asset.authenticPropertyMedia),
          )
          .flatMap((asset) => {
            const usages = Array.isArray(asset.usages)
              ? (asset.usages as JsonRecord[])
              : [];
            return usages
              .filter(
                (usage) =>
                  String(usage.targetId) === roomTypeId &&
                  ["ROOM_TYPE_HERO", "ROOM_TYPE_GALLERY"].includes(
                    String(usage.usageType),
                  ),
              )
              .map((usage) => ({
                assetId: String(asset.id),
                order: Number(usage.sortOrder ?? 0),
              }));
          })
          .sort((left, right) => left.order - right.order)
          .map((item) => item.assetId),
      ),
    ];
  }

  function selectGalleryRoomType(roomTypeId: string) {
    setSelectedGalleryRoomTypeId(roomTypeId);
    setSelectedGalleryAssetIds(roomGalleryAssetIds(roomTypeId));
  }

  const [lifecycleRequest, setLifecycleRequest] = useState<{
    endpoint: string;
    body: JsonRecord;
  } | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const selectedMenuCategoryId =
    newItemCategoryId || menuCategoryOptions[0]?.value || "";
  const autoGeneratedMenuItemCode = useMemo(() => {
    const selectedCategory =
      menuCatalog.find(
        (category) => category.categoryId === selectedMenuCategoryId,
      ) ?? menuCatalog[0];
    const categoryCode = String(
      selectedCategory?.categoryCode ||
        selectedCategory?.categoryNameId ||
        "MENU",
    )
      .replace(/[^A-Z0-9]/giu, "")
      .slice(0, 8);
    const nameSeed = (newItemNameId || "ITEM")
      .replace(/[^a-zA-Z0-9]/gu, "-")
      .toUpperCase()
      .slice(0, 14);
    const dateSeed = new Date().toISOString().slice(2, 10).replaceAll("-", "");
    const candidatePrefix = `${categoryCode || "MENU"}-${nameSeed || "ITEM"}-${dateSeed}`;
    const existing = menuRows
      .map((item) => String(item.itemCode ?? ""))
      .filter((value) => value.startsWith(`${candidatePrefix}-`))
      .map((value) => Number(value.replace(`${candidatePrefix}-`, "")))
      .filter((value) => Number.isInteger(value) && value > 0)
      .sort((first, second) => first - second);
    const nextSeq = Number(existing.at(-1) ?? 0) + 1;
    const seqSeed = String(nextSeq).padStart(4, "0").slice(-4);
    return `${candidatePrefix}-${seqSeed}`;
  }, [menuRows, menuCatalog, selectedMenuCategoryId, newItemNameId]);
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!canManageMedia) {
      setNotice({
        tone: "error",
        message: "Akses upload media belum aktif untuk role ini.",
      });
      return;
    }
    if (!selectedUploadRoomTypeId) {
      setNotice({
        tone: "error",
        message: "Pilih jenis kamar tujuan sebelum mengunggah foto.",
      });
      return;
    }
    if (!canPublishMedia) {
      setNotice({
        tone: "error",
        message:
          "Akun ini belum memiliki izin publikasi media untuk menambahkan foto langsung ke kamar.",
      });
      return;
    }
    if (!files.length) {
      setNotice({ tone: "error", message: "Pilih minimal satu foto kamar." });
      return;
    }
    try {
      const uploadedAssetIds: string[] = [];
      for (const [index, file] of files.entries()) {
        const form = new FormData();
        form.set("file", file);
        form.set(
          "title",
          files.length > 1
            ? `${title.trim() || "Foto kamar"} ${index + 1}`
            : title,
        );
        form.set(
          "altId",
          files.length > 1 ? `${altId} - foto ${index + 1}` : altId,
        );
        form.set(
          "altEn",
          files.length > 1 ? `${altEn} - photo ${index + 1}` : altEn,
        );
        form.set("rightsSource", rights);
        form.set("authenticPropertyMedia", "true");
        const response = await fetch("/api/staff/admin/media", {
          method: "POST",
          body: form,
        });
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(messageFrom(result));
        const uploadResult = recordOf(result);
        if (String(uploadResult.scanStatus) !== "CLEAN") {
          throw new Error(
            `Foto ${file.name} belum lolos pemeriksaan file dan belum dapat dipublikasikan.`,
          );
        }
        const assetId = String(uploadResult.id ?? "");
        if (!assetId) throw new Error("ID foto hasil upload tidak ditemukan.");
        await post(
          "/api/staff/admin/media",
          {
            action: "PUBLISH",
            assetId,
            reason: "Foto kamar diunggah dan dipublikasikan oleh pengelola",
          },
          "PATCH",
        );
        uploadedAssetIds.push(assetId);
      }
      const existingAssetIds = roomGalleryAssetIds(selectedUploadRoomTypeId);
      const galleryAssetIds = [
        ...new Set([...existingAssetIds, ...uploadedAssetIds]),
      ];
      await post(
        "/api/staff/admin/media",
        {
          action: "SET_ROOM_GALLERY",
          roomTypeId: selectedUploadRoomTypeId,
          assetIds: galleryAssetIds,
        },
        "PATCH",
      );
      const roomTypeName = String(
        activeRoomTypes.find(
          (roomType) =>
            String(roomType.roomTypeId) === selectedUploadRoomTypeId,
        )?.nameId ?? "jenis kamar",
      );
      setNotice({
        tone: "success",
        message: `${files.length} foto berhasil ditambahkan ke ${roomTypeName}.`,
      });
      setSelectedGalleryRoomTypeId(selectedUploadRoomTypeId);
      setSelectedGalleryAssetIds(galleryAssetIds);
      setSelectedUploadRoomTypeId("");
      setFiles([]);
      setTitle("");
      setAltId("");
      setAltEn("");
      setRights("Foto milik KOOKA Residence");
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Upload gagal.",
      });
    }
  }

  async function uploadHeroVideo(event: React.FormEvent) {
    event.preventDefault();
    if (!canManageMedia || !canPublishMedia) {
      setNotice({
        tone: "error",
        message:
          "Akun ini belum memiliki izin untuk mengunggah dan mempublikasikan video.",
      });
      return;
    }
    if (!heroVideoFile) {
      setNotice({ tone: "error", message: "Pilih video hero MP4 dahulu." });
      return;
    }
    if (heroVideoFile.type !== "video/mp4") {
      setNotice({
        tone: "error",
        message: "Video hero harus menggunakan format MP4.",
      });
      return;
    }
    if (heroVideoFile.size > 24 * 1024 * 1024) {
      setNotice({
        tone: "error",
        message: "Ukuran video hero maksimal 24 MB.",
      });
      return;
    }
    try {
      const form = new FormData();
      form.set("file", heroVideoFile);
      form.set("title", heroVideoTitle.trim() || "Video hero landing page");
      form.set("altId", heroVideoAltId);
      form.set("altEn", heroVideoAltEn);
      form.set("rightsSource", "Video milik KOOKA Residence");
      form.set("authenticPropertyMedia", "true");
      const response = await fetch("/api/staff/admin/media", {
        method: "POST",
        body: form,
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(messageFrom(result));
      const uploadResult = recordOf(result);
      if (String(uploadResult.scanStatus) !== "CLEAN") {
        throw new Error(
          "Video belum lolos pemeriksaan file dan belum dapat dipublikasikan.",
        );
      }
      const assetId = String(uploadResult.id ?? "");
      if (!assetId) throw new Error("ID video hasil upload tidak ditemukan.");
      await post(
        "/api/staff/admin/media",
        {
          action: "PUBLISH",
          assetId,
          reason: "Video hero diunggah oleh pengelola",
        },
        "PATCH",
      );
      await post(
        "/api/staff/admin/media",
        { action: "SET_LANDING_HERO_VIDEO", assetId },
        "PATCH",
      );
      setHeroVideoFile(null);
      setHeroVideoTitle("");
      setNotice({
        tone: "success",
        message:
          "Video hero berhasil diunggah dan langsung digunakan di landing page.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Upload video gagal.",
      });
    }
  }

  async function uploadLandingImage(event: React.FormEvent) {
    event.preventDefault();
    if (!canManageMedia || !canPublishMedia) {
      setNotice({
        tone: "error",
        message:
          "Akun ini belum memiliki izin untuk mengunggah dan mempublikasikan foto.",
      });
      return;
    }
    if (!landingImageFile) {
      setNotice({ tone: "error", message: "Pilih foto terlebih dahulu." });
      return;
    }
    const currentAssetIds = landingSectionSelection(landingImageSection);
    if (currentAssetIds.length >= 3) {
      setNotice({
        tone: "error",
        message:
          "Bagian ini sudah memiliki 3 foto. Hapus salah satu foto dahulu.",
      });
      return;
    }
    try {
      const form = new FormData();
      form.set("file", landingImageFile);
      form.set("title", landingImageTitle.trim() || landingImageFile.name);
      form.set("altId", landingImageAltId);
      form.set("altEn", landingImageAltEn);
      form.set("captionId", landingImageCaptionId);
      form.set("captionEn", landingImageCaptionEn);
      form.set("rightsSource", "Foto milik KOOKA Residence");
      form.set("authenticPropertyMedia", "true");
      const response = await fetch("/api/staff/admin/media", {
        method: "POST",
        body: form,
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(messageFrom(result));
      const uploadResult = recordOf(result);
      const assetId = String(uploadResult.id ?? "");
      if (!assetId || String(uploadResult.scanStatus) !== "CLEAN") {
        throw new Error(
          "Foto belum lolos pemeriksaan dan belum dapat ditampilkan.",
        );
      }
      await post(
        "/api/staff/admin/media",
        {
          action: "PUBLISH",
          assetId,
          reason: "Foto bagian landing page diunggah oleh pengelola",
        },
        "PATCH",
      );
      const nextAssetIds = [...currentAssetIds, assetId];
      await post(
        "/api/staff/admin/media",
        {
          action: "SET_LANDING_SECTION_MEDIA",
          section: landingImageSection,
          assetIds: nextAssetIds,
        },
        "PATCH",
      );
      setLandingImageFile(null);
      setLandingImageTitle("");
      setLandingImageAltId("");
      setLandingImageAltEn("");
      setLandingImageCaptionId("");
      setLandingImageCaptionEn("");
      setLandingSectionDrafts((current) => {
        const next = { ...current };
        delete next[landingImageSection];
        return next;
      });
      setNotice({
        tone: "success",
        message:
          "Foto berhasil diunggah dan langsung digunakan pada landing page.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Upload foto gagal.",
      });
    }
  }

  function moveLandingSectionAsset(
    section: "experience" | "gallery",
    assetId: string,
    direction: -1 | 1,
  ) {
    const current = landingSectionSelection(section);
    const index = current.indexOf(assetId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setLandingSectionSelection(section, next);
  }

  function addExistingLandingAsset(section: "experience" | "gallery") {
    const assetId = landingExistingAssetDrafts[section];
    if (!assetId) return;
    const current = landingSectionSelection(section);
    if (current.includes(assetId)) return;
    if (current.length >= 3) {
      setNotice({
        tone: "error",
        message: "Maksimal 3 foto untuk setiap bagian landing page.",
      });
      return;
    }
    setLandingSectionSelection(section, [...current, assetId]);
    setLandingExistingAssetDrafts((drafts) => ({
      ...drafts,
      [section]: "",
    }));
  }

  async function saveLandingSection(section: "experience" | "gallery") {
    const assetIds = landingSectionSelection(section);
    try {
      for (const assetId of assetIds) {
        const asset = assets.find(
          (candidate) => String(candidate.id) === assetId,
        );
        const draft = landingMetadataDrafts[assetId];
        if (!asset || !draft) continue;
        await post(
          "/api/staff/admin/media",
          {
            action: "UPDATE_METADATA",
            assetId,
            title: draft.title ?? String(asset.title ?? ""),
            altId: draft.altId ?? String(asset.altId ?? ""),
            altEn: draft.altEn ?? String(asset.altEn ?? ""),
            captionId: draft.captionId ?? String(asset.captionId ?? ""),
            captionEn: draft.captionEn ?? String(asset.captionEn ?? ""),
          },
          "PATCH",
        );
      }
      await post(
        "/api/staff/admin/media",
        {
          action: "SET_LANDING_SECTION_MEDIA",
          section,
          assetIds,
        },
        "PATCH",
      );
      setLandingSectionDrafts((current) => {
        const next = { ...current };
        delete next[section];
        return next;
      });
      setLandingMetadataDrafts((current) => {
        const next = { ...current };
        for (const assetId of assetIds) delete next[assetId];
        return next;
      });
      setNotice({
        tone: "success",
        message:
          "Foto, urutan, dan keterangan bagian landing berhasil disimpan.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Pengaturan foto landing gagal disimpan.",
      });
    }
  }

  async function publishMedia(assetId: string) {
    try {
      await post(
        "/api/staff/admin/media",
        {
          action: "PUBLISH",
          assetId,
          reason: "Foto asli properti siap ditampilkan",
        },
        "PATCH",
      );
      setNotice({ tone: "success", message: "Foto berhasil dipublikasikan." });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Foto gagal dipublikasikan.",
      });
    }
  }

  async function deleteMedia() {
    if (!deleteMediaTarget) return;
    try {
      await post(
        "/api/staff/admin/media",
        {
          action: "DELETE",
          assetId: String(deleteMediaTarget.id),
          reason: deleteMediaReason,
        },
        "PATCH",
      );
      setDeleteMediaTarget(null);
      setDeleteMediaReason("");
      setNotice({
        tone: "success",
        message: "Media berhasil dihapus dari galeri tersimpan.",
      });
      await load();
    } catch (error) {
      setDeleteMediaTarget(null);
      setDeleteMediaReason("");
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Media gagal dihapus.",
      });
    }
  }

  async function saveRoomGallery() {
    if (!selectedGalleryRoomTypeId || !selectedGalleryAssetIds.length) {
      setNotice({
        tone: "error",
        message: "Pilih jenis kamar dan minimal satu foto.",
      });
      return;
    }
    try {
      await post(
        "/api/staff/admin/media",
        {
          action: "SET_ROOM_GALLERY",
          roomTypeId: selectedGalleryRoomTypeId,
          assetIds: selectedGalleryAssetIds,
        },
        "PATCH",
      );
      setNotice({
        tone: "success",
        message:
          "Galeri kamar tersimpan. Foto pertama menjadi foto utama kamar.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Galeri gagal disimpan.",
      });
    }
  }

  function moveGalleryAsset(assetId: string, direction: -1 | 1) {
    setSelectedGalleryAssetIds((current) => {
      const index = current.indexOf(assetId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function createMenuItem(event: React.FormEvent) {
    event.preventDefault();
    if (!canManageMenu) {
      setNotice({
        tone: "error",
        message: "Akses tambah item menu belum aktif untuk role ini.",
      });
      return;
    }
    const priceIdr = Number(newItemPrice.replace(/\D/gu, ""));
    if (!selectedMenuCategoryId) {
      setNotice({
        tone: "error",
        message: "Silakan pilih kategori menu terlebih dahulu.",
      });
      return;
    }
    const resolvedItemCode = autoGeneratedMenuItemCode;
    if (!resolvedItemCode.trim()) {
      setNotice({
        tone: "error",
        message:
          "Kode item tidak dapat dibuat, silakan isi nama item terlebih dahulu.",
      });
      return;
    }
    if (!Number.isInteger(priceIdr) || priceIdr < 0) {
      setNotice({
        tone: "error",
        message: "Harga harus berupa angka nominal IDR yang valid.",
      });
      return;
    }
    try {
      await post("/api/staff/admin/menu", {
        action: "CREATE_ITEM_VERSION",
        categoryId: selectedMenuCategoryId,
        itemCode: resolvedItemCode,
        nameId: newItemNameId,
        nameEn: newItemNameEn,
        descriptionId: newItemDescriptionId.trim() || undefined,
        descriptionEn: newItemDescriptionEn.trim() || undefined,
        priceIdr,
        taxProfileVersionId: newItemTaxProfileId.trim() || undefined,
        effectiveFrom: newItemEffectiveFrom,
        reason: newItemReason.trim() || "Tambah item menu",
      });
      setNotice({
        tone: "success",
        message:
          "Item menu berhasil dibuat. Aktifkan item agar dapat digunakan.",
      });
      setNewItemNameId("");
      setNewItemNameEn("");
      setNewItemDescriptionId("");
      setNewItemDescriptionEn("");
      setNewItemPrice("");
      setNewItemTaxProfileId("");
      setNewItemReason("Tambah item menu");
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Item menu tidak dapat dibuat.",
      });
    }
  }
  async function activateMenuItemVersion(versionId: string) {
    try {
      await post("/api/staff/admin/menu", {
        action: "ACTIVATE_ITEM_VERSION",
        versionId,
        reason: "Aktifkan versi menu",
      });
      setNotice({
        tone: "success",
        message: "Versi menu berhasil diaktifkan.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Status menu tidak dapat diaktifkan.",
      });
    }
  }
  async function toggleMenuItemAvailability(
    itemId: string,
    available: boolean,
  ) {
    try {
      await post("/api/staff/admin/menu", {
        action: "SET_AVAILABILITY",
        menuItemId: itemId,
        available,
        reason: `Perubahan ketersediaan menu ${itemId}`,
      });
      setNotice({
        tone: "success",
        message: "Ketersediaan menu berhasil diperbarui.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Status ketersediaan menu tidak dapat diubah.",
      });
    }
  }
  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!canManageMenu) {
      setNotice({
        tone: "error",
        message: "Akses tambah kategori belum aktif untuk role ini.",
      });
      return;
    }
    try {
      await post("/api/staff/admin/menu", {
        action: "CREATE_CATEGORY",
        categoryCode: autoGeneratedCategoryCode,
        nameId,
        nameEn,
        sortOrder: Number(sortOrder),
      });
      setNotice({
        tone: "success",
        message: "Kategori menu F&B berhasil dibuat.",
      });
      setNameId("");
      setNameEn("");
      setSortOrder("0");
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Kategori gagal dibuat.",
      });
    }
  }
  async function updateCategorySortOrder(
    categoryId: string,
    defaultValue: number,
  ) {
    if (!canManageMenu) return;
    const order = Number(
      categorySortDrafts[categoryId] ?? String(defaultValue ?? 0),
    );
    if (!Number.isInteger(order) || order < 0) {
      setNotice({
        tone: "error",
        message: "Urutan kategori harus angka bulat 0 atau lebih.",
      });
      return;
    }
    try {
      await post("/api/staff/admin/menu", {
        action: "SET_CATEGORY_SORT_ORDER",
        categoryId,
        sortOrder: order,
        reason: "Atur urutan kategori menu",
      });
      setNotice({
        tone: "success",
        message: "Urutan kategori berhasil disimpan.",
      });
      setCategorySortDrafts((current) => {
        const update = { ...current };
        delete update[categoryId];
        return update;
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan urutan kategori.",
      });
    }
  }
  async function updateItemSortOrder(itemId: string, defaultValue: number) {
    if (!canManageMenu) return;
    const order = Number(itemSortDrafts[itemId] ?? String(defaultValue ?? 0));
    if (!Number.isInteger(order) || order < 0) {
      setNotice({
        tone: "error",
        message: "Urutan item harus angka bulat 0 atau lebih.",
      });
      return;
    }
    try {
      await post("/api/staff/admin/menu", {
        action: "SET_ITEM_SORT_ORDER",
        itemId,
        sortOrder: order,
        reason: "Atur urutan item menu",
      });
      setNotice({
        tone: "success",
        message: "Urutan item menu berhasil disimpan.",
      });
      setItemSortDrafts((current) => {
        const update = { ...current };
        delete update[itemId];
        return update;
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan urutan item menu.",
      });
    }
  }
  async function lifecycle() {
    if (!lifecycleRequest || lifecycleReason.trim().length < 3) return;
    try {
      await post(lifecycleRequest.endpoint, {
        ...lifecycleRequest.body,
        reason: lifecycleReason.trim(),
      });
      setLifecycleRequest(null);
      setLifecycleReason("");
      setNotice({
        tone: "success",
        message: "Status konten berhasil diperbarui.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Tindakan gagal.",
      });
    }
  }
  return (
    <div className={styles.contentAdminLayout}>
      <div className={styles.contentAdminPrimaryGrid}>
        <div className={styles.contentAdminColumn}>
          <section className={`${styles.formCard} ${styles.roomUploadCard}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Video hero landing page</h2>
                <p className={styles.formHint}>
                  Unggah video utama yang tampil di bagian paling atas website.
                  Video baru otomatis menggantikan video aktif.
                </p>
              </div>
              <span className={styles.countPill}>
                {activeHeroVideo ? "Aktif" : "Belum diatur"}
              </span>
            </div>
            <form className={styles.staffForm} onSubmit={uploadHeroVideo}>
              {activeHeroVideo ? (
                <div className={styles.heroVideoAdminPreview}>
                  <video
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    src={`/api/content/media/${String(activeHeroVideo.id)}`}
                  />
                  <div>
                    <strong>
                      {String(activeHeroVideo.title || "Video hero aktif")}
                    </strong>
                    <small>
                      {String(activeHeroVideo.mimeType || "video/mp4")} ·{" "}
                      {Math.max(
                        1,
                        Math.round(
                          Number(activeHeroVideo.byteSize ?? 0) / 1024,
                        ),
                      ).toLocaleString("id-ID")}{" "}
                      KB
                    </small>
                  </div>
                </div>
              ) : (
                <p className={styles.emptyCompact}>
                  Belum ada video hero aktif. Foto hero tetap digunakan sebagai
                  tampilan cadangan.
                </p>
              )}
              <FileField
                accept="video/mp4,.mp4"
                file={heroVideoFile}
                helper="MP4 maksimal 24 MB · H.264/AAC disarankan"
                label={activeHeroVideo ? "Ganti video hero" : "Video hero MP4"}
                onChange={setHeroVideoFile}
              />
              <label>
                Judul video
                <input
                  placeholder="Contoh: Suasana pagi KOOKA Residence"
                  value={heroVideoTitle}
                  onChange={(event) => setHeroVideoTitle(event.target.value)}
                />
              </label>
              <div className={styles.formGrid}>
                <label>
                  Deskripsi aksesibilitas Indonesia
                  <input
                    required
                    value={heroVideoAltId}
                    onChange={(event) => setHeroVideoAltId(event.target.value)}
                  />
                </label>
                <label>
                  Deskripsi aksesibilitas English
                  <input
                    required
                    value={heroVideoAltEn}
                    onChange={(event) => setHeroVideoAltEn(event.target.value)}
                  />
                </label>
              </div>
              <button
                className={styles.primaryButton}
                disabled={!canManageMedia || !canPublishMedia || !heroVideoFile}
                type="submit"
              >
                {activeHeroVideo
                  ? "Upload & ganti video hero"
                  : "Upload & gunakan video hero"}
              </button>
            </form>
          </section>
          <section
            className={`${styles.panel} ${styles.landingSectionMediaPanel}`}
          >
            <div className={styles.panelHeader}>
              <div>
                <h2>Foto bagian landing page</h2>
                <p className={styles.formHint}>
                  Kelola foto dan keterangan yang tampil pada bagian “The KOOKA
                  feeling” dan kolase galeri.
                </p>
              </div>
              <span className={styles.countPill}>Maks. 3 per bagian</span>
            </div>
            <form
              className={`${styles.staffForm} ${styles.landingImageUploadForm}`}
              onSubmit={uploadLandingImage}
            >
              <div className={styles.formGrid}>
                <label>
                  Tampilkan foto di
                  <KookaSelect
                    ariaLabel="Bagian landing page"
                    onChange={(value) =>
                      setLandingImageSection(
                        value === "gallery" ? "gallery" : "experience",
                      )
                    }
                    options={landingSections.map((section) => ({
                      value: section.key,
                      label: section.title,
                      description: section.description,
                    }))}
                    value={landingImageSection}
                  />
                </label>
                <FileField
                  accept="image/jpeg,image/png"
                  file={landingImageFile}
                  helper="JPEG atau PNG · unggah satu foto agar keterangannya tepat"
                  label="Pilih foto"
                  onChange={setLandingImageFile}
                />
              </div>
              <label>
                Judul internal
                <input
                  placeholder="Contoh: Halaman tengah KOOKA"
                  value={landingImageTitle}
                  onChange={(event) => setLandingImageTitle(event.target.value)}
                />
              </label>
              <div className={styles.formGrid}>
                <label>
                  Keterangan foto Indonesia
                  <input
                    placeholder="Contoh: Halaman hijau"
                    required
                    value={landingImageCaptionId}
                    onChange={(event) =>
                      setLandingImageCaptionId(event.target.value)
                    }
                  />
                </label>
                <label>
                  Photo label English
                  <input
                    placeholder="Example: Leafy courtyard"
                    required
                    value={landingImageCaptionEn}
                    onChange={(event) =>
                      setLandingImageCaptionEn(event.target.value)
                    }
                  />
                </label>
                <label>
                  Deskripsi aksesibilitas Indonesia
                  <input
                    placeholder="Jelaskan isi foto secara singkat"
                    required
                    value={landingImageAltId}
                    onChange={(event) =>
                      setLandingImageAltId(event.target.value)
                    }
                  />
                </label>
                <label>
                  Accessibility description English
                  <input
                    placeholder="Briefly describe the image"
                    required
                    value={landingImageAltEn}
                    onChange={(event) =>
                      setLandingImageAltEn(event.target.value)
                    }
                  />
                </label>
              </div>
              <button
                className={styles.primaryButton}
                disabled={
                  !canManageMedia || !canPublishMedia || !landingImageFile
                }
                type="submit"
              >
                Upload & tampilkan foto
              </button>
            </form>

            <div className={styles.landingSectionEditors}>
              {landingSections.map((section) => {
                const selectedAssetIds = landingSectionSelection(section.key);
                const availableAssets = assets.filter(
                  (asset) =>
                    String(asset.mediaType) === "IMAGE" &&
                    String(asset.status) === "PUBLISHED" &&
                    String(asset.scanStatus) === "CLEAN" &&
                    Boolean(asset.authenticPropertyMedia) &&
                    !selectedAssetIds.includes(String(asset.id)),
                );
                return (
                  <article
                    className={styles.landingSectionEditor}
                    key={section.key}
                  >
                    <div className={styles.panelHeader}>
                      <div>
                        <h3>{section.title}</h3>
                        <p className={styles.formHint}>{section.description}</p>
                      </div>
                      <span className={styles.countPill}>
                        {selectedAssetIds.length}/3 foto
                      </span>
                    </div>
                    {selectedAssetIds.length ? (
                      <div className={styles.landingSelectedMediaList}>
                        {selectedAssetIds.map((assetId, index) => {
                          const asset = assets.find(
                            (candidate) => String(candidate.id) === assetId,
                          );
                          if (!asset) return null;
                          const draft = landingMetadataDrafts[assetId] ?? {};
                          return (
                            <div
                              className={styles.landingSelectedMediaItem}
                              key={assetId}
                            >
                              <div className={styles.landingSelectedMediaTop}>
                                <Image
                                  alt={String(
                                    asset.altId ?? asset.title ?? "Foto KOOKA",
                                  )}
                                  height={90}
                                  src={`/api/content/media/${assetId}`}
                                  unoptimized
                                  width={135}
                                />
                                <div>
                                  <strong>
                                    {index + 1}. {String(asset.title || "Foto")}
                                  </strong>
                                  <span className={styles.inlineActions}>
                                    <button
                                      aria-label="Naikkan urutan foto"
                                      className={`${styles.textButton} ${styles.landingMediaOrderButton}`}
                                      disabled={index === 0}
                                      onClick={() =>
                                        moveLandingSectionAsset(
                                          section.key,
                                          assetId,
                                          -1,
                                        )
                                      }
                                      type="button"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      aria-label="Turunkan urutan foto"
                                      className={`${styles.textButton} ${styles.landingMediaOrderButton}`}
                                      disabled={
                                        index === selectedAssetIds.length - 1
                                      }
                                      onClick={() =>
                                        moveLandingSectionAsset(
                                          section.key,
                                          assetId,
                                          1,
                                        )
                                      }
                                      type="button"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      className={`${styles.textButton} ${styles.landingMediaRemoveButton}`}
                                      onClick={() =>
                                        setLandingSectionSelection(
                                          section.key,
                                          selectedAssetIds.filter(
                                            (id) => id !== assetId,
                                          ),
                                        )
                                      }
                                      type="button"
                                    >
                                      Hapus
                                    </button>
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`${styles.formGrid} ${styles.landingMetadataGrid}`}
                              >
                                <label>
                                  Keterangan Indonesia
                                  <input
                                    value={
                                      draft.captionId ??
                                      String(asset.captionId ?? "")
                                    }
                                    onChange={(event) =>
                                      updateLandingMetadataDraft(
                                        assetId,
                                        "captionId",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  Keterangan English
                                  <input
                                    value={
                                      draft.captionEn ??
                                      String(asset.captionEn ?? "")
                                    }
                                    onChange={(event) =>
                                      updateLandingMetadataDraft(
                                        assetId,
                                        "captionEn",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  Alt text Indonesia
                                  <input
                                    required
                                    value={
                                      draft.altId ?? String(asset.altId ?? "")
                                    }
                                    onChange={(event) =>
                                      updateLandingMetadataDraft(
                                        assetId,
                                        "altId",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  Alt text English
                                  <input
                                    required
                                    value={
                                      draft.altEn ?? String(asset.altEn ?? "")
                                    }
                                    onChange={(event) =>
                                      updateLandingMetadataDraft(
                                        assetId,
                                        "altEn",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={styles.emptyCompact}>
                        Belum diatur melalui CMS. Landing page masih memakai
                        foto bawaan.
                      </p>
                    )}
                    {selectedAssetIds.length < 3 && availableAssets.length ? (
                      <div className={styles.landingExistingMediaPicker}>
                        <KookaSelect
                          ariaLabel={`Tambah foto ke ${section.title}`}
                          emptyMessage="Tidak ada foto lain"
                          onChange={(value) =>
                            setLandingExistingAssetDrafts((current) => ({
                              ...current,
                              [section.key]: value,
                            }))
                          }
                          options={availableAssets.map((asset) => ({
                            value: String(asset.id),
                            label: String(asset.title || "Foto tanpa judul"),
                            description: String(
                              asset.captionId || asset.altId || "",
                            ),
                          }))}
                          placeholder="Pilih dari galeri tersimpan"
                          value={landingExistingAssetDrafts[section.key] ?? ""}
                        />
                        <button
                          className={styles.secondaryButton}
                          disabled={!landingExistingAssetDrafts[section.key]}
                          onClick={() => addExistingLandingAsset(section.key)}
                          type="button"
                        >
                          Tambahkan
                        </button>
                      </div>
                    ) : null}
                    <button
                      className={styles.primaryButton}
                      disabled={!canManageMedia}
                      onClick={() => void saveLandingSection(section.key)}
                      type="button"
                    >
                      Simpan foto & keterangan
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
          <section className={`${styles.formCard} ${styles.roomUploadCard}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Tambah foto kamar</h2>
                <p className={styles.formHint}>
                  Pilih jenis kamar dan beberapa foto. Sistem langsung
                  menambahkannya ke galeri kamar.
                </p>
              </div>
              {!canManageMedia ? (
                <span className={styles.countPill}>Hanya lihat</span>
              ) : null}
            </div>
            {!canManageMedia ? (
              <p className={styles.formHint}>
                Upload media memerlukan izin pengelola konten.
              </p>
            ) : null}
            <form className={styles.staffForm} onSubmit={upload}>
              <div className={styles.roomGallerySelect}>
                <span>Tambahkan foto ke jenis kamar</span>
                <KookaSelect
                  ariaLabel="Jenis kamar tujuan upload"
                  emptyMessage="Belum ada jenis kamar aktif"
                  onChange={setSelectedUploadRoomTypeId}
                  options={activeRoomTypes.map((roomType) => ({
                    value: String(roomType.roomTypeId),
                    label: String(roomType.nameId ?? roomType.code),
                  }))}
                  placeholder="Pilih jenis kamar"
                  value={selectedUploadRoomTypeId}
                />
                <small className={styles.formHint}>
                  Pilih kategori kamar, bukan nomor kamar fisik.
                </small>
              </div>
              <MultiFileField
                accept="image/jpeg,image/png"
                files={files}
                helper="JPEG atau PNG · pilih hingga 20 foto asli properti"
                label="Foto JPEG / PNG"
                onChange={setFiles}
              />
              <label>
                Judul
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <div className={styles.formGrid}>
                <label>
                  Alt text Indonesia
                  <input
                    required
                    value={altId}
                    onChange={(event) => setAltId(event.target.value)}
                  />
                </label>
                <label>
                  Alt text English
                  <input
                    required
                    value={altEn}
                    onChange={(event) => setAltEn(event.target.value)}
                  />
                </label>
              </div>
              <div className={styles.roomGallerySelect}>
                <span>Kepemilikan foto</span>
                <KookaSelect
                  ariaLabel="Kepemilikan foto"
                  onChange={setRights}
                  options={[
                    {
                      value: "Foto milik KOOKA Residence",
                      label: "Milik KOOKA Residence",
                      description: "Foto diambil atau dimiliki oleh KOOKA.",
                    },
                    {
                      value: "Foto mitra dengan izin penggunaan",
                      label: "Foto mitra dengan izin",
                      description:
                        "Fotografer atau mitra mengizinkan KOOKA memakai foto.",
                    },
                  ]}
                  value={rights}
                />
                <small className={styles.formHint}>
                  Catatan internal untuk memastikan foto boleh ditampilkan di
                  website.
                </small>
              </div>
              <button
                className={styles.primaryButton}
                disabled={
                  !canManageMedia ||
                  !canPublishMedia ||
                  !selectedUploadRoomTypeId ||
                  !files.length
                }
                type="submit"
              >
                {files.length > 1
                  ? `Upload & tambahkan ${files.length} foto`
                  : "Upload & tambahkan foto"}
              </button>
            </form>
          </section>
          <section className={`${styles.panel} ${styles.roomGalleryPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Galeri foto kamar</h2>
                <p className={styles.formHint}>
                  Gunakan bagian ini untuk mengubah pilihan atau urutan foto.
                  Foto urutan pertama menjadi foto utama di landing page.
                </p>
              </div>
              <span className={styles.countPill}>
                {selectedGalleryAssetIds.length} dipilih
              </span>
            </div>
            <div className={styles.roomGalleryBody}>
              <div className={styles.roomGallerySelect}>
                <span>Jenis kamar</span>
                <KookaSelect
                  ariaLabel="Jenis kamar untuk galeri"
                  emptyMessage="Belum ada jenis kamar aktif"
                  onChange={selectGalleryRoomType}
                  options={activeRoomTypes.map((roomType) => ({
                    value: String(roomType.roomTypeId),
                    label: String(roomType.nameId ?? roomType.code),
                  }))}
                  placeholder="Pilih jenis kamar"
                  value={selectedGalleryRoomTypeId}
                />
              </div>
              {selectedGalleryRoomTypeId ? (
                <>
                  <div className={styles.roomGalleryPicker}>
                    {assets
                      .filter(
                        (asset) =>
                          String(asset.mediaType) === "IMAGE" &&
                          String(asset.status) === "PUBLISHED" &&
                          String(asset.scanStatus) === "CLEAN" &&
                          Boolean(asset.authenticPropertyMedia),
                      )
                      .map((asset) => {
                        const assetId = String(asset.id);
                        const checked =
                          selectedGalleryAssetIds.includes(assetId);
                        return (
                          <label
                            className={`${styles.roomGalleryAsset} ${checked ? styles.roomGalleryAssetSelected : ""}`}
                            key={assetId}
                          >
                            <Image
                              alt={String(
                                asset.altId ?? asset.title ?? "Foto kamar",
                              )}
                              height={100}
                              src={`/api/content/media/${assetId}`}
                              unoptimized
                              width={150}
                            />
                            <span>
                              <input
                                checked={checked}
                                onChange={(event) =>
                                  setSelectedGalleryAssetIds((current) =>
                                    event.target.checked
                                      ? [...current, assetId]
                                      : current.filter((id) => id !== assetId),
                                  )
                                }
                                type="checkbox"
                              />
                              {String(asset.title || "Foto kamar")}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                  {!assets.some(
                    (asset) =>
                      String(asset.mediaType) === "IMAGE" &&
                      String(asset.status) === "PUBLISHED" &&
                      String(asset.scanStatus) === "CLEAN" &&
                      Boolean(asset.authenticPropertyMedia),
                  ) ? (
                    <p className={styles.emptyCompact}>
                      Belum ada foto yang siap digunakan. Publikasikan foto di
                      daftar media terlebih dahulu.
                    </p>
                  ) : null}
                  {selectedGalleryAssetIds.length ? (
                    <div className={styles.roomGalleryOrder}>
                      <strong>Urutan galeri</strong>
                      {selectedGalleryAssetIds.map((assetId, index) => {
                        const asset = assets.find(
                          (candidate) => String(candidate.id) === assetId,
                        );
                        return (
                          <div key={assetId}>
                            <span>
                              {index + 1}.{" "}
                              {String(asset?.title || "Foto kamar")}
                              {index === 0 ? " · foto utama" : ""}
                            </span>
                            <span className={styles.inlineActions}>
                              <button
                                aria-label="Naikkan urutan foto"
                                className={styles.textButton}
                                disabled={index === 0}
                                onClick={() => moveGalleryAsset(assetId, -1)}
                                type="button"
                              >
                                ↑
                              </button>
                              <button
                                aria-label="Turunkan urutan foto"
                                className={styles.textButton}
                                disabled={
                                  index === selectedGalleryAssetIds.length - 1
                                }
                                onClick={() => moveGalleryAsset(assetId, 1)}
                                type="button"
                              >
                                ↓
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <button
                    className={styles.primaryButton}
                    disabled={
                      !canManageMedia || !selectedGalleryAssetIds.length
                    }
                    onClick={() => void saveRoomGallery()}
                    type="button"
                  >
                    Simpan galeri kamar
                  </button>
                </>
              ) : (
                <p className={styles.emptyCompact}>
                  Pilih jenis kamar untuk melihat dan mengatur fotonya.
                </p>
              )}
            </div>
          </section>
          <section className={`${styles.panel} ${styles.menuCatalogPanel}`}>
            <div className={styles.panelHeader}>
              <h2>Galeri tersimpan</h2>
              <span className={styles.countPill}>{assets.length} media</span>
            </div>
            {!canManageMedia ? (
              <p className={styles.emptyCompact}>
                Akses galeri media tidak aktif untuk akun ini. Hubungi Owner
                bila Anda perlu mengelola foto.
              </p>
            ) : null}
            {assets.length ? (
              <div className={styles.masterList}>
                {assets.map((asset) => {
                  const usageCount = Array.isArray(asset.usages)
                    ? asset.usages.length
                    : 0;
                  return (
                    <article key={`${String(asset.id)}`}>
                      <div>
                        <strong>
                          {String(asset.title || "Media tanpa judul")}
                        </strong>
                        <small>
                          {String(asset.mediaType || "MEDIA")} · status:{" "}
                          {String(asset.status || "DRAFT")} · scan:{" "}
                          {String(asset.scanStatus || "UNKNOWN")}
                        </small>
                        <small>
                          {Boolean(asset.authenticPropertyMedia)
                            ? "Media milik properti"
                            : "Media non-properti"}
                        </small>
                      </div>
                      <div className={styles.inlineActions}>
                        <span className={styles.statusPill}>
                          {String(asset.mimeType || "N/A")}
                        </span>
                        {usageCount > 0 ? (
                          <span className={styles.statusPill}>
                            Dipakai {usageCount} bagian
                          </span>
                        ) : null}
                        {String(asset.status) === "DRAFT" ? (
                          <button
                            className={styles.secondaryButton}
                            disabled={!canPublishMedia}
                            onClick={() => void publishMedia(String(asset.id))}
                            type="button"
                          >
                            {String(asset.scanStatus) === "PENDING"
                              ? "Periksa & publikasikan"
                              : "Publikasikan"}
                          </button>
                        ) : null}
                        <button
                          className={styles.dangerButton}
                          disabled={!canPublishMedia || usageCount > 0}
                          onClick={() => setDeleteMediaTarget(asset)}
                          title={
                            usageCount > 0
                              ? "Lepaskan media dari hero, landing page, atau galeri kamar terlebih dahulu."
                              : "Hapus media"
                          }
                          type="button"
                        >
                          Hapus
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className={styles.emptyCompact}>
                Belum ada media tersimpan. Upload foto atau video melalui
                formulir di atas.
              </p>
            )}
          </section>
        </div>
        <div className={styles.contentAdminColumn}>
          <section className={styles.formCard}>
            <div className={styles.panelHeader}>
              <h2>Kategori menu</h2>
              {!canManageMenu ? (
                <span className={styles.countPill}>Hanya lihat</span>
              ) : null}
            </div>
            {!canManageMenu ? (
              <p className={styles.formHint}>
                Menambah kategori menu memerlukan role komersial manajemen.
              </p>
            ) : null}
            <form className={styles.staffForm} onSubmit={createCategory}>
              <div className={styles.formGrid}>
                <label>
                  Urutan tampilan
                  <input
                    min="0"
                    type="number"
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                  />
                </label>
                <label>
                  Nama Indonesia
                  <input
                    required
                    value={nameId}
                    onChange={(event) => setNameId(event.target.value)}
                  />
                </label>
                <label>
                  Nama English
                  <input
                    required
                    value={nameEn}
                    onChange={(event) => setNameEn(event.target.value)}
                  />
                </label>
              </div>
              <p className={styles.formHint}>
                Kode kategori dibuat otomatis oleh sistem.
              </p>
              <button
                className={styles.primaryButton}
                disabled={!canManageMenu}
                type="submit"
              >
                Tambah kategori
              </button>
            </form>
          </section>
          <section className={styles.formCard}>
            <div className={styles.panelHeader}>
              <h2>Tambah menu F&B</h2>
              <span className={styles.countPill}>
                {menuCategoryOptions.length} kategori
              </span>
            </div>
            {!canManageMenu ? (
              <p className={styles.formHint}>
                Menambah item menu memerlukan role komersial manajemen.
              </p>
            ) : null}
            <form className={styles.staffForm} onSubmit={createMenuItem}>
              <label>
                Kategori
                <KookaSelect
                  ariaLabel="Kategori menu"
                  disabled={!canManageMenu}
                  emptyMessage="Belum ada kategori menu"
                  onChange={setNewItemCategoryId}
                  options={menuCategoryOptions}
                  value={selectedMenuCategoryId}
                />
              </label>
              <div className={styles.formGrid}>
                <label>
                  Nama Indonesia
                  <input
                    required
                    value={newItemNameId}
                    onChange={(event) => setNewItemNameId(event.target.value)}
                  />
                </label>
                <label>
                  Nama English
                  <input
                    required
                    value={newItemNameEn}
                    onChange={(event) => setNewItemNameEn(event.target.value)}
                  />
                </label>
                <label>
                  Harga (IDR)
                  <MoneyInput
                    ariaLabel="Harga menu"
                    onChange={setNewItemPrice}
                    required
                    value={newItemPrice}
                  />
                </label>
              </div>
              <p className={styles.formHint}>
                Kode menu dibuat otomatis setelah item disimpan.
              </p>
              <label>
                Deskripsi Indonesia
                <textarea
                  rows={2}
                  value={newItemDescriptionId}
                  onChange={(event) =>
                    setNewItemDescriptionId(event.target.value)
                  }
                />
              </label>
              <label>
                Deskripsi English
                <textarea
                  rows={2}
                  value={newItemDescriptionEn}
                  onChange={(event) =>
                    setNewItemDescriptionEn(event.target.value)
                  }
                />
              </label>
              <label>
                Pajak menu (opsional)
                <KookaSelect
                  ariaLabel="Pajak menu"
                  onChange={setNewItemTaxProfileId}
                  options={[
                    { value: "", label: "Tanpa pajak" },
                    ...activeFnbTaxes.map((tax) => ({
                      value: String(tax.versionId),
                      label: String(tax.name ?? "Pajak F&B"),
                      description: tax.noTax
                        ? "Tanpa pajak"
                        : `Pajak ${percent(tax.taxRate)} · layanan ${percent(tax.serviceChargeRate)}`,
                    })),
                  ]}
                  value={newItemTaxProfileId}
                />
              </label>
              <div className={styles.formGrid}>
                <label>
                  Berlaku mulai
                  <DateField
                    ariaLabel="Berlaku mulai"
                    onChange={setNewItemEffectiveFrom}
                    value={newItemEffectiveFrom}
                  />
                </label>
              </div>
              <label>
                Catatan perubahan (opsional)
                <textarea
                  rows={2}
                  value={newItemReason}
                  onChange={(event) => setNewItemReason(event.target.value)}
                />
              </label>
              <button
                className={styles.primaryButton}
                disabled={!canManageMenu}
                type="submit"
              >
                Tambah item menu
              </button>
            </form>
          </section>
        </div>
      </div>
      <section
        className={`${styles.panel} ${styles.menuCatalogPanel} ${styles.contentLandingPanel}`}
      >
        <div className={styles.panelHeader}>
          <h2>Halaman landing</h2>
          <span className={styles.countPill}>{pages.length} versi</span>
        </div>
        {pages.length ? (
          <div className={styles.masterList}>
            {pages.map((page) => (
              <article key={`${String(page.pageId)}-${String(page.versionId)}`}>
                <div>
                  <strong>{String(page.routeKey)}</strong>
                  <small>Versi {String(page.versionNumber ?? "—")}</small>
                </div>
                <span className={styles.statusPill}>
                  {human(String(page.lifecycleStatus ?? page.pageStatus))}
                </span>
                <div className={styles.inlineActions}>
                  {page.lifecycleStatus === "DRAFT" ? (
                    <button
                      className={styles.textButton}
                      onClick={() => {
                        setLifecycleReason("");
                        setLifecycleRequest({
                          endpoint: "/api/staff/admin/content",
                          body: {
                            action: "SUBMIT_REVIEW",
                            versionId: page.versionId,
                          },
                        });
                      }}
                    >
                      Ajukan pemeriksaan
                    </button>
                  ) : null}
                  {page.versionId ? (
                    <button
                      className={styles.textButton}
                      onClick={() => {
                        setLifecycleReason("");
                        setLifecycleRequest({
                          endpoint: "/api/staff/admin/content",
                          body: {
                            action: "PUBLISH",
                            versionId: page.versionId,
                          },
                        });
                      }}
                    >
                      Tampilkan di website
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyCompact}>
            Belum ada versi halaman landing yang dikelola melalui CMS.
          </p>
        )}
      </section>
      <section
        className={`${styles.panel} ${styles.menuCatalogPanel} ${styles.contentCatalogPanel}`}
      >
        <div className={styles.panelHeader}>
          <h2>Katalog menu</h2>
          <span className={styles.countPill}>
            {menuCatalog.length} kategori ·{" "}
            {menuCatalog.reduce(
              (total, category) => total + category.items.length,
              0,
            )}{" "}
            item
          </span>
        </div>
        {!canManageMenu ? (
          <p className={styles.emptyCompact}>
            Anda tidak memiliki hak ubah menu (commercial.manage), jadi mode
            lihat saja.
          </p>
        ) : null}
        <div className={styles.menuCatalogGroups}>
          {menuCatalog.length ? (
            menuCatalog.map((category) => (
              <section
                className={styles.menuCategoryCard}
                key={category.categoryId}
              >
                <div className={styles.menuCategoryHeader}>
                  <div>
                    <h3>
                      {category.categoryNameId ||
                        category.categoryNameEn ||
                        category.categoryCode}
                    </h3>
                    <small>
                      Urutan {String(category.categorySortOrder ?? 0)}
                    </small>
                  </div>
                  <div className={styles.menuCategoryMeta}>
                    <span className={styles.statusPill}>
                      {String(category.categoryStatus)}
                    </span>
                    <span className={styles.countPill}>
                      {category.items.length} item
                    </span>
                    {canManageMenu ? (
                      <label className={styles.menuOrderControl}>
                        Urutan:
                        <input
                          min="0"
                          type="number"
                          value={
                            categorySortDrafts[category.categoryId] ??
                            String(category.categorySortOrder ?? 0)
                          }
                          onChange={(event) =>
                            setCategorySortDrafts((current) => ({
                              ...current,
                              [category.categoryId]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : null}
                    {canManageMenu ? (
                      <button
                        className={styles.secondaryButton}
                        onClick={() =>
                          void updateCategorySortOrder(
                            category.categoryId,
                            category.categorySortOrder,
                          )
                        }
                        type="button"
                      >
                        Simpan urutan
                      </button>
                    ) : null}
                  </div>
                </div>
                {category.items.length ? (
                  <div className={styles.menuItemList}>
                    {category.items.map((item) => {
                      const latest = item.latestVersion;
                      if (!latest) return null;
                      return (
                        <article
                          key={item.itemId}
                          className={styles.menuItemRow}
                        >
                          <div className={styles.menuItemInfo}>
                            <strong>
                              {String(latest.nameId ?? item.itemCode)}
                            </strong>
                            <small>{String(item.itemCode)}</small>
                            <small>
                              {idr(latest.priceIdr)} · status{" "}
                              {String(
                                latest.lifecycleStatus ?? item.itemStatus,
                              )}
                            </small>
                            <small>
                              Berlaku: {dateLabel(latest.effectiveFrom)} —{" "}
                              {latest.effectiveTo
                                ? dateLabel(latest.effectiveTo)
                                : "sampai selamanya"}
                            </small>
                          </div>
                          <div className={styles.menuItemActions}>
                            {canManageMenu ? (
                              <label className={styles.menuOrderControl}>
                                Urutan:
                                <input
                                  min="0"
                                  type="number"
                                  value={
                                    itemSortDrafts[item.itemId] ??
                                    String(item.itemSortOrder ?? 0)
                                  }
                                  onChange={(event) =>
                                    setItemSortDrafts((current) => ({
                                      ...current,
                                      [item.itemId]: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                            ) : null}
                            {canManageMenu ? (
                              <button
                                className={styles.secondaryButton}
                                onClick={() =>
                                  void updateItemSortOrder(
                                    item.itemId,
                                    item.itemSortOrder,
                                  )
                                }
                                type="button"
                              >
                                Simpan urutan
                              </button>
                            ) : null}
                            <span
                              className={`${styles.menuAvailabilityPill} ${
                                item.currentlyAvailable
                                  ? styles.availabilityAvailable
                                  : styles.availabilityUnavailable
                              }`}
                            >
                              {item.currentlyAvailable
                                ? "Tersedia"
                                : "Tidak tersedia"}
                            </span>
                            {canManageMenu ? (
                              <>
                                <button
                                  className={styles.secondaryButton}
                                  onClick={() =>
                                    void toggleMenuItemAvailability(
                                      item.itemId,
                                      !item.currentlyAvailable,
                                    )
                                  }
                                  type="button"
                                >
                                  {item.currentlyAvailable
                                    ? "Nonaktifkan"
                                    : "Aktifkan"}
                                </button>
                                {item.activatableVersionId ? (
                                  <button
                                    className={styles.secondaryButton}
                                    onClick={() =>
                                      void activateMenuItemVersion(
                                        item.activatableVersionId!,
                                      )
                                    }
                                    type="button"
                                  >
                                    Aktifkan versi
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.emptyCompact}>
                    Kategori ini belum memiliki menu.
                  </p>
                )}
              </section>
            ))
          ) : (
            <p className={styles.emptyCompact}>
              Belum ada menu yang terdaftar.
            </p>
          )}
        </div>
      </section>
      <ReasonDialog
        confirmLabel="Lanjutkan tindakan"
        description="Alasan akan dicatat bersama perubahan status konten."
        onCancel={() => {
          setLifecycleRequest(null);
          setLifecycleReason("");
        }}
        onChange={setLifecycleReason}
        onConfirm={() => void lifecycle()}
        open={Boolean(lifecycleRequest)}
        title="Konfirmasi perubahan konten"
        value={lifecycleReason}
      />
      <ReasonDialog
        confirmLabel="Hapus media"
        description={`Media “${String(deleteMediaTarget?.title || "tanpa judul")}” akan dihapus dari galeri dan penyimpanan. Tindakan ini hanya dapat dilakukan bila media tidak sedang dipakai di website atau galeri kamar.`}
        label="Alasan penghapusan"
        onCancel={() => {
          setDeleteMediaTarget(null);
          setDeleteMediaReason("");
        }}
        onChange={setDeleteMediaReason}
        onConfirm={() => void deleteMedia()}
        open={Boolean(deleteMediaTarget)}
        title="Hapus media tersimpan?"
        value={deleteMediaReason}
      />
    </div>
  );
}

function TeamAdmin({ data, load, setNotice }: AdminProps) {
  const team = Array.isArray(data.team) ? (data.team as JsonRecord[]) : [];
  const grants = Array.isArray(data.grants)
    ? (data.grants as JsonRecord[])
    : [];
  const initialAudit = Array.isArray(data.audit)
    ? (data.audit as JsonRecord[])
    : [];
  const initialPagination = data.auditPagination as PaginationMeta | undefined;
  const [auditOverride, setAuditOverride] = useState<{
    rows: JsonRecord[];
    pagination: PaginationMeta;
  } | null>(null);
  const audit = auditOverride?.rows ?? initialAudit;
  const auditPagination = auditOverride?.pagination ??
    initialPagination ?? {
      page: 1,
      pageSize: 50,
      totalItems: initialAudit.length,
      totalPages: 1,
      from: initialAudit.length ? 1 : 0,
      to: initialAudit.length,
    };
  const [auditSearch, setAuditSearch] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [roleCode, setRoleCode] = useState("FRONT_OFFICE");
  const [reason, setReason] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffEmployeeCode, setNewStaffEmployeeCode] = useState("");
  const [newStaffDisplayName, setNewStaffDisplayName] = useState("");
  const [newStaffRoleCode, setNewStaffRoleCode] = useState("");
  const [newStaffReason, setNewStaffReason] = useState("");
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  async function loadAudit(page: number, pageSize: number) {
    try {
      const query = new URLSearchParams({
        auditPage: String(page),
        auditPageSize: String(pageSize),
        auditSearch: auditSearch.trim(),
      });
      const response = await fetch(`/api/staff/admin/overview?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Audit gagal dimuat");
      const result = (await response.json()) as {
        audit: JsonRecord[];
        auditPagination: PaginationMeta;
      };
      setAuditOverride({
        rows: result.audit,
        pagination: result.auditPagination,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Audit gagal dimuat.",
      });
    }
  }
  async function changeRole(event: React.FormEvent, method: "POST" | "DELETE") {
    event.preventDefault();
    try {
      const auditReason =
        reason.trim() ||
        `${method === "POST" ? "Pemberian" : "Pencabutan"} akses ${roleCode} oleh Owner`;
      await post(
        "/api/staff/role-grants",
        { targetUserId, roleCode, reason: auditReason },
        method,
      );
      setNotice({
        tone: "success",
        message:
          method === "POST"
            ? "Role berhasil diberikan."
            : "Role berhasil dicabut.",
      });
      await load();
      setAuditOverride(null);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Role gagal diperbarui.",
      });
    }
  }

  async function createStaff(event: React.FormEvent) {
    event.preventDefault();
    if (isCreatingStaff) return;
    setIsCreatingStaff(true);
    try {
      const payload: JsonRecord = {
        action: "CREATE_STAFF",
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        password: newStaffPassword,
        employeeCode:
          newStaffEmployeeCode.trim() ||
          internalCode(`STAFF-${newStaffName}`).slice(0, 40),
        reason: newStaffReason.trim() || "Provisioning staf baru",
      };
      if (newStaffDisplayName.trim()) {
        payload.displayName = newStaffDisplayName.trim();
      }
      if (newStaffRoleCode) {
        payload.roleCode = newStaffRoleCode;
      }
      await post("/api/staff/admin/users", payload);
      setNotice({
        tone: "success",
        message:
          "Staf baru berhasil dibuat dan dapat login dengan email serta kata sandi.",
      });
      setNewStaffName("");
      setNewStaffEmail("");
      setNewStaffPassword("");
      setNewStaffEmployeeCode("");
      setNewStaffDisplayName("");
      setNewStaffRoleCode("");
      setNewStaffReason("");
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Gagal membuat staf baru.",
      });
    } finally {
      setIsCreatingStaff(false);
    }
  }

  return (
    <div className={styles.actionGrid}>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Buat staf baru</h2>
          <span className={styles.countPill}>Role awal opsional</span>
        </div>
        <form className={styles.staffForm} onSubmit={createStaff}>
          <label>
            Nama
            <input
              required
              maxLength={160}
              value={newStaffName}
              onChange={(event) => setNewStaffName(event.target.value)}
            />
          </label>
          <label>
            Nama tampilan (opsional)
            <input
              value={newStaffDisplayName}
              maxLength={160}
              onChange={(event) => setNewStaffDisplayName(event.target.value)}
            />
          </label>
          <label>
            Email
            <input
              required
              maxLength={320}
              type="email"
              value={newStaffEmail}
              onChange={(event) => setNewStaffEmail(event.target.value)}
            />
          </label>
          <label>
            Kata sandi (min 12)
            <input
              required
              minLength={12}
              maxLength={128}
              type="password"
              autoComplete="new-password"
              value={newStaffPassword}
              onChange={(event) => setNewStaffPassword(event.target.value)}
            />
          </label>
          <label>
            Kode staf (opsional)
            <input
              maxLength={40}
              placeholder="Dibuat otomatis bila dikosongkan"
              value={newStaffEmployeeCode}
              onChange={(event) => setNewStaffEmployeeCode(event.target.value)}
            />
          </label>
          <label>
            Role awal (opsional)
            <KookaSelect
              ariaLabel="Role awal staf"
              value={newStaffRoleCode}
              onChange={setNewStaffRoleCode}
              options={roleOptions}
              placeholder="Tanpa role awal"
            />
          </label>
          <label>
            Catatan pembuatan (opsional)
            <textarea
              maxLength={500}
              value={newStaffReason}
              onChange={(event) => setNewStaffReason(event.target.value)}
            />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={isCreatingStaff}
            >
              {isCreatingStaff ? "Membuat..." : "Buat akun staf"}
            </button>
          </div>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Atur akses staf</h2>
        </div>
        <form className={styles.staffForm}>
          <label>
            Staf
            <KookaSelect
              ariaLabel="Staf yang akan diatur"
              value={targetUserId}
              onChange={setTargetUserId}
              options={team.map((person) => ({
                value: String(person.userId),
                label: String(person.displayName ?? person.name),
                description: String(person.employeeCode),
              }))}
              placeholder="Pilih staf"
            />
          </label>
          <label>
            Akses
            <KookaSelect
              ariaLabel="Role staf"
              value={roleCode}
              onChange={setRoleCode}
              options={[
                { value: "OWNER", label: "Owner" },
                { value: "FRONT_OFFICE", label: "Front Office" },
                { value: "CLEANING", label: "Cleaning" },
                { value: "FNB", label: "F&B" },
              ]}
            />
          </label>
          <label>
            Catatan perubahan (opsional)
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryButton}
              onClick={(event) => void changeRole(event, "DELETE")}
              type="button"
            >
              Cabut role
            </button>
            <button
              className={styles.primaryButton}
              onClick={(event) => void changeRole(event, "POST")}
              type="button"
            >
              Berikan role
            </button>
          </div>
        </form>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Staf aktif</h2>
          <span className={styles.countPill}>{team.length}</span>
        </div>
        <div className={styles.masterList}>
          {team.map((person) => (
            <article key={String(person.userId)}>
              <div>
                <strong>{String(person.displayName ?? person.name)}</strong>
                <small>
                  {String(person.employeeCode)} · {String(person.email)}
                </small>
              </div>
              <span className={styles.statusPill}>
                {grants
                  .filter((grant) => grant.userId === person.userId)
                  .map((grant) => grant.roleCode)
                  .join(", ") || "tanpa role"}
              </span>
            </article>
          ))}
        </div>
      </section>
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Audit terbaru</h2>
          <span className={styles.countPill}>{auditPagination.totalItems}</span>
        </div>
        <form
          className={styles.historyFilters}
          onSubmit={(event) => {
            event.preventDefault();
            void loadAudit(1, auditPagination.pageSize);
          }}
        >
          <input
            aria-label="Cari audit"
            onChange={(event) => setAuditSearch(event.target.value)}
            placeholder="Cari aktivitas, target, atau alasan"
            type="search"
            value={auditSearch}
          />
          <button className={styles.secondaryButton} type="submit">
            Terapkan
          </button>
        </form>
        <div className={styles.tableWrap}>
          <table className={styles.workTable}>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktivitas</th>
                <th>Target</th>
                <th>Hasil</th>
                <th>Alasan</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((event) => (
                <tr key={String(event.id)}>
                  <td>
                    {new Date(String(event.createdAt)).toLocaleString("id-ID")}
                  </td>
                  <td title={`Kode audit: ${String(event.action)}`}>
                    {auditActionLabel(String(event.action))}
                  </td>
                  <td>{human(String(event.targetType))}</td>
                  <td>
                    <span className={styles.statusPill}>
                      {human(String(event.result))}
                    </span>
                  </td>
                  <td>{String(event.reason ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          onPageChange={(page) =>
            void loadAudit(page, auditPagination.pageSize)
          }
          onPageSizeChange={(pageSize) => void loadAudit(1, pageSize)}
          pageSizes={[50, 100]}
          pagination={auditPagination}
        />
      </section>
    </div>
  );
}

function ReportAdmin({ setNotice }: { setNotice: (notice: Notice) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [businessDate, setBusinessDate] = useState(today);
  const [reportCode, setReportCode] = useState("DAILY_OPERATIONS");
  const [rangeStart, setRangeStart] = useState(today);
  const [rangeEnd, setRangeEnd] = useState(today);
  async function run(action: string) {
    try {
      const result = await post("/api/staff/reports", { action, businessDate });
      setNotice({
        tone: "success",
        message:
          action === "RUN_RECONCILIATION"
            ? "Pemeriksaan kesesuaian data selesai. Tinjau temuan pada dashboard."
            : "Pergantian hari operasional selesai diproses.",
      });
      if (result.downloadUrl)
        window.location.assign(String(result.downloadUrl));
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Proses laporan gagal.",
      });
    }
  }
  async function exportExcel(event: React.FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch("/api/staff/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key("EXPORT_EXCEL"),
        },
        body: JSON.stringify({
          action: "EXPORT_EXCEL",
          reportCode,
          rangeStart,
          rangeEnd,
        }),
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        throw new Error(messageFrom(result));
      }
      const workbook = await response.blob();
      const url = URL.createObjectURL(workbook);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kooka-${reportCode.toLowerCase().replaceAll("_", "-")}-${rangeStart}-${rangeEnd}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice({
        tone: "success",
        message: "Laporan Excel berhasil dibuat dan diunduh.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Export gagal.",
      });
    }
  }
  return (
    <div className={styles.actionGrid}>
      <details className={`${styles.formCard} ${styles.advancedOperations}`}>
        <summary>
          <div>
            <span className={styles.pageEyebrow}>Alat lanjutan</span>
            <strong>Perawatan operasional harian</strong>
          </div>
          <span>Biasanya berjalan otomatis</span>
        </summary>
        <div className={styles.panelHeader}>
          <h2>Operasional harian</h2>
        </div>
        <div className={styles.staffForm}>
          <div className={styles.fieldGroup}>
            <span>Tanggal operasional</span>
            <DateField
              ariaLabel="Tanggal operasional"
              onChange={setBusinessDate}
              value={businessDate}
            />
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => void run("RUN_RECONCILIATION")}
            >
              Periksa kesesuaian data
            </button>
            <button
              className={styles.primaryButton}
              onClick={() => void run("RUN_DAILY_ROLLOVER")}
            >
              Tutup hari operasional
            </button>
          </div>
          <div className={styles.operationExplanation}>
            <p>
              <strong>Periksa kesesuaian data</strong>
              Memeriksa apakah booking, kamar, pembayaran, tagihan, refund, dan
              dokumen saling sesuai. Sistem hanya membuat daftar temuan untuk
              ditinjau dan tidak mengubah transaksi secara otomatis.
            </p>
            <p>
              <strong>Tutup hari operasional</strong>
              Menjalankan pergantian hari operasional: membuat tugas stayover
              yang belum ada dan memeriksa temuan hari tersebut. Proses ini
              biasanya berjalan otomatis dan hanya perlu dijalankan manual bila
              proses otomatis gagal.
            </p>
          </div>
        </div>
      </details>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Export Excel</h2>
        </div>
        <form className={styles.staffForm} onSubmit={exportExcel}>
          <label>
            Jenis laporan
            <KookaSelect
              ariaLabel="Jenis laporan"
              value={reportCode}
              onChange={setReportCode}
              options={[
                {
                  value: "DAILY_OPERATIONS",
                  label: "Operasional harian",
                },
                { value: "BOOKINGS", label: "Booking" },
                { value: "FINANCIAL_LEDGER", label: "Financial ledger" },
                { value: "CLEANING", label: "Cleaning" },
                { value: "RECONCILIATION", label: "Reconciliation" },
              ]}
            />
          </label>
          <div className={styles.formGrid}>
            <div className={styles.fieldGroup}>
              <span>Dari</span>
              <DateField
                ariaLabel="Tanggal awal laporan"
                onChange={(value) => {
                  setRangeStart(value);
                  if (rangeEnd < value) setRangeEnd(value);
                }}
                value={rangeStart}
              />
            </div>
            <div className={styles.fieldGroup}>
              <span>Sampai</span>
              <DateField
                ariaLabel="Tanggal akhir laporan"
                min={rangeStart}
                onChange={setRangeEnd}
                value={rangeEnd}
              />
            </div>
          </div>
          <button className={styles.primaryButton}>Download Excel</button>
        </form>
      </section>
    </div>
  );
}
