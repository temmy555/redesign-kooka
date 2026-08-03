import { redirect } from "next/navigation";

import { getActivePermissionCodes } from "../../../src/platform/authorization";
import { getActivePropertyId } from "../../../src/platform/property";
import { getCurrentSession } from "../../../src/platform/session";
import StaffShell from "../_components/StaffShell";

export const dynamic = "force-dynamic";

export default async function SecureStaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/staff/login?next=/staff");
  const propertyId = await getActivePropertyId();
  const permissions = await getActivePermissionCodes(
    session.user.id,
    propertyId,
  );
  return (
    <StaffShell
      permissions={[...permissions].sort()}
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </StaffShell>
  );
}
