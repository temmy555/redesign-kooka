import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import KookaLogo from "../KookaLogo";
import {
  isMaintenanceModeEnabled,
  isMaintenancePreviewConfigured,
  isValidMaintenancePreviewToken,
  MAINTENANCE_PREVIEW_COOKIE,
  maintenancePreviewDurationSeconds,
} from "../../src/platform/maintenance-preview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer Preview",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MaintenancePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  if (!isMaintenanceModeEnabled()) redirect("/");

  const cookieStore = await cookies();
  if (
    isValidMaintenancePreviewToken(
      cookieStore.get(MAINTENANCE_PREVIEW_COOKIE)?.value,
    )
  ) {
    redirect("/");
  }

  const query = searchParams ? await searchParams : undefined;
  const configured = isMaintenancePreviewConfigured();
  const durationHours = Math.round(maintenancePreviewDurationSeconds() / 3600);
  const invalid = query?.error === "invalid";
  const limited = query?.error === "limited";

  return (
    <main className="maintenance-preview-page">
      <section className="maintenance-preview-card">
        <KookaLogo
          className="maintenance-preview-logo"
          priority
          sizes="172px"
        />
        <p className="maintenance-preview-eyebrow">Protected preview</p>
        <h1>Review the production website.</h1>
        <p className="maintenance-preview-copy">
          This access is reserved for the KOOKA development team. Public
          visitors will continue to see the maintenance page.
        </p>

        {!configured ? (
          <div className="maintenance-preview-notice" role="alert">
            Preview access has not been configured on this server.
          </div>
        ) : (
          <form
            action="/api/maintenance-preview/login"
            className="maintenance-preview-form"
            method="post"
          >
            <label htmlFor="maintenance-preview-password">
              Preview password
            </label>
            <input
              autoComplete="current-password"
              autoFocus
              id="maintenance-preview-password"
              minLength={8}
              name="password"
              required
              type="password"
            />
            {invalid ? (
              <p className="maintenance-preview-error" role="alert">
                The preview password is not correct.
              </p>
            ) : null}
            {limited ? (
              <p className="maintenance-preview-error" role="alert">
                Too many attempts. Please wait 15 minutes before trying again.
              </p>
            ) : null}
            <button type="submit">Open production preview</button>
          </form>
        )}

        <p className="maintenance-preview-footnote">
          Access expires automatically after {durationHours} hour
          {durationHours === 1 ? "" : "s"}.
        </p>
      </section>
    </main>
  );
}
