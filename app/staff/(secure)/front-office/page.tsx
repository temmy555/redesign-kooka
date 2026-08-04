import { getActivePermissionCodes } from "../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";
import FrontOfficeDesk from "../../_components/FrontOfficeDesk";
import styles from "../../staff.module.css";

export const dynamic = "force-dynamic";

export default async function FrontOfficePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    reservationRoomId?: string;
    action?: string;
  }>;
}) {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  const permissions = await getActivePermissionCodes(
    session.user.id,
    propertyId,
  );
  if (
    !permissions.has("booking.manage") ||
    !permissions.has("payment.manage") ||
    !permissions.has("stay.manage")
  )
    return (
      <section className={styles.accessState}>
        <h1>Akses dibatasi</h1>
        <p>Akun Anda belum memiliki rangkaian permission Front Office.</p>
      </section>
    );
  const { tab, reservationRoomId, action } = await searchParams;
  return (
    <FrontOfficeDesk
      initialStayAction={action}
      initialReservationRoomId={reservationRoomId}
      initialTab={tab}
    />
  );
}
