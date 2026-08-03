import { getActivePermissionCodes } from "../../../src/platform/authorization";
import { getActivePropertyId } from "../../../src/platform/property";
import { requireCurrentSession } from "../../../src/platform/session";
import { getOperationalDashboard } from "../../../src/modules/reporting/reporting-service";
import DashboardView, {
  type DashboardData,
} from "../_components/DashboardView";
import styles from "../staff.module.css";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  const permissions = await getActivePermissionCodes(
    session.user.id,
    propertyId,
  );
  if (permissions.has("report.view")) {
    const data = await getOperationalDashboard({ propertyId, session });
    return <DashboardView initialData={data as unknown as DashboardData} />;
  }
  const workspace = permissions.has("housekeeping.task.manage")
    ? {
        href: "/staff/housekeeping",
        title: "Housekeeping",
        body: "Lihat cleaning task dan kebutuhan maintenance hari ini.",
      }
    : permissions.has("fnb.order.manage")
      ? {
          href: "/staff/fnb",
          title: "F&B",
          body: "Lihat pesanan kertas dan status penyajian.",
        }
      : permissions.has("room.board.view")
        ? {
            href: "/staff/rooms",
            title: "Pantauan kamar",
            body: "Lihat status kamar yang aman untuk shared display.",
          }
        : null;
  return (
    <section className={styles.accessState}>
      <span className={styles.pageEyebrow}>Ruang kerja Anda</span>
      <h1>{workspace?.title ?? "Akses belum diberikan"}</h1>
      <p>
        {workspace?.body ??
          "Akun berhasil masuk, tetapi belum memiliki permission modul aktif. Hubungi Owner atau administrator."}
      </p>
      {workspace ? (
        <a className={styles.secondaryButton} href={workspace.href}>
          Buka modul
        </a>
      ) : (
        <p>Hubungi Owner untuk memeriksa penugasan role akun ini.</p>
      )}
    </section>
  );
}
