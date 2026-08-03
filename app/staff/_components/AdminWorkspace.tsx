"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DateField,
  FileField,
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

function key(action: string) {
  return `${action}:${crypto.randomUUID()}`;
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
      const results = await Promise.all(
        endpoints.map(async ([name, endpoint]) => {
          const response = await fetch(endpoint, { cache: "no-store" });
          if (!response.ok) throw new Error(endpoint);
          return [name, await response.json()] as const;
        }),
      );
      setData(Object.fromEntries(results));
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
        values: { checkInTime, checkoutTime },
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
          <div className={styles.formGrid}>
            <label>
              Jam check-in
              <input
                onChange={(event) => setCheckInTime(event.target.value)}
                required
                type="time"
                value={checkInTime}
              />
            </label>
            <label>
              Jam checkout
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
  const roomTypes = Array.isArray(roomData.roomTypes)
    ? (roomData.roomTypes as JsonRecord[]).filter(
        (item, index, list) =>
          item.lifecycleStatus === "ACTIVE" &&
          list.findIndex((other) => other.roomTypeId === item.roomTypeId) ===
            index,
      )
    : [];
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("LODGING");
  const [taxRate, setTaxRate] = useState("0");
  const [serviceRate, setServiceRate] = useState("0");
  const [noTax, setNoTax] = useState(false);
  const [reason, setReason] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [displayRate, setDisplayRate] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [planNameId, setPlanNameId] = useState("");
  const [planNameEn, setPlanNameEn] = useState("");
  const [planRoomTypeId, setPlanRoomTypeId] = useState("");
  const [nightlyRate, setNightlyRate] = useState("");
  const [minimumStay, setMinimumStay] = useState("1");
  const [rateStartsOn, setRateStartsOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [rateEndsOn, setRateEndsOn] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  });
  const [rateReason, setRateReason] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankReason, setBankReason] = useState("");
  const [policyCode, setPolicyCode] = useState("");
  const [policyTitleId, setPolicyTitleId] = useState("");
  const [policyTitleEn, setPolicyTitleEn] = useState("");
  const [policyContentId, setPolicyContentId] = useState("");
  const [policyContentEn, setPolicyContentEn] = useState("");
  const [policyReason, setPolicyReason] = useState("");
  async function createTax(event: React.FormEvent) {
    event.preventDefault();
    try {
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_TAX_DRAFT",
        code,
        name,
        domain,
        taxRate: noTax ? "0" : taxRate,
        serviceChargeRate: noTax ? "0" : serviceRate,
        taxInclusive: false,
        serviceChargeInclusive: false,
        noTax,
        effectiveFrom: new Date().toISOString(),
        reason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "REVIEW_VERSION",
        subject: "TAX_PROFILE",
        versionId: String(draft.id),
        decision: "APPROVE",
        reason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "PUBLISH_VERSION",
        subject: "TAX_PROFILE",
        versionId: String(draft.id),
        reason,
      });
      setNotice({
        tone: "success",
        message: "Konfigurasi pajak dibuat, disetujui, dan diaktifkan.",
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
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_RATE_PLAN_DRAFT",
        code: planCode,
        nameId: planNameId,
        nameEn: planNameEn,
        sourceEligibility: "ALL",
        effectiveFrom: new Date(`${rateStartsOn}T00:00:00+07:00`).toISOString(),
        effectiveTo: null,
        requiresApproval: false,
        reason: rateReason,
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
        reason: rateReason,
      });
      setPlanCode("");
      setPlanNameId("");
      setPlanNameEn("");
      setPlanRoomTypeId("");
      setNightlyRate("");
      setRateReason("");
      setNotice({
        tone: "success",
        message:
          "Rate plan dibuat dan langsung aktif untuk tipe kamar terpilih.",
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
      const now = new Date();
      const expires = new Date(now.getTime() + 86_400_000);
      await post("/api/staff/admin/commercial-master", {
        action: "CREATE_EXCHANGE_RATE",
        quoteCurrency: currency,
        rate: displayRate,
        source: "Owner preference",
        asOfAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        reason,
      });
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
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_PAYMENT_INSTRUCTION_DRAFT",
        code: bankCode,
        name: `${bankName} — ${accountHolder}`,
        bankName,
        accountHolder,
        accountNumber,
        instructionId: `Transfer ke ${bankName} atas nama ${accountHolder}. Cantumkan kode booking pada bukti transfer.`,
        instructionEn: `Transfer to ${bankName} under ${accountHolder}. Include the booking code in the transfer receipt.`,
        effectiveFrom: new Date().toISOString(),
        reason: bankReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "REVIEW_VERSION",
        subject: "PAYMENT_INSTRUCTION",
        versionId: String(draft.id),
        decision: "APPROVE",
        reason: bankReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "PUBLISH_VERSION",
        subject: "PAYMENT_INSTRUCTION",
        versionId: String(draft.id),
        reason: bankReason,
      });
      setBankCode("");
      setBankName("");
      setAccountHolder("");
      setAccountNumber("");
      setBankReason("");
      setNotice({
        tone: "success",
        message: "Instruksi transfer dibuat dan diaktifkan.",
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
      const draft = await post("/api/staff/admin/commercial-master", {
        action: "CREATE_POLICY_DRAFT",
        code: policyCode,
        policyType: "CANCELLATION_REFUND",
        titleId: policyTitleId,
        titleEn: policyTitleEn,
        contentId: policyContentId,
        contentEn: policyContentEn,
        effectiveFrom: new Date().toISOString(),
        reason: policyReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "REVIEW_VERSION",
        subject: "POLICY",
        versionId: String(draft.id),
        decision: "APPROVE",
        reason: policyReason,
      });
      await post("/api/staff/admin/commercial-master", {
        action: "PUBLISH_VERSION",
        subject: "POLICY",
        versionId: String(draft.id),
        reason: policyReason,
      });
      setPolicyCode("");
      setPolicyTitleId("");
      setPolicyTitleEn("");
      setPolicyContentId("");
      setPolicyContentEn("");
      setPolicyReason("");
      setNotice({
        tone: "success",
        message: "Kebijakan pembatalan/refund dibuat dan diaktifkan.",
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
  return (
    <div className={styles.actionGrid}>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Konfigurasi pajak fleksibel</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createTax}>
          <div className={styles.formGrid}>
            <label>
              Kode
              <input
                required
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </label>
            <label>
              Nama
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Domain
              <KookaSelect
                ariaLabel="Domain pajak"
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
              Tax rate
              <input
                disabled={noTax}
                min="0"
                step="0.01"
                type="number"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
              />
            </label>
            <label>
              Service charge
              <input
                disabled={noTax}
                min="0"
                step="0.01"
                type="number"
                value={serviceRate}
                onChange={(event) => setServiceRate(event.target.value)}
              />
            </label>
            <label className={styles.checkboxLabel}>
              <input
                checked={noTax}
                type="checkbox"
                onChange={(event) => setNoTax(event.target.checked)}
              />{" "}
              Tanpa tax
            </label>
          </div>
          <label>
            Alasan
            <textarea
              required
              minLength={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton}>Buat draft tax</button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Instruksi transfer bank</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createPaymentInstruction}>
          <div className={styles.formGrid}>
            <label>
              Kode
              <input
                onChange={(event) =>
                  setBankCode(event.target.value.toUpperCase())
                }
                required
                value={bankCode}
              />
            </label>
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
            </label>
          </div>
          <label>
            Alasan
            <textarea
              minLength={3}
              onChange={(event) => setBankReason(event.target.value)}
              required
              value={bankReason}
            />
          </label>
          <button className={styles.primaryButton}>
            Simpan &amp; aktifkan rekening
          </button>
        </form>
      </section>
      <section className={`${styles.formCard} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Kebijakan pembatalan &amp; refund</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createPolicy}>
          <div className={styles.formGrid}>
            <label>
              Kode
              <input
                onChange={(event) =>
                  setPolicyCode(event.target.value.toUpperCase())
                }
                required
                value={policyCode}
              />
            </label>
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
            Alasan
            <textarea
              minLength={3}
              onChange={(event) => setPolicyReason(event.target.value)}
              required
              value={policyReason}
            />
          </label>
          <button className={styles.primaryButton}>
            Simpan &amp; aktifkan kebijakan
          </button>
        </form>
      </section>
      <section className={`${styles.formCard} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Tambah rate plan</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createRatePlan}>
          <div className={styles.formGrid}>
            <label>
              Kode rate plan
              <input
                onChange={(event) =>
                  setPlanCode(event.target.value.toUpperCase())
                }
                required
                value={planCode}
              />
            </label>
            <label>
              Tipe kamar
              <KookaSelect
                ariaLabel="Tipe kamar rate plan"
                onChange={setPlanRoomTypeId}
                options={roomTypes.map((item) => ({
                  value: String(item.roomTypeId),
                  label: String(item.nameId ?? item.code),
                  description: String(item.code),
                }))}
                placeholder="Pilih tipe kamar"
                value={planRoomTypeId}
              />
            </label>
            <label>
              Nama Indonesia
              <input
                onChange={(event) => setPlanNameId(event.target.value)}
                required
                value={planNameId}
              />
            </label>
            <label>
              Nama English
              <input
                onChange={(event) => setPlanNameEn(event.target.value)}
                required
                value={planNameEn}
              />
            </label>
            <label>
              Harga kamar / malam
              <MoneyInput
                ariaLabel="Harga kamar per malam"
                onChange={setNightlyRate}
                required
                value={nightlyRate}
              />
            </label>
            <label>
              Minimum menginap
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
                ariaLabel="Tanggal mulai rate"
                onChange={setRateStartsOn}
                value={rateStartsOn}
              />
            </label>
            <label>
              Berlaku sampai
              <DateField
                ariaLabel="Tanggal akhir rate"
                min={rateStartsOn}
                onChange={setRateEndsOn}
                value={rateEndsOn}
              />
            </label>
          </div>
          <label>
            Alasan
            <textarea
              minLength={3}
              onChange={(event) => setRateReason(event.target.value)}
              required
              value={rateReason}
            />
          </label>
          <button className={styles.primaryButton}>
            Tambah &amp; aktifkan rate plan
          </button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Kurs tampilan preferensi</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createRate}>
          <div className={styles.formGrid}>
            <label>
              Currency
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
              1 IDR dalam currency
              <input
                required
                min="0"
                step="0.000001"
                type="number"
                value={displayRate}
                onChange={(event) => setDisplayRate(event.target.value)}
              />
            </label>
          </div>
          <p className={styles.formHint}>
            Nilai ini hanya estimasi tampilan. Folio, pembayaran, invoice, dan
            refund tetap diproses dalam IDR.
          </p>
          <button className={styles.primaryButton}>Simpan kurs tampilan</button>
        </form>
      </section>
      <section className={`${styles.panel} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Commercial master</h2>
          <span className={styles.countPill}>
            {taxes.length} tax · {rates.length} rate plan · {exchange.length}{" "}
            kurs
          </span>
        </div>
        <div className={styles.masterList}>
          {rates.map((rate) => (
            <article
              key={`${String(rate.ratePlanId)}-${String(rate.versionId)}`}
            >
              <div>
                <strong>{String(rate.nameId ?? rate.code)}</strong>
                <small>{String(rate.code)}</small>
              </div>
              <span className={styles.statusPill}>
                {human(String(rate.lifecycleStatus ?? "draft"))}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ContentAdmin({
  content,
  media,
  menu,
  load,
  setNotice,
}: {
  content: unknown;
  media: unknown;
  menu: unknown;
  load: () => Promise<void>;
  setNotice: (notice: Notice) => void;
}) {
  const pages = Array.isArray(content) ? (content as JsonRecord[]) : [];
  const assets = Array.isArray(media) ? (media as JsonRecord[]) : [];
  const menuRows = Array.isArray(menu) ? (menu as JsonRecord[]) : [];
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [altId, setAltId] = useState("");
  const [altEn, setAltEn] = useState("");
  const [rights, setRights] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [nameId, setNameId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [lifecycleRequest, setLifecycleRequest] = useState<{
    endpoint: string;
    body: JsonRecord;
  } | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  async function upload(event: React.FormEvent) {
    event.preventDefault();
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
  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
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
        </div>
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
          <button className={styles.primaryButton}>Upload ke galeri</button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Kategori menu</h2>
        </div>
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
          <button className={styles.primaryButton}>Tambah kategori</button>
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
          <h2>Ringkasan media & menu</h2>
          <span className={styles.countPill}>
            {assets.length} media · {menuRows.length} menu
          </span>
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
  return (
    <div className={styles.actionGrid}>
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
  async function exportCsv(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await post("/api/staff/reports", {
        action: "EXPORT_CSV",
        reportCode,
        rangeStart,
        rangeEnd,
      });
      const url = result.downloadUrl ?? result.url;
      setNotice({
        tone: "success",
        message: "Export CSV privacy-safe berhasil dibuat.",
      });
      if (url) window.location.assign(String(url));
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
        </div>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Export CSV</h2>
        </div>
        <form className={styles.staffForm} onSubmit={exportCsv}>
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
          <button className={styles.primaryButton}>Buat export</button>
        </form>
      </section>
    </div>
  );
}
