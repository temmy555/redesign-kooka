import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/staff",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import DashboardView, {
  formatIdr,
  type DashboardData,
} from "../../app/staff/_components/DashboardView";
import AdminWorkspace from "../../app/staff/_components/AdminWorkspace";
import {
  attendanceCameraLabel,
  shouldUseAttendanceCamera,
} from "../../app/staff/_components/AttendanceWorkspace";
import FnbActions from "../../app/staff/_components/FnbActions";
import {
  DateField,
  FileField,
  KookaSelect,
  MoneyInput,
  nextDate,
} from "../../app/staff/_components/FormControls";
import FrontOfficeDesk, {
  assignableRooms,
  bookingPaymentDescription,
  folioBookingDescription,
  human,
  isActiveReservationRoom,
  manualBookingDefaults,
} from "../../app/staff/_components/FrontOfficeDesk";
import RoomMonitor, {
  filterRooms,
  type RoomBoardData,
} from "../../app/staff/_components/RoomMonitor";
import { allowedNavigation } from "../../app/staff/_components/StaffShell";
import { safeStaffDestination } from "../../app/staff/login/login-utils";

const U1 = "11111111-1111-4111-a111-111111111111";

const dashboard: DashboardData = {
  metadata: {
    timezone: "Asia/Jakarta",
    businessDate: "2026-08-02",
    dataAsOf: "2026-08-02T01:00:00.000Z",
    currency: "IDR",
  },
  summary: {
    physical_rooms: 15,
    occupied_rooms: 9,
    occupancyPercent: 60,
    outstanding_idr: 500_000,
  },
  queues: {
    ARRIVAL: [
      {
        queueType: "ARRIVAL",
        entityId: U1,
        bookingCode: "KR-001",
        roomNumber: "1",
        guestName: "Budi Santoso",
        status: "DUE_IN",
        scheduledAt: "2026-08-02T07:00:00.000Z",
        amountIdr: null,
        alert: null,
      },
    ],
    DEPARTURE: [],
    UNASSIGNED: [],
    PAYMENT_REVIEW: [],
  },
  reconciliation: { openCount: 0, criticalCount: 0, exceptions: [] },
};

const roomBoard: RoomBoardData = {
  generatedAt: "2026-08-02T01:00:00.000Z",
  staleAfterSeconds: 60,
  sharedDisplay: false,
  rooms: [
    {
      roomUnitId: U1,
      roomNumber: "1",
      roomTypeId: U1,
      occupancyStatus: "OCCUPIED",
      housekeepingStatus: "INSPECTED",
      serviceabilityStatus: "IN_SERVICE",
      roomStayId: U1,
      stayStatus: "IN_HOUSE",
      bookingCode: "KR-001",
      guestName: "Budi Santoso",
      nextArrivalAt: null,
      nextArrivalBookingCode: null,
      nextArrivalGuestName: null,
      updatedAt: "2026-08-02T01:00:00.000Z",
    },
    {
      roomUnitId: "22222222-2222-4222-a222-222222222222",
      roomNumber: "2",
      roomTypeId: U1,
      occupancyStatus: "VACANT",
      housekeepingStatus: "INSPECTED",
      serviceabilityStatus: "IN_SERVICE",
      roomStayId: null,
      stayStatus: null,
      bookingCode: null,
      guestName: null,
      nextArrivalAt: "2026-08-02T07:00:00.000Z",
      nextArrivalBookingCode: "KR-002",
      nextArrivalGuestName: "Sari Wijaya",
      updatedAt: "2026-08-02T01:00:00.000Z",
    },
  ],
};

describe("Step 22A staff UI", () => {
  it("runs the attendance camera only while the selfie step is active", () => {
    expect(shouldUseAttendanceCamera("clock", "not_started", false)).toBe(true);
    expect(shouldUseAttendanceCamera("clock", "working", false)).toBe(true);
    expect(shouldUseAttendanceCamera("history", "working", false)).toBe(false);
    expect(shouldUseAttendanceCamera("report", "working", false)).toBe(false);
    expect(shouldUseAttendanceCamera("clock", "finished", false)).toBe(false);
    expect(shouldUseAttendanceCamera("clock", "working", true)).toBe(false);
    expect(attendanceCameraLabel("paused", false)).toBe("Kamera dijeda");
    expect(attendanceCameraLabel("ready", true)).toBe("Foto siap");
  });

  it("only renders navigation allowed by named permissions", () => {
    expect(
      allowedNavigation(["fnb.order.manage"]).map((item) => item.href),
    ).toEqual(["/staff", "/staff/fnb"]);
    expect(
      allowedNavigation(["stay.manage", "housekeeping.task.manage"]).map(
        (item) => item.href,
      ),
    ).toEqual([
      "/staff",
      "/staff/front-office",
      "/staff/rooms",
      "/staff/housekeeping",
    ]);
    expect(
      allowedNavigation(["configuration.view", "identity.role.manage"]).map(
        (item) => item.href,
      ),
    ).toEqual(["/staff", "/staff/admin"]);
    expect(
      allowedNavigation(["attendance.self.view"]).map((item) => item.href),
    ).toEqual(["/staff", "/staff/attendance"]);
  });

  it("renders structured Batch 7 workspaces without a JSON editor", () => {
    const frontOffice = renderToStaticMarkup(<FrontOfficeDesk />);
    const admin = renderToStaticMarkup(
      <AdminWorkspace
        permissions={[
          "configuration.view",
          "room_master.view",
          "commercial.view",
          "cms.content.view",
          "identity.employee.manage",
          "audit.view",
          "report.view",
        ]}
      />,
    );
    expect(frontOffice).toContain("Front Office");
    expect(frontOffice).toContain("Booking manual / multi-room");
    expect(frontOffice).not.toContain("JSON");
    expect(admin).toContain("Pengaturan");
    expect(admin).toContain("Profil properti");
    expect(admin).not.toContain("JSON");
  });

  it("renders KOOKA form controls without native date/select chrome", () => {
    const date = renderToStaticMarkup(
      <DateField ariaLabel="Check-in" onChange={vi.fn()} value="2026-08-02" />,
    );
    const select = renderToStaticMarkup(
      <KookaSelect
        ariaLabel="Tipe kamar"
        onChange={vi.fn()}
        options={[{ value: U1, label: "Deluxe" }]}
        placeholder="Pilih tipe kamar"
        value=""
      />,
    );
    expect(date).toContain("2 Agustus 2026");
    expect(date).not.toContain('type="date"');
    expect(select).toContain("Pilih tipe kamar");
    expect(select).not.toContain("<select");
    expect(nextDate("2026-08-31")).toBe("2026-09-01");
  });

  it("handles a booking room that has not been allocated yet", () => {
    expect(human(null)).toBe("belum tersedia");
    expect(human(undefined, "belum dialokasikan")).toBe("belum dialokasikan");
    expect(human("DUE_IN")).toBe("due in");
  });

  it("removes a checked-out room line from the active multi-room desk", () => {
    expect(isActiveReservationRoom({ lineStatus: "ACTIVE" })).toBe(true);
    expect(isActiveReservationRoom({ lineStatus: "COMPLETED" })).toBe(false);
    expect(isActiveReservationRoom({ lineStatus: "CANCELLED" })).toBe(false);
  });

  it("resets every manual-booking field after a successful reservation", () => {
    expect(manualBookingDefaults("2026-08-04")).toEqual({
      checkInDate: "2026-08-04",
      checkoutDate: "2026-08-05",
      ratePlanCode: "",
      rooms: [
        {
          roomTypeId: "",
          adults: 1,
          children: 0,
          infants: 0,
          extraBedQuantity: 0,
        },
      ],
      bookerName: "",
      bookerEmail: "",
      bookerPhone: "",
      paymentMode: "FULL",
      depositValue: "",
      notes: "",
    });
  });

  it("shows allocated physical room numbers in folio booking choices", () => {
    expect(
      folioBookingDescription({
        requiredPaymentIdr: "450000",
        folioChargeTotalIdr: "999000",
        verifiedPaymentIdr: "999000",
        folioBalanceIdr: "0",
        rooms: [{ roomNumber: "10" }, { roomNumber: "2" }, { roomNumber: "2" }],
      }),
    ).toBe("Lunas Rp\u00a0999.000 · Kamar 2, 10");
    expect(
      folioBookingDescription({
        requiredPaymentIdr: "450000",
        folioChargeTotalIdr: "999000",
        verifiedPaymentIdr: "300000",
        folioBalanceIdr: "699000",
        rooms: [{ roomNumber: null }],
      }),
    ).toBe("Sisa Rp\u00a0699.000 · Belum dialokasikan");
    expect(
      bookingPaymentDescription({
        folioChargeTotalIdr: "999000",
        verifiedPaymentIdr: "999000",
        folioBalanceIdr: "0",
      }),
    ).toBe("Lunas · Dibayar Rp\u00a0999.000");
  });

  it("offers only compatible rooms that are free for the complete stay", () => {
    const rooms = assignableRooms(
      {
        roomTypes: [],
        roomUnits: [
          {
            id: "room-free",
            roomNumber: "1",
            roomTypeId: U1,
            status: "ACTIVE",
            serviceabilityStatus: "IN_SERVICE",
            unavailableDates: [],
          },
          {
            id: "room-busy",
            roomNumber: "2",
            roomTypeId: U1,
            status: "ACTIVE",
            serviceabilityStatus: "IN_SERVICE",
            unavailableDates: ["2026-08-03"],
          },
          {
            id: "wrong-type",
            roomNumber: "3",
            roomTypeId: "22222222-2222-4222-a222-222222222222",
            status: "ACTIVE",
            serviceabilityStatus: "IN_SERVICE",
            unavailableDates: [],
          },
        ],
      },
      U1,
      "2026-08-03",
      "2026-08-05",
    );
    expect(rooms.map((room) => room.id)).toEqual(["room-free"]);
  });

  it("renders styled money, upload, and F&B controls", () => {
    const money = renderToStaticMarkup(
      <MoneyInput ariaLabel="Nominal IDR" onChange={vi.fn()} value="1500000" />,
    );
    const databaseMoney = renderToStaticMarkup(
      <MoneyInput
        ariaLabel="Harga dari database"
        onChange={vi.fn()}
        value="450000.00"
      />,
    );
    const upload = renderToStaticMarkup(
      <FileField
        accept="image/jpeg"
        file={null}
        label="Foto identitas"
        onChange={vi.fn()}
      />,
    );
    const fnb = renderToStaticMarkup(<FnbActions orders={[]} />);
    expect(money).toContain("1.500.000");
    expect(money).toContain('inputMode="numeric"');
    expect(money).not.toContain('type="number"');
    expect(databaseMoney).toContain("450.000");
    expect(databaseMoney).not.toContain("45.000.000");
    expect(upload).toContain("Pilih file");
    expect(upload).toContain("Belum ada file dipilih");
    expect(fnb).not.toContain("<select");
    expect(fnb).not.toContain('type="number"');
    expect(fnb).toContain("Bebankan ke kamar");
    expect(fnb).toContain("Dibuat otomatis saat disimpan");
    expect(fnb).toContain("26080301");
    expect(fnb).toContain("Tambahkan semua menu dalam satu pesanan");
    expect(fnb).toContain("+ Tambahkan menu");
  });

  it("prevents an external login redirect", () => {
    expect(safeStaffDestination("/staff/rooms")).toBe("/staff/rooms");
    expect(safeStaffDestination("//evil.example")).toBe("/staff");
    expect(safeStaffDestination("https://evil.example")).toBe("/staff");
    expect(safeStaffDestination(undefined)).toBe("/staff");
  });

  it("renders a source-backed daily dashboard with official IDR", () => {
    const html = renderToStaticMarkup(
      <DashboardView initialData={dashboard} />,
    );
    expect(html).toContain("Business date");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("KR-001");
    expect(html).toContain("500.000");
    expect(html).toContain('href="/staff/rooms"');
    expect(html).toContain('href="/staff/front-office?tab=stay"');
    expect(html).toContain('href="/staff/front-office?tab=folio"');
    expect(html).toContain("Proses kedatangan");
    expect(html).toContain("Lihat tagihan dan pelunasan");
    expect(formatIdr(0)).toContain("Rp");
    expect(formatIdr(undefined)).toContain("0");
  });

  it("renders dashboard alert, missing-time, and invalid-time fallbacks", () => {
    const variant: DashboardData = {
      ...dashboard,
      summary: { occupancyPercent: 0 },
      queues: {
        ARRIVAL: [
          {
            queueType: "ARRIVAL",
            entityId: U1,
            bookingCode: null,
            roomNumber: null,
            guestName: null,
            status: "NO_SHOW",
            scheduledAt: null,
            amountIdr: null,
            alert: "ROOM_UNASSIGNED",
          },
          {
            queueType: "ARRIVAL",
            entityId: "33333333-3333-4333-a333-333333333333",
            bookingCode: "KR-INVALID",
            roomNumber: null,
            guestName: null,
            status: "DUE_IN",
            scheduledAt: "not-a-date",
            amountIdr: null,
            alert: null,
          },
        ],
        UNASSIGNED: [
          {
            queueType: "UNASSIGNED",
            entityId: "22222222-2222-4222-a222-222222222222",
            bookingCode: "KR-002",
            roomNumber: null,
            guestName: "Sari",
            status: "DUE_IN",
            scheduledAt: null,
            amountIdr: null,
            alert: "ROOM_UNASSIGNED",
          },
        ],
        PAYMENT_REVIEW: [],
        DEPARTURE: [
          {
            queueType: "DEPARTURE",
            entityId: "44444444-4444-4444-a444-444444444444",
            bookingCode: "KR-OUTSTANDING",
            roomNumber: "1",
            guestName: "Tamu Belum Lunas",
            status: "DUE_OUT",
            scheduledAt: null,
            amountIdr: "120000",
            alert: "FOLIO_UNSETTLED",
          },
        ],
      },
      reconciliation: { openCount: 1, criticalCount: 1, exceptions: [] },
    };
    const html = renderToStaticMarkup(<DashboardView initialData={variant} />);
    expect(html).toContain("Tanpa nama");
    expect(html).toContain("Waktu belum ditentukan");
    expect(html).toContain("Waktu tidak valid");
    expect(html).toContain("Kamar belum dialokasikan");
    expect(html).toContain("Tagihan belum lunas");
    expect(html).toContain("Sisa tagihan Rp");
    expect(html).toContain("120.000");
    expect(html).toContain(
      "reservationRoomId=44444444-4444-4444-a444-444444444444",
    );
  });

  it("renders physical rooms and filters operational conditions", () => {
    const html = renderToStaticMarkup(
      <RoomMonitor
        canManageHousekeeping
        canViewGuestDetails
        initialData={roomBoard}
      />,
    );
    expect(html).toContain("Pantauan kamar");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("Tamu berikutnya");
    expect(html).toContain("Sari Wijaya");
    expect(html).toContain("Booking KR-002");
    expect(html).not.toContain("Housekeeping</span>");
    expect(html).not.toContain("Service</span>");
    expect(filterRooms(roomBoard.rooms, "OCCUPIED")).toHaveLength(1);
    expect(filterRooms(roomBoard.rooms, "READY")).toHaveLength(1);
    expect(filterRooms(roomBoard.rooms, "ALL")).toHaveLength(2);
  });

  it("never labels an occupied room as empty when a guest name is missing", () => {
    const occupiedWithoutName: RoomBoardData = {
      ...roomBoard,
      rooms: [{ ...roomBoard.rooms[0]!, guestName: null }],
    };
    const html = renderToStaticMarkup(
      <RoomMonitor
        canManageHousekeeping
        canViewGuestDetails
        initialData={occupiedWithoutName}
      />,
    );
    expect(html).toContain("Tamu sedang menginap");
    expect(html).not.toContain("Kamar kosong");
  });

  it("classifies cleaning, serviceability, and fallback room conditions", () => {
    const variants: RoomBoardData = {
      ...roomBoard,
      sharedDisplay: true,
      rooms: [
        {
          ...roomBoard.rooms[0]!,
          roomUnitId: U1,
          guestName: "B*** S***",
          serviceabilityStatus: "OUT_OF_ORDER",
          nextArrivalAt: "invalid",
        },
        {
          ...roomBoard.rooms[1]!,
          roomUnitId: "33333333-3333-4333-a333-333333333333",
          housekeepingStatus: "DIRTY",
          nextArrivalAt: null,
        },
        {
          ...roomBoard.rooms[1]!,
          roomUnitId: "44444444-4444-4444-a444-444444444444",
          housekeepingStatus: "UNKNOWN",
        },
      ],
    };
    const html = renderToStaticMarkup(
      <RoomMonitor
        canManageHousekeeping={false}
        canViewGuestDetails={false}
        initialData={variants}
      />,
    );
    expect(html).toContain("Nama tamu dimasking");
    expect(html).toContain("Jadwal tidak valid");
    expect(html).toContain("Tidak ada kedatangan terjadwal");
    expect(filterRooms(variants.rooms, "CLEANING")).toHaveLength(1);
    expect(filterRooms(variants.rooms, "ATTENTION")).toHaveLength(2);
  });

  it("renders an empty room-board state", () => {
    const html = renderToStaticMarkup(
      <RoomMonitor
        canManageHousekeeping={false}
        canViewGuestDetails={false}
        initialData={{ ...roomBoard, rooms: [], sharedDisplay: true }}
      />,
    );
    expect(html).toContain("Tidak ada kamar untuk filter");
  });
});
