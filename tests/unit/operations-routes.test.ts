import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  getRoomBoard: vi.fn(),
  assignRoom: vi.fn(),
  blockRoom: vi.fn(),
  moveRoom: vi.fn(),
  transitionStay: vi.fn(),
  recordCheckinCapture: vi.fn(),
  decideStayTiming: vi.fn(),
  getFolio: vi.fn(),
  postFolioEntry: vi.fn(),
  reverseFolioEntry: vi.fn(),
  issueFinancialDocument: vi.fn(),
  allocatePayment: vi.fn(),
  requestManualRefund: vi.fn(),
  completeManualRefund: vi.fn(),
  getOperationsQueues: vi.fn(),
  createCleaningTask: vi.fn(),
  transitionCleaningTask: vi.fn(),
  updateRoomReadiness: vi.fn(),
  generateDailyCleaningTasks: vi.fn(),
  createMaintenanceIssue: vi.fn(),
  transitionMaintenanceIssue: vi.fn(),
  assessDamage: vi.fn(),
  recordLostFoundItem: vi.fn(),
  claimLostFoundItem: vi.fn(),
}));

vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/modules/operations/room-service", () => ({
  getRoomBoard: mocks.getRoomBoard,
  assignRoom: mocks.assignRoom,
  blockRoom: mocks.blockRoom,
  moveRoom: mocks.moveRoom,
}));
vi.mock("../../src/modules/operations/stay-service", () => ({
  transitionStay: mocks.transitionStay,
  recordCheckinCapture: mocks.recordCheckinCapture,
  decideStayTiming: mocks.decideStayTiming,
}));
vi.mock("../../src/modules/operations/finance-service", () => ({
  getFolio: mocks.getFolio,
  postFolioEntry: mocks.postFolioEntry,
  reverseFolioEntry: mocks.reverseFolioEntry,
  issueFinancialDocument: mocks.issueFinancialDocument,
  allocatePayment: mocks.allocatePayment,
  requestManualRefund: mocks.requestManualRefund,
  completeManualRefund: mocks.completeManualRefund,
}));
vi.mock("../../src/modules/operations/property-service", () => ({
  getOperationsQueues: mocks.getOperationsQueues,
  createCleaningTask: mocks.createCleaningTask,
  transitionCleaningTask: mocks.transitionCleaningTask,
  updateRoomReadiness: mocks.updateRoomReadiness,
  generateDailyCleaningTasks: mocks.generateDailyCleaningTasks,
  createMaintenanceIssue: mocks.createMaintenanceIssue,
  transitionMaintenanceIssue: mocks.transitionMaintenanceIssue,
  assessDamage: mocks.assessDamage,
  recordLostFoundItem: mocks.recordLostFoundItem,
  claimLostFoundItem: mocks.claimLostFoundItem,
}));

import {
  GET as roomBoardGet,
  POST as roomBoardPost,
} from "../../app/api/staff/room-board/route";
import { POST as stayPost } from "../../app/api/staff/stays/route";
import {
  GET as folioGet,
  POST as folioPost,
} from "../../app/api/staff/folios/route";
import {
  GET as operationsGet,
  POST as operationsPost,
} from "../../app/api/staff/operations/route";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const U4 = "44444444-4444-4444-a444-444444444444";

function request(path: string, body: unknown, key = "test-idempotency-key") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("Batch 3 staff routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
      mock.mockResolvedValue({ ok: true });
    }
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: U1 } });
    mocks.getActivePropertyId.mockResolvedValue(U2);
  });

  it("returns the room board and supports shared display masking mode", async () => {
    const response = await roomBoardGet(
      new Request("http://localhost/api/staff/room-board?display=shared"),
    );
    expect(response.status).toBe(200);
    expect(mocks.getRoomBoard).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: U2, sharedDisplay: true }),
    );
  });

  it.each([
    [
      "ASSIGN",
      {
        action: "ASSIGN",
        reservationRoomId: U1,
        roomUnitId: U2,
        reason: "Assigned for arrival",
      },
      "assignRoom",
    ],
    [
      "BLOCK",
      {
        action: "BLOCK",
        roomUnitId: U2,
        blockType: "MAINTENANCE",
        startsOn: "2026-08-03",
        endsOn: "2026-08-04",
        reason: "Air conditioner repair",
        sourceType: "MAINTENANCE",
        sourceId: U3,
      },
      "blockRoom",
    ],
    [
      "MOVE",
      {
        action: "MOVE",
        roomStayId: U1,
        toRoomUnitId: U2,
        effectiveOn: "2026-08-03",
        reason: "Guest requested a quieter room",
        priceTreatment: "NO_CHANGE",
        priceAdjustmentIdr: 0,
        incidentalNoCharge: true,
      },
      "moveRoom",
    ],
  ])("dispatches room action %s", async (_action, body, service) => {
    const response = await roomBoardPost(
      request("/api/staff/room-board", body),
    );
    expect(response.status).toBe(201);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "CHECK_IN",
      {
        action: "CHECK_IN",
        roomStayId: U1,
        reason: "Guest arrived at front office",
        overrideReadiness: false,
      },
      "transitionStay",
    ],
    [
      "CAPTURE_CHECKIN",
      {
        action: "CAPTURE_CHECKIN",
        reservationRoomId: U1,
        guestId: U2,
        captureType: "SIGNATURE",
        outcome: "CAPTURED",
        fileId: U3,
        reason: "Guest consented",
      },
      "recordCheckinCapture",
    ],
    [
      "TIMING_DECISION",
      {
        action: "TIMING_DECISION",
        roomStayId: U1,
        decision: "APPROVE_LATE_CHECKOUT",
        approvedUntil: "2026-08-03T08:00:00.000Z",
        reason: "Room remains available",
      },
      "decideStayTiming",
    ],
  ])("dispatches stay action %s", async (_action, body, service) => {
    const response = await stayPost(request("/api/staff/stays", body));
    expect(response.status).toBe(body.action === "CAPTURE_CHECKIN" ? 201 : 200);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("returns one folio from a validated query", async () => {
    const response = await folioGet(
      new Request(`http://localhost/api/staff/folios?folioId=${U1}`),
    );
    expect(response.status).toBe(200);
    expect(mocks.getFolio).toHaveBeenCalledWith(
      expect.objectContaining({ folioId: U1, propertyId: U2 }),
    );
  });

  it.each([
    [
      "POST_ENTRY",
      {
        action: "POST_ENTRY",
        folioId: U1,
        entryType: "DEBIT",
        category: "DAMAGE",
        description: "Broken lamp",
        sourceType: "DAMAGE_INCIDENT",
        sourceId: U2,
        serviceDate: "2026-08-03",
        quantity: 1,
        unitAmountIdr: 100000,
        netAmountIdr: 100000,
        discountAmountIdr: 0,
        serviceChargeAmountIdr: 0,
        taxAmountIdr: 0,
        totalAmountIdr: 100000,
        reason: "Damage assessment",
      },
      "postFolioEntry",
    ],
    [
      "REVERSE_ENTRY",
      {
        action: "REVERSE_ENTRY",
        folioEntryId: U1,
        serviceDate: "2026-08-03",
        reason: "Incorrect charge",
      },
      "reverseFolioEntry",
    ],
    [
      "ISSUE_DOCUMENT",
      {
        action: "ISSUE_DOCUMENT",
        folioId: U1,
        documentType: "INVOICE",
        scope: "COMBINED",
        recipientName: "Budi Santoso",
        recipientEmail: "budi@example.com",
        language: "id",
      },
      "issueFinancialDocument",
    ],
    [
      "ALLOCATE_PAYMENT",
      {
        action: "ALLOCATE_PAYMENT",
        paymentId: U1,
        documentId: U2,
        amountIdr: 500000,
      },
      "allocatePayment",
    ],
    [
      "REQUEST_REFUND",
      {
        action: "REQUEST_REFUND",
        folioId: U1,
        amountIdr: 100000,
        reason: "Approved cancellation adjustment",
        destination: "BCA 1234567890",
      },
      "requestManualRefund",
    ],
    [
      "COMPLETE_REFUND",
      {
        action: "COMPLETE_REFUND",
        refundId: U1,
        result: "REFUNDED",
        transferReference: "TRX-001",
        proofFileId: U2,
        serviceDate: "2026-08-03",
      },
      "completeManualRefund",
    ],
  ])("dispatches folio action %s", async (_action, body, service) => {
    const response = await folioPost(request("/api/staff/folios", body));
    expect(response.status).toBe(body.action === "COMPLETE_REFUND" ? 200 : 201);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("returns the property operations queues", async () => {
    const response = await operationsGet();
    expect(response.status).toBe(200);
    expect(mocks.getOperationsQueues).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "CREATE_CLEANING",
      {
        action: "CREATE_CLEANING",
        roomUnitId: U1,
        roomStayId: U2,
        taskType: "GUEST_REQUEST",
        priority: "NORMAL",
        entryPermission: "GRANTED",
        notes: "Guest is away and requested cleaning",
      },
      "createCleaningTask",
    ],
    [
      "TRANSITION_CLEANING",
      {
        action: "TRANSITION_CLEANING",
        cleaningTaskId: U1,
        toStatus: "IN_PROGRESS",
        reasonCode: "GUEST_AWAY_REQUEST",
        reason: "Guest gave permission",
      },
      "transitionCleaningTask",
    ],
    [
      "QUICK_ROOM_STATUS",
      {
        action: "QUICK_ROOM_STATUS",
        roomUnitId: U1,
        operation: "MARK_READY",
      },
      "updateRoomReadiness",
    ],
    [
      "GENERATE_DAILY_CLEANING",
      { action: "GENERATE_DAILY_CLEANING", businessDate: "2026-08-03" },
      "generateDailyCleaningTasks",
    ],
    [
      "CREATE_MAINTENANCE",
      {
        action: "CREATE_MAINTENANCE",
        roomUnitId: U1,
        category: "AIR_CONDITIONING",
        severity: "HIGH",
        title: "AC not cooling",
        description: "Room AC requires inspection",
        serviceabilityImpact: "BLOCKED",
      },
      "createMaintenanceIssue",
    ],
    [
      "TRANSITION_MAINTENANCE",
      {
        action: "TRANSITION_MAINTENANCE",
        maintenanceIssueId: U1,
        toStatus: "VERIFIED",
        notes: "Repair inspected successfully",
        returnToService: true,
      },
      "transitionMaintenanceIssue",
    ],
    [
      "ASSESS_DAMAGE",
      {
        action: "ASSESS_DAMAGE",
        reservationId: U1,
        roomStayId: U2,
        roomUnitId: U3,
        catalogVersionId: U4,
        description: "Broken bedside lamp",
        decision: "APPROVED",
        amountIdr: 150000,
        reason: "Verified during checkout",
        serviceDate: "2026-08-03",
      },
      "assessDamage",
    ],
    [
      "RECORD_LOST_FOUND",
      {
        action: "RECORD_LOST_FOUND",
        category: "ELECTRONICS",
        description: "Black phone charger",
        foundAt: "2026-08-03T05:00:00.000Z",
        foundLocation: "Room 1",
        roomUnitId: U1,
        storageLocation: "Front Office Locker A",
        highValue: false,
      },
      "recordLostFoundItem",
    ],
    [
      "CLAIM_LOST_FOUND",
      {
        action: "CLAIM_LOST_FOUND",
        itemId: U1,
        claimantName: "Budi Santoso",
        claimantContact: "+628123456789",
        verificationDetails: { bookingCodeLast4: "ABCD" },
        decision: "VERIFIED",
        decisionReason: "Booking and description matched",
      },
      "claimLostFoundItem",
    ],
  ])("dispatches property action %s", async (_action, body, service) => {
    const response = await operationsPost(
      request("/api/staff/operations", body),
    );
    expect([200, 201]).toContain(response.status);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("rejects mutation requests without idempotency keys", async () => {
    const response = await roomBoardPost(
      request(
        "/api/staff/room-board",
        {
          action: "ASSIGN",
          reservationRoomId: U1,
          roomUnitId: U2,
          reason: "Arrival assignment",
        },
        "",
      ),
    );
    expect(response.status).toBe(400);
    expect(mocks.assignRoom).not.toHaveBeenCalled();
  });

  it("returns generic validation errors for malformed requests", async () => {
    const [stay, folio, operation] = await Promise.all([
      stayPost(request("/api/staff/stays", { action: "CHECK_IN" })),
      folioPost(request("/api/staff/folios", { action: "POST_ENTRY" })),
      operationsPost(
        request("/api/staff/operations", { action: "CREATE_CLEANING" }),
      ),
    ]);
    expect([stay.status, folio.status, operation.status]).toEqual([
      400, 400, 400,
    ]);
  });
});
