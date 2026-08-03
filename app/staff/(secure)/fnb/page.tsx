import { getActivePermissionCodes } from "../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";
import {
  getFoodOrderPage,
  getFoodOrderQueue,
} from "../../../../src/modules/commerce/fnb-service";
import { parsePagination } from "../../../../src/platform/pagination";
import { databaseDate } from "../../../../src/platform/database-values";
import FnbActions from "../../_components/FnbActions";
import FnbHistoryFilters from "../../_components/FnbHistoryFilters";
import PaginationControls from "../../_components/PaginationControls";
import styles from "../../staff.module.css";

export const dynamic = "force-dynamic";

function human(value: string) {
  return value.replaceAll("_", " ").toLocaleLowerCase("id-ID");
}

function jakartaTime(value: unknown) {
  const date = databaseDate(value);
  if (!date) return "Waktu tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function idr(value: string | number) {
  return `Rp${Number(value).toLocaleString("id-ID")}`;
}

export default async function FnbPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  const permissions = await getActivePermissionCodes(
    session.user.id,
    propertyId,
  );
  if (!permissions.has("fnb.order.manage"))
    return (
      <section className={styles.accessState}>
        <h1>Akses dibatasi</h1>
        <p>Akun Anda tidak memiliki permission F&B.</p>
      </section>
    );
  const query = await searchParams;
  const value = (name: string) => {
    const current = query[name];
    return Array.isArray(current) ? current[0] : current;
  };
  const paginationRequest = parsePagination(
    { page: value("page"), pageSize: value("pageSize") },
    { defaultPageSize: 10, allowedPageSizes: [10, 20, 50] },
  );
  const search = value("search")?.trim().slice(0, 120) ?? "";
  const status = value("status")?.trim().slice(0, 40) || "ALL";
  const [orders, history] = await Promise.all([
    getFoodOrderQueue({ propertyId, session }),
    getFoodOrderPage({
      propertyId,
      session,
      page: paginationRequest.page,
      pageSize: paginationRequest.pageSize,
      search,
      status,
    }),
  ]);
  const active = orders.filter(
    (order) => !["COMPLETED", "CANCELLED"].includes(order.status),
  );
  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Paper-order intake</span>
          <h1>F&amp;B</h1>
          <p>
            Pesanan yang dimasukkan Front Office dari formulir kertas kamar.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.liveIndicator}>Antrean pesanan</span>
        </div>
      </header>
      <div className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>Pesanan aktif</span>
          <strong>{active.length}</strong>
          <small>Belum completed</small>
        </article>
        <article className={styles.metricCard}>
          <span>Baru masuk</span>
          <strong>
            {active.filter((order) => order.status === "ENTERED").length}
          </strong>
          <small>Menunggu diterima</small>
        </article>
        <article className={styles.metricCard}>
          <span>Sedang disiapkan</span>
          <strong>
            {
              active.filter((order) =>
                ["ACCEPTED", "PREPARING"].includes(order.status),
              ).length
            }
          </strong>
          <small>Accepted dan preparing</small>
        </article>
        <article className={styles.metricCard}>
          <span>Siap disajikan</span>
          <strong>
            {active.filter((order) => order.status === "READY").length}
          </strong>
          <small>Menunggu served</small>
        </article>
      </div>
      <div className={styles.moduleStack}>
        <FnbActions orders={orders} />
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Pesanan terbaru</h2>
          <span className={styles.countPill}>
            {history.pagination.totalItems}
          </span>
        </div>
        <FnbHistoryFilters initialSearch={search} initialStatus={status} />
        {history.orders.length ? (
          <div className={styles.foodOrderHistory}>
            {history.orders.map((order) => {
              const paid = Number(order.paidAmountIdr);
              const total = Number(order.orderTotalIdr);
              return (
                <details className={styles.foodOrderCard} key={order.id}>
                  <summary>
                    <div className={styles.foodOrderIdentity}>
                      <span>{order.paperReference}</span>
                      <strong>{order.orderCode}</strong>
                      <small>
                        {order.customerName ??
                          (order.roomStayId ? "Tamu kamar" : "Customer")}{" "}
                        · {jakartaTime(order.createdAt)}
                      </small>
                    </div>
                    <div className={styles.foodOrderRoute}>
                      <span>
                        {order.settlementRoute === "ROOM_CHARGE"
                          ? "Dibebankan ke kamar"
                          : paid >= total
                            ? "Lunas"
                            : "Belum dibayar"}
                      </span>
                      <small>{human(order.settlementRoute)}</small>
                    </div>
                    <div className={styles.foodOrderAmount}>
                      <span>Total tagihan</span>
                      <strong>{idr(total)}</strong>
                    </div>
                    <span className={styles.statusPill}>
                      {human(order.status)}
                    </span>
                    <span className={styles.foodOrderChevron}>⌄</span>
                  </summary>
                  <div className={styles.foodOrderDetail}>
                    <div className={styles.foodOrderItemsTable}>
                      <div className={styles.foodOrderItemsHead}>
                        <span>Menu</span>
                        <span>Jumlah</span>
                        <span>Harga</span>
                        <span>Total</span>
                      </div>
                      {order.items.map((item) => (
                        <div
                          className={styles.foodOrderHistoryItem}
                          key={item.id}
                        >
                          <div>
                            <strong>{item.name}</strong>
                            {item.notes ? <small>{item.notes}</small> : null}
                          </div>
                          <span>{Number(item.quantity)}</span>
                          <span>{idr(item.unitPriceIdr)}</span>
                          <strong>{idr(item.totalIdr)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className={styles.foodOrderBreakdown}>
                      <span>
                        Pajak
                        <strong>
                          {idr(
                            order.items.reduce(
                              (sum, item) => sum + Number(item.taxAmountIdr),
                              0,
                            ),
                          )}
                        </strong>
                      </span>
                      <span>
                        Service
                        <strong>
                          {idr(
                            order.items.reduce(
                              (sum, item) =>
                                sum + Number(item.serviceChargeAmountIdr),
                              0,
                            ),
                          )}
                        </strong>
                      </span>
                      <span>
                        Diskon
                        <strong>
                          −{" "}
                          {idr(
                            order.items.reduce(
                              (sum, item) =>
                                sum + Number(item.discountAmountIdr),
                              0,
                            ),
                          )}
                        </strong>
                      </span>
                      <span className={styles.foodOrderGrandTotal}>
                        Total tagihan
                        <strong>{idr(total)}</strong>
                      </span>
                    </div>
                    {order.settlementRoute === "STANDALONE" ? (
                      order.receiptId &&
                      order.receiptStatus === "ISSUED" &&
                      paid >= total ? (
                        <div className={styles.foodOrderDocument}>
                          <div>
                            <span>Invoice / kuitansi F&amp;B</span>
                            <strong>{order.receiptCode}</strong>
                            <small>Pembayaran lunas dan terverifikasi</small>
                          </div>
                          <a
                            href={`/api/staff/fnb/orders/${order.id}/invoice`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Print invoice F&amp;B
                          </a>
                        </div>
                      ) : (
                        <div className={styles.foodOrderDocumentPending}>
                          Invoice F&amp;B dapat dicetak setelah pembayaran
                          standalone dicatat.
                        </div>
                      )
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            Tidak ada pesanan yang cocok dengan filter.
          </div>
        )}
        <PaginationControls
          pageSizes={[10, 20, 50]}
          pagination={history.pagination}
        />
      </section>
    </>
  );
}
