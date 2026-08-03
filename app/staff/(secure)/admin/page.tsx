import { getActivePermissionCodes } from "../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";
import AdminWorkspace from "../../_components/AdminWorkspace";
import styles from "../../staff.module.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  const permissions = await getActivePermissionCodes(
    session.user.id,
    propertyId,
  );
  const canOpen = [
    "configuration.view",
    "room_master.view",
    "commercial.view",
    "cms.content.view",
    "identity.role.manage",
    "attendance.location.view",
    "attendance.report.view",
    "report.view",
    "audit.view",
  ].some((permission) => permissions.has(permission));
  if (!canOpen)
    return (
      <section className={styles.accessState}>
        <h1>Akses dibatasi</h1>
        <p>Akun Anda tidak memiliki permission administrasi.</p>
      </section>
    );
  return <AdminWorkspace permissions={[...permissions].sort()} />;
}
