import { getActivePermissionCodes } from "../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";
import { getOperationsQueues } from "../../../../src/modules/operations/property-service";
import HousekeepingActions from "../../_components/HousekeepingActions";
import styles from "../../staff.module.css";

export const dynamic = "force-dynamic";

function human(value: string) {
  return value.replaceAll("_", " ").toLocaleLowerCase("id-ID");
}

function cleaningLabel(status: string) {
  if (status === "IN_PROGRESS") return "Sedang dibersihkan";
  if (status === "CLEANED") return "Selesai dibersihkan";
  return "Perlu dibersihkan";
}

function jakartaTime(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function HousekeepingPage() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  const permissions = await getActivePermissionCodes(
    session.user.id,
    propertyId,
  );
  if (!permissions.has("housekeeping.task.manage"))
    return (
      <section className={styles.accessState}>
        <h1>Akses dibatasi</h1>
        <p>Akun Anda tidak memiliki permission housekeeping.</p>
      </section>
    );
  const data = await getOperationsQueues({ propertyId, session });
  const activeCleaning = data.cleaning.filter(
    (task) => !["INSPECTED", "CANCELLED"].includes(task.status),
  );
  const activeMaintenance = data.maintenance.filter(
    (issue) => !["VERIFIED", "CANCELLED"].includes(issue.status),
  );
  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Property operations</span>
          <h1>Housekeeping</h1>
          <p>Cleaning task dan maintenance yang masih perlu ditangani.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.liveIndicator}>Data operasional aktif</span>
        </div>
      </header>
      <div className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>Cleaning aktif</span>
          <strong>{activeCleaning.length}</strong>
          <small>Perlu dan sedang dibersihkan</small>
        </article>
        <article className={styles.metricCard}>
          <span>Prioritas tinggi</span>
          <strong>
            {
              activeCleaning.filter((task) =>
                ["HIGH", "URGENT"].includes(task.priority),
              ).length
            }
          </strong>
          <small>High dan urgent</small>
        </article>
        <article className={styles.metricCard}>
          <span>Maintenance</span>
          <strong>{activeMaintenance.length}</strong>
          <small>Belum verified</small>
        </article>
        <article className={styles.metricCard}>
          <span>Lost & Found</span>
          <strong>{data.lostFound.length}</strong>
          <small>Custody masih aktif</small>
        </article>
      </div>
      <div className={styles.moduleStack}>
        <HousekeepingActions
          maintenance={activeMaintenance}
          rooms={data.rooms}
          tasks={activeCleaning}
        />
      </div>
      <div className={styles.moduleStack}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Cleaning task</h2>
            <span className={styles.countPill}>{activeCleaning.length}</span>
          </div>
          {activeCleaning.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.workTable}>
                <thead>
                  <tr>
                    <th>Jenis</th>
                    <th>Target</th>
                    <th>Prioritas</th>
                    <th>Status</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCleaning.map((task) => (
                    <tr key={task.id}>
                      <td>{human(task.taskType)}</td>
                      <td>{jakartaTime(task.targetAt)}</td>
                      <td>{human(task.priority)}</td>
                      <td>
                        <span className={styles.statusPill}>
                          {cleaningLabel(task.status)}
                        </span>
                      </td>
                      <td>{task.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              Tidak ada cleaning task aktif.
            </div>
          )}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Maintenance</h2>
            <span className={styles.countPill}>{activeMaintenance.length}</span>
          </div>
          {activeMaintenance.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.workTable}>
                <thead>
                  <tr>
                    <th>Masalah</th>
                    <th>Kategori</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Dampak</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMaintenance.map((issue) => (
                    <tr key={issue.id}>
                      <td>{issue.title}</td>
                      <td>{human(issue.category)}</td>
                      <td>{human(issue.severity)}</td>
                      <td>
                        <span className={styles.statusPill}>
                          {human(issue.status)}
                        </span>
                      </td>
                      <td>{human(issue.serviceabilityImpact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              Tidak ada maintenance issue aktif.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
