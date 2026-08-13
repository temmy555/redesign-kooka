import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import MaintenancePage from "../../app/maintenance/page";

const previousExpected = process.env.SITE_MAINTENANCE_EXPECTED;

afterEach(() => {
  if (previousExpected === undefined) {
    delete process.env.SITE_MAINTENANCE_EXPECTED;
  } else {
    process.env.SITE_MAINTENANCE_EXPECTED = previousExpected;
  }
});

describe("MaintenancePage", () => {
  it("shows the expected return information entirely in English", () => {
    process.env.SITE_MAINTENANCE_EXPECTED =
      "According to the maintenance schedule";

    const html = renderToStaticMarkup(<MaintenancePage />);

    expect(html).toContain("Expected to be available again:");
    expect(html).toContain("According to the maintenance schedule");
    expect(html).not.toContain("Diperkirakan aktif kembali");
  });
});
