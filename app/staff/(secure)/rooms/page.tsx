import { getActivePermissionCodes } from "../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";
import { getRoomBoard } from "../../../../src/modules/operations/room-service";
import RoomMonitor, { type RoomBoardData } from "../../_components/RoomMonitor";
import styles from "../../staff.module.css";

export const dynamic = "force-dynamic";

export default async function StaffRoomsPage() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  const permissions = await getActivePermissionCodes(
    session.user.id,
    propertyId,
  );
  const allowed =
    permissions.has("stay.manage") || permissions.has("room.board.view");
  if (!allowed)
    return (
      <section className={styles.accessState}>
        <h1>Akses dibatasi</h1>
        <p>Akun Anda tidak memiliki permission untuk melihat pantauan kamar.</p>
      </section>
    );
  const canViewGuestDetails = permissions.has("stay.manage");
  const canManageHousekeeping = permissions.has("housekeeping.task.manage");
  const data = await getRoomBoard({
    propertyId,
    session,
    sharedDisplay: !canViewGuestDetails,
  });
  return (
    <RoomMonitor
      canManageHousekeeping={canManageHousekeeping}
      canViewGuestDetails={canViewGuestDetails}
      initialData={data as unknown as RoomBoardData}
    />
  );
}
