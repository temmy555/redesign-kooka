import { describe, expect, it } from "vitest";

import {
  cleaningTaskActionLabel,
  nextCleaningTaskStatus,
} from "../../app/staff/_components/HousekeepingActions";

describe("housekeeping task controls", () => {
  it.each(["REQUESTED", "ASSIGNED", "DEFERRED", "UNABLE_TO_ACCESS"])(
    "starts %s tasks through the cleaning workflow",
    (status) => {
      expect(nextCleaningTaskStatus(status)).toBe("IN_PROGRESS");
      expect(cleaningTaskActionLabel(status)).toBe("Mulai bersihkan");
    },
  );

  it("moves an active cleaning task to cleaned", () => {
    expect(nextCleaningTaskStatus("IN_PROGRESS")).toBe("CLEANED");
    expect(cleaningTaskActionLabel("IN_PROGRESS")).toBe(
      "Tandai selesai dibersihkan",
    );
  });

  it("closes a cleaned task after inspection", () => {
    expect(nextCleaningTaskStatus("CLEANED")).toBe("INSPECTED");
    expect(cleaningTaskActionLabel("CLEANED")).toBe("Tandai sudah diperiksa");
  });
});
