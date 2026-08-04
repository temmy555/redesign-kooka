"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DateField,
  FileField,
  type SelectOption,
  KookaSelect,
  MoneyInput,
  ReasonDialog,
} from "./FormControls";
import AttendanceLocationAdmin from "./AttendanceLocationAdmin";
import PaginationControls from "./PaginationControls";
import StaffNotice from "./StaffNotice";
import styles from "../staff.module.css";
import type { PaginationMeta } from "../../../src/platform/pagination";

type JsonRecord = Record<string, unknown>;
type Notice = { tone: "success" | "error"; message: string } | null;

const areas = [
  ["property", "Properti"],
  ["rooms", "Kamar"],
  ["commercial", "Harga & pajak"],
  ["content", "Konten & menu"],
  ["team", "Staf & audit"],
  ["attendance", "Absensi"],
  ["reports", "Laporan"],
] as const;

const roleOptions: SelectOption[] = [
  { value: "", label: "Tanpa role awal" },
  { value: "OWNER", label: "Owner" },
  { value: "FRONT_OFFICE", label: "Front Office" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "FNB", label: "F&B" },
] as SelectOption[];

function key(action: string) {
  return `${action}:${crypto.randomUUID()}`;
}

function internalCode(prefix: string) {
  const normalized = prefix
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toUpperCase()
    .slice(0, 24);
  return `${normalized || "ITEM"}-${crypto.randomUUID().toUpperCase()}`;
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

export default function AdminWorkspace({
  permissions,
}: {
  permissions: string[];
}) {
  const granted = useMemo(() => new Set(permissions), [permissions]);
  const availableAreas = areas.filter(([area]) => {
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
  const [active, setActive] = useState(availableAreas[0]?.[0] ?? "property");
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
          if (!response.ok) throw new Error(`${endpoint} -> ${response.status}`);
          return [name, await response.json()] as const;
        }),
      );
      const partial: Record<string, unknown> = {};
      let failedCount = 0;
      for (const item of settled) {
        if (item.status === "fulfilled") {
          const [name, responseData] = item.value;
          partial[name] = responseData;
          continue;
        }
        failedCount += 1;
        console.error("Failed to load admin endpoint", item.reason);
      }
      setData(partial);
      if (failedCount > 0) {
        setNotice({
          tone: "error",
          message: "Sebagian data administrasi gagal dimuat, tetapi bagian lain tetap ditampilkan.",
        });
      } else {
        setNotice(null);
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
      {active === "property" ? (
        <PropertyAdmin
          data={(data.property ?? {}) as JsonRecord}
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
          roomData={(data.rooms ?? {}) as JsonRecord}
          load={load}
          setNotice={setNotice}
        />
      ) : null}
      {active === "content" ? (
        <ContentAdmin
          content={data.content}
          media={data.media}
          menu={data.menu}
          canManageMedia={granted.has("cms.media.manage")}
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
  const [locale, setLocale] = useState(String(property.defaultLocale ?? "id"));
  const [reason, setReason] = useState("");
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkoutTime, setCheckoutTime] = useState("12:00");
  const [onlineDeadline, setOnlineDeadline] = useState("60");
  const [sameDayDeadline, setSameDayDeadline] = useState("60");
  const [extraBedRate, setExtraBedRate] = useState("");
  const [settingReason, setSettingReason] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await post("/api/staff/admin/configuration", {
        action: "UPDATE_PROPERTY_PROFILE",
        name,
        address: address || null,
        timezone,
        defaultLocale: locale,
        reason,
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
            reason: settingReason,
            requiresApproval: false,
          },
        });
        await post("/api/staff/admin/configuration", {
          action: "PUBLISH_SETTING",
          versionId: String(draft.id),
          reason: settingReason,
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
              <input
                required
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
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
            Alasan perubahan
            <textarea
              required
              minLength={3}
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
            Alasan
            <textarea
              minLength={3}
              onChange={(event) => setSettingReason(event.target.value)}
              required
              value={settingReason}
            />
          </label>
          <button className={styles.primaryButton}>
            Simpan &amp; aktifkan konfigurasi
          </button>
        </form>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Konfigurasi berversi</h2>
          <span className={styles.countPill}>{settings.length}</span>
        </div>
        <div className={styles.masterList}>
          {settings.map((setting) => (
            <article key={String(setting.id)}>
              <div>
                <strong>{String(setting.name)}</strong>
                <small>{String(setting.code)}</small>
              </div>
              <span className={styles.statusPill}>
                {setting.resolved ? "aktif" : "belum aktif"}
              </span>
            </article>
          ))}
        </div>
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
      await post("/api/staff/admin/room-master", {
        action: "CREATE_ROOM_UNIT",
        roomNumber,
        sortOrder: Number(sortOrder),
        floorOrArea: floor || null,
        roomTypeId,
        effectiveFrom: new Date().toISOString(),
        reason: unitReason,
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
      await post("/api/staff/admin/room-master", {
        action: "CHANGE_ROOM_UNIT_TYPE",
        roomUnitId: changeUnitId,
        roomTypeId: changeUnitTypeId,
        effectiveFrom: new Date().toISOString(),
        reason: changeUnitReason,
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
      await post("/api/staff/admin/room-master", {
        action: "CREATE_RESOURCE_POOL",
        code: resourceCode,
        nameId: resourceNameId,
        nameEn: resourceNameEn,
        physicalCapacity: Number(resourceCapacity),
        inventoryTracked: resourceTracked,
        reason: resourceReason,
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
      await post("/api/staff/admin/room-master", {
        action: "CREATE_AMENITY",
        code: amenityCode,
        nameId: amenityNameId,
        nameEn: amenityNameEn,
        reason: amenityReason,
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
      const draft = await post("/api/staff/admin/room-master", {
        action: "CREATE_ROOM_TYPE_DRAFT",
        input: {
          roomTypeId: editingRoomTypeId || undefined,
          code: typeCode,
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
          reason: typeReason,
        },
      });
      await post("/api/staff/admin/room-master", {
        action: "PUBLISH_ROOM_TYPE",
        versionId: String(draft.id),
        reason: typeReason,
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
      <section className={`${styles.formCard} ${styles.actionGridWide}`}>
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
              Kode jenis kamar
              <input
                disabled={Boolean(editingRoomTypeId)}
                maxLength={80}
                placeholder="CONTOH: FAMILY"
                required
                value={typeCode}
                onChange={(event) =>
                  setTypeCode(event.target.value.toUpperCase())
                }
              />
            </label>
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
            <legend>Amenity jenis kamar</legend>
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
                Tambahkan amenity terlebih dahulu bila diperlukan.
              </p>
            )}
          </fieldset>
          <label>
            Alasan pencatatan / perubahan
            <textarea
              minLength={3}
              required
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
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
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
                    <small>{String(item.code)}</small>
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
      <section className={styles.formCard}>
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
                  description: String(item.code),
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
            Alasan
            <textarea
              required
              minLength={3}
              value={unitReason}
              onChange={(event) => setUnitReason(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton}>Tambah kamar</button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Ubah jenis unit kamar</h2>
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
                description: String(item.code),
              }))}
              placeholder="Pilih jenis kamar"
            />
          </label>
          <label>
            Alasan
            <textarea
              minLength={3}
              onChange={(event) => setChangeUnitReason(event.target.value)}
              required
              value={changeUnitReason}
            />
          </label>
          <button className={styles.primaryButton}>Ubah jenis unit</button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Resource inventory</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createResource}>
          <div className={styles.formGrid}>
            <label>
              Kode
              <input
                onChange={(event) =>
                  setResourceCode(event.target.value.toUpperCase())
                }
                required
                value={resourceCode}
              />
            </label>
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
          <label className={styles.checkboxLabel}>
            <input
              checked={resourceTracked}
              onChange={(event) => setResourceTracked(event.target.checked)}
              type="checkbox"
            />
            Pantau kapasitas resource ini
          </label>
          <label>
            Alasan
            <textarea
              minLength={3}
              onChange={(event) => setResourceReason(event.target.value)}
              required
              value={resourceReason}
            />
          </label>
          <button className={styles.primaryButton}>Tambah resource</button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Tambah amenity</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createAmenity}>
          <div className={styles.formGrid}>
            <label>
              Kode
              <input
                required
                value={amenityCode}
                onChange={(event) =>
                  setAmenityCode(event.target.value.toUpperCase())
                }
              />
            </label>
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
          <label>
            Alasan
            <textarea
              required
              minLength={3}
              value={amenityReason}
              onChange={(event) => setAmenityReason(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton}>Tambah amenity</button>
        </form>
      </section>
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Master kamar</h2>
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
  roomData,
  load,
  setNotice,
}: AdminProps & { roomData: JsonRecord }) {
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
  const roomTypes = Array.isArray(roomData.roomTypes)
    ? (roomData.roomTypes as JsonRecord[]).filter(
        (item, index, list) =>
          item.lifecycleStatus === "ACTIVE" &&
          list.findIndex((other) => other.roomTypeId === item.roomTypeId) ===
            index,
      )
    : [];
  const lodgingTaxes = activeTaxes.filter((item) => item.domain === "LODGING");
  const [domain, setDomain] = useState("LODGING");
  const [taxRate, setTaxRate] = useState("0");
  const [serviceRate, setServiceRate] = useState("0");
  const [noTax, setNoTax] = useState(true);
  const [reason, setReason] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [displayRate, setDisplayRate] = useState("");
  const [planNameId, setPlanNameId] = useState("Harga Standar");
  const [planNameEn, setPlanNameEn] = useState("Standard Rate");
  const [planRoomTypeId, setPlanRoomTypeId] = useState("");
  const [nightlyRate, setNightlyRate] = useState("");
  const [minimumStay, setMinimumStay] = useState("1");
  const [selectedTaxProfileId, setSelectedTaxProfileId] = useState("");
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
  const [editingTaxProfileId, setEditingTaxProfileId] = useState("");
  const [editingRatePlanId, setEditingRatePlanId] = useState("");
  const [editingInstructionSetId, setEditingInstructionSetId] = useState("");
  const [editingPolicySetId, setEditingPolicySetId] = useState("");
  const [retireTarget, setRetireTarget] = useState<{
    subject: "TAX_PROFILE" | "RATE_PLAN" | "PAYMENT_INSTRUCTION" | "POLICY";
    versionId: string;
    label: string;
  } | null>(null);
  const [retireReason, setRetireReason] = useState("");
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
        taxInclusive: false,
        serviceChargeInclusive: false,
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
      setTaxRate("0");
      setServiceRate("0");
      setReason("");
      setEditingTaxProfileId("");
      setNotice({
        tone: "success",
        message: editingTaxProfileId
          ? "Pengaturan pajak diperbarui dan versi barunya sudah aktif."
          : "Konfigurasi pajak dibuat, disetujui, dan diaktifkan.",
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
      setSelectedTaxProfileId("");
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

  function editTax(item: JsonRecord) {
    setEditingTaxProfileId(String(item.profileId));
    setDomain(String(item.domain ?? "LODGING"));
    setNoTax(Boolean(item.noTax));
    setTaxRate(String(Number(item.taxRate ?? 0) * 100));
    setServiceRate(String(Number(item.serviceChargeRate ?? 0) * 100));
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
      <section className={styles.formCard} id="tax-settings-form">
        <div className={styles.panelHeader}>
          <h2>
            {editingTaxProfileId
              ? "Edit pajak & biaya layanan"
              : "Pajak & biaya layanan"}
          </h2>
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
              </>
            ) : null}
          </div>
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
      <section className={styles.formCard} id="bank-settings-form">
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
        className={`${styles.formCard} ${styles.actionGridWide}`}
        id="policy-settings-form"
      >
        <div className={styles.panelHeader}>
          <h2>
            {editingPolicySetId
              ? "Edit kebijakan pembatalan & refund"
              : "Kebijakan pembatalan & refund"}
          </h2>
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
        className={`${styles.formCard} ${styles.actionGridWide}`}
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
                Pajak untuk harga ini
                <KookaSelect
                  ariaLabel="Pajak untuk harga kamar"
                  onChange={setSelectedTaxProfileId}
                  options={[
                    { value: "", label: "Tanpa pajak" },
                    ...lodgingTaxes.map((item) => ({
                      value: String(item.profileId),
                      label: String(item.name ?? "Pengaturan pajak kamar"),
                      description: item.noTax
                        ? "Tanpa pajak"
                        : `Pajak ${Number(item.taxRate ?? 0) * 100}% · layanan ${Number(item.serviceChargeRate ?? 0) * 100}%`,
                    })),
                  ]}
                  value={selectedTaxProfileId}
                />
              </label>
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
      <section className={styles.formCard} id="currency-settings-form">
        <div className={styles.panelHeader}>
          <h2>Kurs tampilan</h2>
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
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Pengaturan yang aktif</h2>
          <span className={styles.countPill}>
            {activeTaxes.length} pajak · {activeRates.length} harga ·{" "}
            {activeInstructions.length} rekening · {activePolicies.length}{" "}
            kebijakan · {latestExchange.length} kurs
          </span>
        </div>
        <div className={styles.commercialGroups}>
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
                        {linkedTax
                          ? ` · ${String(linkedTax.name)}`
                          : " · tanpa pajak"}
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
  content,
  media,
  menu,
  canManageMedia,
  canManageMenu,
  load,
  setNotice,
}: {
  content: unknown;
  media: unknown;
  menu: unknown;
  canManageMedia: boolean;
  canManageMenu: boolean;
  load: () => Promise<void>;
  setNotice: (notice: Notice) => void;
}) {
  const pages = Array.isArray(content) ? (content as JsonRecord[]) : [];
  const assets = Array.isArray(media) ? (media as JsonRecord[]) : [];
  const menuRows = useMemo(
    () => (Array.isArray(menu) ? (menu as JsonRecord[]) : []),
    [menu],
  );
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
        items: Map<
          string,
          {
            itemId: string;
            itemCode: string;
            itemStatus: string;
            currentlyAvailable: boolean;
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
          activatableVersionId: String(
            activatableVersion?.versionId ?? "",
          ),
        });
      }
      result.push({
        ...category,
        items: items.sort((first, second) =>
          String(first.itemCode).localeCompare(String(second.itemCode), "id-ID"),
        ),
      });
    }

    return result.sort((first, second) =>
      String(first.categoryNameId).localeCompare(
        String(second.categoryNameId),
        "id-ID",
      ),
    );
  }, [menuRows]);
  const menuCategoryOptions = menuCatalog.map((category) => ({
    value: category.categoryId,
    label: `${category.categoryNameId || category.categoryCode} (${category.categoryCode})`,
  }));
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [altId, setAltId] = useState("");
  const [altEn, setAltEn] = useState("");
  const [rights, setRights] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [nameId, setNameId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemNameId, setNewItemNameId] = useState("");
  const [newItemNameEn, setNewItemNameEn] = useState("");
  const [newItemDescriptionId, setNewItemDescriptionId] = useState("");
  const [newItemDescriptionEn, setNewItemDescriptionEn] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemTaxProfileId, setNewItemTaxProfileId] = useState("");
  const [newItemReason, setNewItemReason] = useState("Tambah item menu");
  const [newItemEffectiveFrom, setNewItemEffectiveFrom] = useState(today);

  const [lifecycleRequest, setLifecycleRequest] = useState<{
    endpoint: string;
    body: JsonRecord;
  } | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const selectedMenuCategoryId =
    newItemCategoryId || menuCategoryOptions[0]?.value || "";
  const autoGeneratedMenuItemCode = useMemo(() => {
    const selectedCategory =
      menuCatalog.find((category) => category.categoryId === selectedMenuCategoryId) ??
      menuCatalog[0];
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
    if (!file) return;
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title);
      form.set("altId", altId);
      form.set("altEn", altEn);
      form.set("rightsSource", rights);
      form.set("authenticPropertyMedia", "true");
      const response = await fetch("/api/staff/admin/media", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result));
      setNotice({
        tone: "success",
        message: "Foto asli masuk staging media dan menunggu scan/publish.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Upload gagal.",
      });
    }
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
        message: "Kode item tidak dapat dibuat, silakan isi nama item terlebih dahulu.",
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
        message: "Item menu berhasil dibuat (versi baru menunggu publish).",
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
          error instanceof Error ? error.message : "Item menu tidak dapat dibuat.",
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
  async function toggleMenuItemAvailability(itemId: string, available: boolean) {
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
        categoryCode,
        nameId,
        nameEn,
        sortOrder: Number(sortOrder),
      });
      setNotice({
        tone: "success",
        message: "Kategori menu F&B berhasil dibuat.",
      });
      setCategoryCode("");
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
    <div className={styles.actionGrid}>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Upload foto asli</h2>
          {!canManageMedia ? (
            <span className={styles.countPill}>Read only</span>
          ) : null}
        </div>
        {!canManageMedia ? (
          <p className={styles.formHint}>
            Upload media memerlukan izin pengelola konten.
          </p>
        ) : null}
        <form className={styles.staffForm} onSubmit={upload}>
          <FileField
            accept="image/jpeg,image/png"
            file={file}
            helper="JPEG atau PNG · gunakan foto asli properti"
            label="Foto JPEG / PNG"
            onChange={setFile}
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
          <label>
            Sumber / hak penggunaan
            <input
              required
              value={rights}
              onChange={(event) => setRights(event.target.value)}
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={!canManageMedia}
            type="submit"
          >
            Upload ke galeri
          </button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Kategori menu</h2>
          {!canManageMenu ? (
            <span className={styles.countPill}>Read only</span>
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
              Kode
              <input
                required
                value={categoryCode}
                onChange={(event) =>
                  setCategoryCode(event.target.value.toUpperCase())
                }
              />
            </label>
            <label>
              Urutan
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
              Kode item
              <input
                readOnly
                value={autoGeneratedMenuItemCode}
                title="Kode item dibuat otomatis."
              />
            </label>
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
          <label>
            Deskripsi Indonesia
            <textarea
              rows={2}
              value={newItemDescriptionId}
              onChange={(event) => setNewItemDescriptionId(event.target.value)}
            />
          </label>
          <label>
            Deskripsi English
            <textarea
              rows={2}
              value={newItemDescriptionEn}
              onChange={(event) => setNewItemDescriptionEn(event.target.value)}
            />
          </label>
          <label>
            ID versi pajak profil (opsional)
            <input
              value={newItemTaxProfileId}
              onChange={(event) => setNewItemTaxProfileId(event.target.value)}
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
            Alasan
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
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Halaman landing</h2>
          <span className={styles.countPill}>{pages.length} versi</span>
        </div>
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
                    Ajukan review
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
                    Publish
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Ringkasan media</h2>
          <span className={styles.countPill}>
            {assets.length} media · {menuCatalog.reduce(
              (total, category) => total + category.items.length,
              0,
            )}{" "}
            item menu
          </span>
        </div>
        {!canManageMedia ? (
          <p className={styles.emptyCompact}>
            Akses katalog media tidak aktif di role ini. Mintalah hak{' '}
            <strong>cms.media.manage</strong> untuk melihat data media.
          </p>
        ) : null}
        {assets.length ? (
          <div className={styles.masterList}>
            {assets.map((asset) => (
              <article key={`${String(asset.id)}`}>
                <div>
                  <strong>{String(asset.title || "Foto tanpa judul")}</strong>
                  <small>
                    {String(asset.mediaType || "MEDIA")} · status:{" "}
                    {String(asset.status || "DRAFT")} · scan:{" "}
                    {String(asset.scanStatus || "UNKNOWN")}
                  </small>
                  <small>
                    {Boolean(asset.authenticPropertyMedia)
                      ? "Foto asli properti"
                      : "Foto non-properti"}
                  </small>
                </div>
                <span className={styles.statusPill}>
                  {String(asset.mimeType || "N/A")}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyCompact}>Belum ada media aktif.</p>
        )}
      </section>
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Katalog menu</h2>
          <span className={styles.countPill}>
            {menuCatalog.length} kategori ·{" "}
            {menuCatalog.reduce((total, category) => total + category.items.length, 0)} item
          </span>
        </div>
        {!canManageMenu ? (
          <p className={styles.emptyCompact}>
            Anda tidak memiliki hak ubah menu (commercial.manage), jadi mode lihat
            saja.
          </p>
        ) : null}
        <div className={styles.commercialGroups}>
          {menuCatalog.length ? (
            menuCatalog.map((category) => (
              <section className={styles.commercialGroup} key={category.categoryId}>
                <div className={styles.commercialGroupHeader}>
                  <h3>
                    {category.categoryNameId || category.categoryNameEn || category.categoryCode}
                  </h3>
                  <small>{category.items.length} item</small>
                </div>
                {category.items.length ? (
                  <div className={styles.masterList}>
                    {category.items.map((item) => {
                      const latest = item.latestVersion;
                      if (!latest) return null;
                      return (
                        <article key={item.itemId}>
                          <div>
                            <strong>
                              {String(latest.nameId ?? item.itemCode)}
                            </strong>
                            <small>{String(item.itemCode)}</small>
                            <small>
                              {idr(latest.priceIdr)} · status{" "}
                              {String(latest.lifecycleStatus ?? item.itemStatus)}
                            </small>
                            <small>
                              Berlaku: {dateLabel(latest.effectiveFrom)} —{" "}
                              {latest.effectiveTo
                                ? dateLabel(latest.effectiveTo)
                                : "sampai selamanya"}
                            </small>
                          </div>
                          <div className={styles.commercialActions}>
                            <span className={styles.statusPill}>
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
            <p className={styles.emptyCompact}>Belum ada menu yang terdaftar.</p>
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
      await post(
        "/api/staff/role-grants",
        { targetUserId, roleCode, reason },
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
        employeeCode: newStaffEmployeeCode.trim(),
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
            Kode staf
            <input
              required
              maxLength={40}
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
            Alasan
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
          <h2>Role staf</h2>
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
            Role
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
            Alasan
            <textarea
              required
              minLength={3}
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
            placeholder="Cari aksi, target, atau alasan"
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
                <th>Aksi</th>
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
                  <td>{String(event.action)}</td>
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
            ? "Reconciliation selesai. Periksa exception pada dashboard."
            : "Daily rollover selesai diproses.",
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
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Operasional harian</h2>
        </div>
        <div className={styles.staffForm}>
          <div className={styles.fieldGroup}>
            <span>Business date</span>
            <DateField
              ariaLabel="Business date"
              onChange={setBusinessDate}
              value={businessDate}
            />
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => void run("RUN_RECONCILIATION")}
            >
              Jalankan reconciliation
            </button>
            <button
              className={styles.primaryButton}
              onClick={() => void run("RUN_DAILY_ROLLOVER")}
            >
              Jalankan rollover
            </button>
          </div>
          <div className={styles.operationExplanation}>
            <p>
              <strong>Reconciliation</strong>
              Memeriksa apakah booking, kamar, pembayaran, tagihan, refund, dan
              dokumen saling sesuai. Sistem hanya membuat daftar exception untuk
              ditinjau dan tidak mengubah transaksi secara otomatis.
            </p>
            <p>
              <strong>Rollover</strong>
              Menjalankan pergantian hari operasional: membuat tugas stayover
              yang belum ada dan memeriksa exception hari tersebut. Biasanya
              berjalan otomatis; tombol ini dipakai untuk UAT atau jika proses
              otomatis perlu dijalankan ulang.
            </p>
          </div>
        </div>
      </section>
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
