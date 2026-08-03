"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { KookaSelect, MoneyInput, ReasonDialog } from "./FormControls";
import StaffNotice from "./StaffNotice";
import styles from "../staff.module.css";

type MenuItem = {
  id: string;
  name: string;
  priceIdr: number;
  estimatedTotalIdr?: number;
  available: boolean;
};
type RoomGuest = {
  roomStayId: string;
  roomNumber: string;
  leadGuestName: string;
  chargePrivilege: string;
};
type Order = {
  id: string;
  orderCode: string;
  status: string;
  settlementRoute: string;
  customerName: string | null;
  orderTotalIdr: string;
  paidAmountIdr: string;
  receiptId: string | null;
  receiptCode: string | null;
  receiptStatus: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: string;
    unitPriceIdr: string;
    taxAmountIdr: string;
    serviceChargeAmountIdr: string;
    discountAmountIdr: string;
    totalIdr: string;
    notes: string | null;
  }>;
};
type Notice = { tone: "success" | "error"; message: string } | null;
type DraftOrderItem = {
  lineId: string;
  menuItemId: string;
  quantity: string;
  notes: string;
};
type CreateOrderResult = {
  orderCode: string;
  paperReference: string;
  orderTotalIdr: number;
};
type StandalonePaymentResult = {
  foodOrderId: string;
  receiptId: string;
  receiptCode: string;
  amountIdr: number;
};

const nextOrderStatus: Record<string, string | undefined> = {
  ENTERED: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
  SERVED: "COMPLETED",
};

export default function FnbActions({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [rooms, setRooms] = useState<RoomGuest[]>([]);
  const [settlement, setSettlement] = useState("ROOM_CHARGE");
  const [roomStayId, setRoomStayId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [itemNotes, setItemNotes] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [orderId, setOrderId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [paymentOrderId, setPaymentOrderId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentRecipient, setPaymentRecipient] = useState("");
  const [lastReceipt, setLastReceipt] =
    useState<StandalonePaymentResult | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    void Promise.all([
      fetch("/api/content/menu?locale=id").then((response) => response.json()),
      fetch("/api/staff/fnb/room-guests").then((response) => response.json()),
    ]).then(([menuData, roomData]) => {
      const categories = Array.isArray(menuData.categories)
        ? (menuData.categories as Array<{ items: MenuItem[] }>)
        : [];
      setMenu(
        categories
          .flatMap((category) => category.items)
          .filter((item) => item.available),
      );
      setRooms(Array.isArray(roomData.rooms) ? roomData.rooms : []);
    });
  }, []);
  async function send<T = Record<string, unknown>>(
    body: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch("/api/staff/fnb/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `fnb:${crypto.randomUUID()}`,
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: { message?: string } | string;
    } | null;
    if (!response.ok)
      throw new Error(
        typeof result?.error === "string"
          ? result.error
          : (result?.error?.message ?? "Pesanan gagal diproses."),
      );
    return result as T;
  }
  function addItem() {
    const selectedMenu = menu.find((item) => item.id === menuItemId);
    const parsedQuantity = Number(quantity);
    const existing = items.find(
      (item) =>
        item.menuItemId === selectedMenu?.id && item.notes === itemNotes.trim(),
    );
    if (
      !selectedMenu ||
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 100 ||
      Number(existing?.quantity ?? 0) + parsedQuantity > 100
    ) {
      setNotice({
        tone: "error",
        message: "Pilih menu dan masukkan jumlah antara 1–100.",
      });
      return;
    }
    const normalizedNotes = itemNotes.trim();
    setItems((current) => {
      const existing = current.find(
        (item) =>
          item.menuItemId === selectedMenu.id && item.notes === normalizedNotes,
      );
      if (!existing) {
        return [
          ...current,
          {
            lineId: crypto.randomUUID(),
            menuItemId: selectedMenu.id,
            quantity: String(parsedQuantity),
            notes: normalizedNotes,
          },
        ];
      }
      return current.map((item) =>
        item.lineId === existing.lineId
          ? {
              ...item,
              quantity: String(Number(item.quantity) + parsedQuantity),
            }
          : item,
      );
    });
    setMenuItemId("");
    setQuantity("1");
    setItemNotes("");
    setNotice(null);
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const room = rooms.find((item) => item.roomStayId === roomStayId);
    if (
      items.length === 0 ||
      items.some(
        (item) =>
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1 ||
          Number(item.quantity) > 100,
      ) ||
      (settlement === "ROOM_CHARGE" && !room) ||
      (settlement === "STANDALONE" && !customerName.trim())
    ) {
      setNotice({
        tone: "error",
        message: "Lengkapi formulir pesanan sebelum menyimpan.",
      });
      return;
    }
    try {
      const result = await send<CreateOrderResult>({
        action: "CREATE_PAPER_ORDER",
        settlementRoute: settlement,
        customerName: settlement === "STANDALONE" ? customerName : undefined,
        notes: orderNotes.trim() || undefined,
        roomStayId: settlement === "ROOM_CHARGE" ? roomStayId : undefined,
        expectedRoomNumber: room?.roomNumber,
        expectedLeadGuestName: room?.leadGuestName,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: Number(item.quantity),
          notes: item.notes || undefined,
        })),
      });
      setNotice({
        tone: "success",
        message: `Formulir ${result.paperReference} berhasil disimpan dengan ${items.length} jenis menu.`,
      });
      setItems([]);
      setOrderNotes("");
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Pesanan gagal.",
      });
    }
  }
  async function transition(event: React.FormEvent) {
    event.preventDefault();
    if (!orderId) {
      setNotice({
        tone: "error",
        message: "Pilih pesanan yang akan diperbarui.",
      });
      return;
    }
    try {
      await send({
        action: "TRANSITION_ORDER",
        foodOrderId: orderId,
        toStatus: status,
      });
      setNotice({
        tone: "success",
        message: "Status pesanan berhasil diperbarui.",
      });
      setOrderId("");
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Status gagal diperbarui.",
      });
    }
  }
  async function cancel() {
    if (!orderId || cancelReason.trim().length < 3) return;
    try {
      await send({
        action: "CANCEL_ORDER",
        foodOrderId: orderId,
        reason: cancelReason.trim(),
      });
      setNotice({ tone: "success", message: "Pesanan berhasil dibatalkan." });
      setCancelOpen(false);
      setCancelReason("");
      setOrderId("");
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Pembatalan gagal.",
      });
    }
  }
  async function recordPayment(event: React.FormEvent) {
    event.preventDefault();
    const order = orders.find((item) => item.id === paymentOrderId);
    if (
      !order ||
      Number(paymentAmount) !== Number(order.orderTotalIdr) ||
      !paymentRecipient.trim()
    ) {
      setNotice({
        tone: "error",
        message: "Nominal pembayaran harus sama dengan total pesanan.",
      });
      return;
    }
    try {
      const result = await send<StandalonePaymentResult>({
        action: "RECORD_STANDALONE_PAYMENT",
        foodOrderId: paymentOrderId,
        method: paymentMethod,
        amountIdr: Number(paymentAmount),
        reference: paymentReference.trim() || undefined,
        recipientName: paymentRecipient.trim(),
      });
      setNotice({
        tone: "success",
        message: "Pembayaran dicatat dan kuitansi standalone diterbitkan.",
      });
      setPaymentOrderId("");
      setPaymentAmount("");
      setPaymentReference("");
      setLastReceipt(result);
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Pembayaran gagal dicatat.",
      });
    }
  }
  const estimatedOrderTotal = items.reduce((total, item) => {
    const selectedMenu = menu.find((entry) => entry.id === item.menuItemId);
    return (
      total +
      Number(item.quantity || 0) *
        (selectedMenu?.estimatedTotalIdr ?? selectedMenu?.priceIdr ?? 0)
    );
  }, 0);
  const selectedOrder = orders.find((item) => item.id === orderId);
  const selectedPaymentOrder = orders.find(
    (item) => item.id === paymentOrderId,
  );
  const selectedPaymentOutstanding = selectedPaymentOrder
    ? Math.max(
        0,
        Number(selectedPaymentOrder.orderTotalIdr) -
          Number(selectedPaymentOrder.paidAmountIdr),
      )
    : 0;
  const status = nextOrderStatus[selectedOrder?.status ?? ""] ?? "";
  return (
    <div className={styles.actionGrid}>
      <StaffNotice notice={notice} onDismiss={() => setNotice(null)} />
      <section className={`${styles.formCard} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Masukkan pesanan kertas</h2>
        </div>
        <form className={styles.staffForm} onSubmit={create}>
          <div className={styles.formGrid}>
            <div className={styles.generatedOrderCode}>
              <span>Nomor formulir</span>
              <strong>Dibuat otomatis saat disimpan</strong>
              <small>
                Format tanggal Jakarta + urutan harian, contoh 26080301.
              </small>
            </div>
            <label>
              Tagihan
              <KookaSelect
                ariaLabel="Jenis tagihan pesanan"
                value={settlement}
                onChange={setSettlement}
                options={[
                  {
                    value: "ROOM_CHARGE",
                    label: "Bebankan ke kamar",
                    description: "Masuk ke folio tamu yang sedang menginap",
                  },
                  {
                    value: "STANDALONE",
                    label: "Standalone",
                    description: "Pembayaran terpisah dari kamar",
                  },
                ]}
              />
            </label>
          </div>
          {settlement === "ROOM_CHARGE" ? (
            <label>
              Kamar / tamu
              <KookaSelect
                ariaLabel="Kamar dan tamu"
                value={roomStayId}
                onChange={setRoomStayId}
                options={rooms.map((room) => ({
                  value: room.roomStayId,
                  label: `Kamar ${room.roomNumber} — ${room.leadGuestName}`,
                  description: room.chargePrivilege.replaceAll("_", " "),
                }))}
                placeholder="Pilih kamar dan tamu"
                emptyMessage="Belum ada tamu check-in yang dapat dibebankan ke kamar."
              />
            </label>
          ) : (
            <label>
              Nama customer
              <input
                required
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </label>
          )}
          <div className={styles.orderBuilder}>
            <div className={styles.orderBuilderHeading}>
              <div>
                <span>Isi formulir</span>
                <strong>Tambahkan semua menu dalam satu pesanan</strong>
              </div>
              <b>{items.length} jenis menu</b>
            </div>
            <div className={styles.formGrid}>
              <label>
                Menu
                <KookaSelect
                  ariaLabel="Menu pesanan"
                  value={menuItemId}
                  onChange={setMenuItemId}
                  options={menu.map((item) => ({
                    value: item.id,
                    label: item.name,
                    description: `Rp${item.priceIdr.toLocaleString("id-ID")}`,
                  }))}
                  placeholder="Pilih menu"
                  emptyMessage="Belum ada menu aktif."
                />
              </label>
              <label>
                Jumlah
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  type="text"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target.value.replace(/\D/gu, "").slice(0, 3),
                    )
                  }
                />
              </label>
            </div>
            <label>
              Catatan khusus menu (opsional)
              <input
                maxLength={500}
                placeholder="Contoh: tidak pedas, tanpa es"
                value={itemNotes}
                onChange={(event) => setItemNotes(event.target.value)}
              />
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.secondaryButton}
                onClick={addItem}
                type="button"
              >
                + Tambahkan menu
              </button>
            </div>
            <div className={styles.orderItemList}>
              {items.length === 0 ? (
                <p className={styles.emptyOrderItems}>
                  Belum ada menu. Pilih menu di atas lalu tambahkan ke formulir.
                </p>
              ) : (
                items.map((item, index) => {
                  const selectedMenu = menu.find(
                    (entry) => entry.id === item.menuItemId,
                  );
                  const unitPrice =
                    selectedMenu?.estimatedTotalIdr ??
                    selectedMenu?.priceIdr ??
                    0;
                  return (
                    <article className={styles.orderItemRow} key={item.lineId}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>
                          {selectedMenu?.name ?? "Menu tidak tersedia"}
                        </strong>
                        <small>
                          Rp{unitPrice.toLocaleString("id-ID")} / item
                          {item.notes ? ` · ${item.notes}` : ""}
                        </small>
                      </div>
                      <label>
                        Jumlah
                        <input
                          aria-label={`Jumlah ${selectedMenu?.name ?? "menu"}`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          type="text"
                          value={item.quantity}
                          onChange={(event) => {
                            const nextQuantity = event.target.value
                              .replace(/\D/gu, "")
                              .slice(0, 3);
                            setItems((current) =>
                              current.map((entry) =>
                                entry.lineId === item.lineId
                                  ? { ...entry, quantity: nextQuantity }
                                  : entry,
                              ),
                            );
                          }}
                        />
                      </label>
                      <strong>
                        Rp
                        {(
                          unitPrice * Number(item.quantity || 0)
                        ).toLocaleString("id-ID")}
                      </strong>
                      <button
                        aria-label={`Hapus ${selectedMenu?.name ?? "menu"}`}
                        className={styles.orderItemRemove}
                        onClick={() =>
                          setItems((current) =>
                            current.filter(
                              (entry) => entry.lineId !== item.lineId,
                            ),
                          )
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </article>
                  );
                })
              )}
            </div>
            <div className={styles.orderEstimate}>
              <span>Estimasi berdasarkan harga menu aktif</span>
              <strong>Rp{estimatedOrderTotal.toLocaleString("id-ID")}</strong>
            </div>
          </div>
          <label>
            Catatan keseluruhan pesanan
            <textarea
              value={orderNotes}
              onChange={(event) => setOrderNotes(event.target.value)}
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={items.length === 0}
          >
            Simpan {items.length} jenis menu
          </button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Update status pesanan</h2>
        </div>
        <form className={styles.staffForm} onSubmit={transition}>
          <label>
            Pesanan
            <KookaSelect
              ariaLabel="Pesanan yang akan diperbarui"
              value={orderId}
              onChange={setOrderId}
              options={orders
                .filter(
                  (order) => !["COMPLETED", "CANCELLED"].includes(order.status),
                )
                .map((order) => ({
                  value: order.id,
                  label: `${order.orderCode} — ${order.customerName ?? "Customer"}`,
                  description: `${order.status.replaceAll("_", " ")} · Rp${Number(order.orderTotalIdr).toLocaleString("id-ID")}`,
                }))}
              placeholder="Pilih pesanan"
              emptyMessage="Tidak ada pesanan aktif."
            />
          </label>
          <label>
            Status
            <KookaSelect
              ariaLabel="Status baru pesanan"
              value={status}
              onChange={() => undefined}
              options={
                status
                  ? [{ value: status, label: status.replaceAll("_", " ") }]
                  : []
              }
              placeholder="Pilih pesanan terlebih dahulu"
            />
          </label>
          <div className={styles.formActions}>
            <button className={styles.primaryButton} disabled={!status}>
              Lanjut ke{" "}
              {status ? status.replaceAll("_", " ") : "status berikutnya"}
            </button>
            <button
              className={styles.secondaryButton}
              disabled={!orderId}
              onClick={() => setCancelOpen(true)}
              type="button"
            >
              Batalkan pesanan
            </button>
          </div>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Pembayaran standalone</h2>
        </div>
        <form className={styles.staffForm} onSubmit={recordPayment}>
          <label>
            Pesanan
            <KookaSelect
              ariaLabel="Pesanan standalone"
              value={paymentOrderId}
              onChange={(value) => {
                const order = orders.find((item) => item.id === value);
                setPaymentOrderId(value);
                setPaymentAmount(
                  order
                    ? String(
                        Math.max(
                          0,
                          Number(order.orderTotalIdr) -
                            Number(order.paidAmountIdr),
                        ),
                      )
                    : "",
                );
                setPaymentRecipient(order?.customerName ?? "Customer");
              }}
              options={orders
                .filter(
                  (order) =>
                    order.settlementRoute === "STANDALONE" &&
                    order.status !== "CANCELLED" &&
                    Number(order.paidAmountIdr) === 0,
                )
                .map((order) => ({
                  value: order.id,
                  label: `${order.orderCode} — ${order.customerName ?? "Customer"}`,
                  description: `Sisa Rp${Math.max(0, Number(order.orderTotalIdr) - Number(order.paidAmountIdr)).toLocaleString("id-ID")}`,
                }))}
              placeholder="Pilih pesanan belum dibayar"
              emptyMessage="Tidak ada pesanan standalone yang belum dibayar."
            />
          </label>
          {selectedPaymentOrder ? (
            <div className={styles.paymentOrderSummary}>
              <div className={styles.paymentOrderHeading}>
                <div>
                  <span>Rincian yang akan dibayar</span>
                  <strong>{selectedPaymentOrder.orderCode}</strong>
                </div>
                <strong>
                  Rp{selectedPaymentOutstanding.toLocaleString("id-ID")}
                </strong>
              </div>
              <div className={styles.paymentOrderItems}>
                {selectedPaymentOrder.items.map((item) => (
                  <div key={item.id}>
                    <span>
                      {Number(item.quantity)}× {item.name}
                    </span>
                    <strong>
                      Rp{Number(item.totalIdr).toLocaleString("id-ID")}
                    </strong>
                  </div>
                ))}
              </div>
              <div className={styles.paymentOrderTotals}>
                <span>
                  Total pesanan
                  <strong>
                    Rp
                    {Number(selectedPaymentOrder.orderTotalIdr).toLocaleString(
                      "id-ID",
                    )}
                  </strong>
                </span>
                <span>
                  Sudah dibayar
                  <strong>
                    Rp
                    {Number(selectedPaymentOrder.paidAmountIdr).toLocaleString(
                      "id-ID",
                    )}
                  </strong>
                </span>
                <span>
                  Sisa tagihan
                  <strong>
                    Rp{selectedPaymentOutstanding.toLocaleString("id-ID")}
                  </strong>
                </span>
              </div>
            </div>
          ) : null}
          <label>
            Nominal IDR
            <MoneyInput
              ariaLabel="Nominal pembayaran standalone"
              disabled={!selectedPaymentOrder}
              onChange={setPaymentAmount}
              required
              value={paymentAmount}
            />
          </label>
          <label>
            Metode
            <KookaSelect
              ariaLabel="Metode pembayaran standalone"
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={[
                { value: "CASH", label: "Cash" },
                { value: "BANK_TRANSFER", label: "Transfer bank" },
                { value: "OTHER", label: "Lainnya" },
              ]}
            />
          </label>
          <label>
            Referensi (opsional)
            <input
              maxLength={160}
              onChange={(event) => setPaymentReference(event.target.value)}
              value={paymentReference}
            />
          </label>
          <label>
            Nama penerima kuitansi
            <input
              maxLength={160}
              onChange={(event) => setPaymentRecipient(event.target.value)}
              required
              value={paymentRecipient}
            />
          </label>
          <button className={styles.primaryButton} disabled={!paymentOrderId}>
            Catat pembayaran &amp; terbitkan kuitansi
          </button>
          {lastReceipt ? (
            <div className={styles.paymentReceiptReady}>
              <div>
                <span>Dokumen berhasil diterbitkan</span>
                <strong>{lastReceipt.receiptCode}</strong>
                <small>
                  Total lunas Rp
                  {lastReceipt.amountIdr.toLocaleString("id-ID")}
                </small>
              </div>
              <a
                href={`/api/staff/fnb/orders/${lastReceipt.foodOrderId}/invoice`}
                rel="noreferrer"
                target="_blank"
              >
                Print invoice F&amp;B
              </a>
            </div>
          ) : null}
        </form>
      </section>
      <ReasonDialog
        confirmLabel="Batalkan pesanan"
        description="Tagihan kamar yang sudah diposting akan dibalik otomatis."
        onCancel={() => {
          setCancelOpen(false);
          setCancelReason("");
        }}
        onChange={setCancelReason}
        onConfirm={() => void cancel()}
        open={cancelOpen}
        title="Batalkan pesanan F&B?"
        value={cancelReason}
      />
    </div>
  );
}
