import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // See tests/setup/server-only-noop.ts for why this alias exists:
      // the real `server-only` package throws unconditionally outside of
      // Next.js's own webpack build, which would break every test that
      // imports a server-only platform module.
      "server-only": fileURLToPath(
        new URL("./tests/setup/server-only-noop.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "app/**/*.{ts,tsx}",
        "src/jobs/**/*.{ts,tsx}",
        "src/modules/**/*.{ts,tsx}",
        "src/platform/**/*.{ts,tsx}",
        "src/storage/**/*.{ts,tsx}",
      ],
      // These browser workspaces are exercised through SSR smoke tests here
      // and through the role/device UAT matrix. Event-heavy canvas, camera,
      // file-picker, and form state require a real browser; counting them in
      // the Node coverage denominator would reward mocks instead of testing
      // the actual interaction contract.
      exclude: [
        "app/PublicFormControls.tsx",
        "app/booking/BookingResults.tsx",
        "app/booking/lookup/BookingLookup.tsx",
        "app/staff/_components/AdminWorkspace.tsx",
        "app/staff/_components/FrontOfficeDesk.tsx",
        "app/staff/_components/FnbActions.tsx",
        "app/staff/_components/HousekeepingActions.tsx",
        "app/staff/_components/SignaturePad.tsx",
        "app/staff/_components/FormControls.tsx",
        "app/staff/_components/TestGuide.tsx",
      ],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
