"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import KookaLogo from "../../KookaLogo";
import { authClient } from "../../../src/platform/auth-client";
import styles from "../staff.module.css";

interface NavigationItem {
  href: string;
  label: string;
  short: string;
  permissions?: string[];
}

const navigation: NavigationItem[] = [
  { href: "/staff", label: "Hari ini", short: "HT" },
  {
    href: "/staff/front-office",
    label: "Front Office",
    short: "FO",
    permissions: ["booking.manage", "payment.manage", "stay.manage"],
  },
  {
    href: "/staff/rooms",
    label: "Pantauan kamar",
    short: "PK",
    permissions: ["room.board.view", "stay.manage"],
  },
  {
    href: "/staff/housekeeping",
    label: "Housekeeping",
    short: "HK",
    permissions: ["housekeeping.task.manage"],
  },
  {
    href: "/staff/fnb",
    label: "F&B",
    short: "FB",
    permissions: ["fnb.order.manage"],
  },
  {
    href: "/staff/attendance",
    label: "Absensi",
    short: "AB",
    permissions: ["attendance.self.view"],
  },
  {
    href: "/staff/admin",
    label: "Pengaturan",
    short: "AT",
    permissions: [
      "configuration.view",
      "room_master.view",
      "commercial.view",
      "cms.content.view",
      "identity.role.manage",
      "attendance.location.view",
      "attendance.report.view",
      "report.view",
      "audit.view",
    ],
  },
  {
    href: "/staff/test-guide",
    label: "Panduan test",
    short: "PT",
  },
];

export function allowedNavigation(
  permissionCodes: string[],
  items: NavigationItem[] = navigation,
) {
  const granted = new Set(permissionCodes);
  return items.filter(
    (item) =>
      !item.permissions || item.permissions.some((code) => granted.has(code)),
  );
}

export default function StaffShell({
  children,
  user,
  permissions,
}: {
  children: ReactNode;
  user: { name: string; email: string };
  permissions: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const items = allowedNavigation(permissions);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/staff/login");
    router.refresh();
  }

  return (
    <div className={styles.staffApp}>
      <a className={styles.skipLink} href="#staff-main">
        Lewati ke konten utama
      </a>
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarBrand}>
          <KookaLogo className={styles.sidebarLogo} priority sizes="166px" />
        </div>
        <nav aria-label="Navigasi staf" className={styles.staffNav}>
          <span className={styles.navSection}>Operasional</span>
          {items.map((item) => {
            const active =
              item.href === "/staff"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? styles.navActive : ""}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                <span>{item.short}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarBottom}>
          <Link href="/" target="_blank">
            Buka website publik <span>↗</span>
          </Link>
          <div className={styles.userCard}>
            <span className={styles.userAvatar}>
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button disabled={signingOut} onClick={signOut} type="button">
            {signingOut ? "Keluar…" : "Keluar dari akun"}
          </button>
        </div>
      </aside>
      {open ? (
        <button
          aria-label="Tutup navigasi"
          className={styles.backdrop}
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}
      <div className={styles.staffWorkspace}>
        <header className={styles.mobileHeader}>
          <button
            aria-expanded={open}
            aria-label="Buka navigasi"
            onClick={() => setOpen(true)}
            type="button"
          >
            ☰
          </button>
          <strong>KOOKA Operations</strong>
          <span className={styles.userAvatar}>
            {user.name.slice(0, 1).toUpperCase()}
          </span>
        </header>
        <main className={styles.staffMain} id="staff-main">
          {children}
        </main>
      </div>
    </div>
  );
}
