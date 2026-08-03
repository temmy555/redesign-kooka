import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentSession } from "../../../src/platform/session";
import LoginForm from "./LoginForm";
import { safeStaffDestination } from "./login-utils";
import styles from "../staff.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login Staf",
  robots: { index: false, follow: false },
};

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const query = searchParams ? await searchParams : undefined;
  const destination = safeStaffDestination(query?.next);
  let currentSession = null;

  try {
    currentSession = await getCurrentSession();
  } catch {
    // Login must remain renderable when no session exists. Authentication
    // errors are handled by the credential form without exposing details.
  }

  if (currentSession) redirect(destination);

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginVisual} aria-hidden="true">
        <div className={styles.loginVisualShade} />
        <div className={styles.loginQuote}>
          <span>Urban Tropical Retreat</span>
          <blockquote>Tenang untuk tamu. Jelas untuk tim.</blockquote>
          <p>Operasional harian KOOKA Residence Surabaya</p>
        </div>
      </section>
      <section className={styles.loginPanel}>
        <LoginForm destination={destination} />
      </section>
    </main>
  );
}
