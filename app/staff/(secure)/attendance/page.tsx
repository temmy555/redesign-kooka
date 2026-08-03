import { getActivePermissionCodes } from "../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";
import AttendanceWorkspace from "../../_components/AttendanceWorkspace";
import styles from "../../staff.module.css";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  const permissions = await getActivePermissionCodes(
    session.user.id,
    propertyId,
  );

  if (!permissions.has("attendance.self.view"))
    return (
      <section className={styles.accessState}>
        <h1>Akses dibatasi</h1>
        <p>Akun Anda tidak memiliki permission absensi.</p>
      </section>
    );

  return (
    <AttendanceWorkspace
      canViewReport={
        permissions.has("attendance.report.view") ||
        permissions.has("report.view")
      }
      employeeName={session.user.name}
    />
  );
}
